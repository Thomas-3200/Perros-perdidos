/**
 * Parser de casos importados desde redes sociales (Human API).
 *
 * Entrada: link, screenshot, foto o texto
 * Salida:  ExtractedCaseData estructurado
 *
 * Usa Claude (Anthropic) para:
 * - OCR de screenshots e imágenes
 * - Extracción de entidades (fecha, ubicación, descripción, fotos, contacto)
 * - Clasificación: ¿es un perro PERDIDO o ENCONTRADO?
 */
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@perros/db';
import type { ExtractedCaseData } from '@perros/shared';

// Modelo configurable por env var — podés cambiarlo en Render → Environment → ANTHROPIC_MODEL
// Modelos disponibles (mayo 2026): claude-haiku-4-5 | claude-sonnet-4-6 | claude-opus-4-7
const DEFAULT_MODEL = 'claude-haiku-4-5';
const getModel = () => process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

let _anthropic: Anthropic | null = null;
const getAnthropic = () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY no está configurada. ' +
      'Agregala en las variables de entorno de Render (Dashboard → Environment).'
    );
  }
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
};

function buildExtractionPrompt(): string {
  const todayISO = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `Eres un asistente especializado en analizar publicaciones sobre perros perdidos o encontrados en Argentina y Latinoamérica.

📅 LA FECHA DE HOY ES: ${todayISO}. Cualquier fecha que infieras debe ser cercana a hoy. Si el post dice "hace 8 minutos" significa hace 8 minutos contando desde ${todayISO}, NO una fecha vieja.

Analiza el contenido provisto (puede ser texto de un post, un screenshot de red social, o una fotografía) y extraé toda la información posible con MÁXIMO detalle.

🎯 PRIORIDAD #1 — LA UBICACIÓN ES LO MÁS IMPORTANTE
La app SOLO sirve si sabe DÓNDE fue visto el perro. Buscá la ubicación con OBSESIÓN:
- Leé el texto completo del post (todas las líneas, los comentarios visibles, las hashtags)
- Si hay 2 imágenes, mirá AMBAS — a veces la dirección está en una y el perro en otra
- Buscá nombres de calles, intersecciones, números de altura, plazas, parques, estaciones de tren/subte, supermercados, escuelas, colegios — cualquier referencia geográfica
- Buscá el barrio o localidad (Caballito, Avellaneda, San Isidro, Belgrano, etc.)
- Si solo dice "zona X" o "barrio Y", usá eso
- Si solo dice "BA" o "CABA", marcá ciudad="Buenos Aires"
- Si NADA de ubicación aparece, devolvé null en address y city — NO inventes
- Para lat/lng: si tenés ciudad/barrio, devolvé las coordenadas APROXIMADAS de esa zona (ej: Avellaneda ≈ -34.6611, -58.3651)

IMPORTANTE — extraé SIEMPRE que puedas:
- Raza del perro (aunque sea aproximada: "labrador", "mestizo", "poodle", etc.)
- Colores exactos (marrón, negro, blanco, manchas, etc.)
- Tamaño estimado (small=pequeño, medium=mediano, large=grande, extra_large=muy grande)
- Fecha Y hora de la publicación original (leer el timestamp del post: "hace 8 min", "hace 2 hs", "ayer", etc., y calcular ISO 8601 desde HOY ${todayISO})
- Número de WhatsApp, teléfono, o información de contacto del que publicó (devolver SOLO el número, sin prefijos como "WhatsApp:" o "Tel:")
- Cualquier seña particular: collar, cicatriz, tatuaje, microchip, nombre, comportamiento

📝 IMPORTANTE PARA LA DESCRIPCIÓN:
Escribí la descripción como lo haría una PERSONA NORMAL contando lo que vio o lo que pasó. NO uses bullets, NO uses formato "Atributo: valor". Que suene natural, humano, como si lo estuviera contando un vecino. Ejemplos:
- ❌ MAL: "Raza: mestizo. Color: gris. Tamaño: pequeño. Tiene collar."
- ✅ BIEN: "Es un perrito mestizo, chiquito, de pelaje gris con manchas blancas. Lleva un collar amarillo y se asusta con facilidad. Responde al nombre de Toby."

Responde SOLO con JSON válido siguiendo esta estructura exacta (sin markdown, sin texto adicional):
{
  "caseType": "lost|found|unknown",
  "description": "descripción NATURAL del perro y la situación, escrita como una persona, NO con bullets ni 'Raza: X'",
  "location": {
    "address": "dirección o barrio exacto si aparece, o null",
    "city": "ciudad o localidad, o null",
    "country": "país (por defecto Argentina si no se indica)",
    "lat": número de latitud estimada según la ciudad (ej: -34.6037 para Buenos Aires), o null,
    "lng": número de longitud estimada según la ciudad (ej: -58.3816 para Buenos Aires), o null
  },
  "seenAt": "fecha y hora ISO 8601 calculada desde HOY ${todayISO} (ej si dice 'hace 8 min' y hoy es ${todayISO}, devolvé ${todayISO}T... con hora actual menos 8 min). Si no hay info clara, usá NULL en vez de inventar.",
  "contactInfo": "número de WhatsApp, teléfono o email del contacto si aparece en el contenido, o null",
  "reward": número en moneda local o null,
  "dogAttributes": {
    "breed": "raza del perro o 'mestizo' si no está definida, o null si no hay info",
    "color": ["color1", "color2"],
    "size": "small|medium|large|extra_large o null"
  },
  "confidence": número entre 0 y 1 indicando confianza de la extracción
}

Si el contenido no tiene relación con perros perdidos o encontrados, pon confidence: 0 y caseType: "unknown".
Si hay información parcial, extraé lo que puedas y ajustá confidence proporcionalmente.`;
}

const EXTRACTION_PROMPT = buildExtractionPrompt(); // legacy fallback

export async function parseImportedCase(importedCaseId: string): Promise<void> {
  const imported = await prisma.importedSocialCase.findUniqueOrThrow({
    where: { id: importedCaseId },
  });

  console.log(`[ingest] Iniciando análisis de caso ${importedCaseId} (tipo: ${imported.sourceType})`);

  let extractedData: ExtractedCaseData;

  try {
    const claude = getAnthropic(); // lanza si ANTHROPIC_API_KEY no está

    if (imported.sourceType === 'screenshot' || imported.sourceType === 'photo') {
      // ── Imagen/screenshot → Claude Vision con OCR ──────────────────────────
      //
      // rawInput puede contener UNA URL o VARIAS separadas por '\n' (cuando
      // el usuario sube 2 capturas: una con el perro y otra con la dirección
      // o el contacto). Se las pasamos TODAS a Claude en el mismo mensaje
      // para que cruce información entre las dos.

      const imageUrls = imported.rawInput.split('\n').map((u: string) => u.trim()).filter(Boolean);
      console.log(`[ingest] Procesando ${imageUrls.length} imagen(es)...`);

      // Descargar todas las imágenes en paralelo
      const imageBlocks = await Promise.all(imageUrls.map(async (url: string, i: number) => {
        console.log(`[ingest] [${i + 1}/${imageUrls.length}] Descargando: ${url.substring(0, 80)}...`);
        const imageRes = await fetch(url, {
          headers: { 'Accept': 'image/*' },
          signal: AbortSignal.timeout(20_000),
        });
        if (!imageRes.ok) throw new Error(`No se pudo descargar la imagen ${i + 1}: ${imageRes.status} ${imageRes.statusText}`);

        const buffer      = await imageRes.arrayBuffer();
        const base64      = Buffer.from(buffer).toString('base64');
        const contentType = imageRes.headers.get('content-type') ?? 'image/jpeg';
        const mediaType   = (contentType.split(';')[0].trim()) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

        console.log(`[ingest] [${i + 1}/${imageUrls.length}] OK (${(buffer.byteLength / 1024).toFixed(0)} KB, ${mediaType})`);

        return {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: mediaType, data: base64 },
        };
      }));

      // Texto contextual: si hay más de una imagen, le aclaramos a Claude
      const promptText = imageUrls.length > 1
        ? `Te paso ${imageUrls.length} capturas del MISMO post de red social. Una tiene la foto del perro, la otra puede tener info adicional (dirección exacta, teléfono, descripción). Cruzá la información de TODAS para extraer los datos más completos posibles.\n\n${buildExtractionPrompt()}`
        : buildExtractionPrompt();

      console.log(`[ingest] Llamando a Claude con ${imageBlocks.length} imagen(es)...`);

      const response = await claude.messages.create({
        model: getModel(),
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              ...imageBlocks,
              { type: 'text' as const, text: promptText },
            ],
          },
        ],
      });

      const raw     = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      console.log(`[ingest] Respuesta de Claude (primeros 200 chars): ${cleaned.substring(0, 200)}`);
      extractedData = mapExtracted(JSON.parse(cleaned));

    } else {
      // ── Texto / link → solo texto ──────────────────────────────────────────
      const content = imported.sourceType === 'link'
        ? `Se compartió este link de red social: ${imported.rawInput}\n\nNo puedes acceder a la URL, pero intentá inferir lo que puedas del propio link (nombre del grupo, palabras clave, etc.).`
        : imported.rawInput;

      console.log(`[ingest] Procesando texto (${content.length} chars). Llamando a Claude...`);

      const response = await claude.messages.create({
        model: getModel(),
        max_tokens: 1024,
        system: buildExtractionPrompt(),
        messages: [
          { role: 'user', content },
        ],
      });

      const raw     = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      console.log(`[ingest] Respuesta de Claude (primeros 200 chars): ${cleaned.substring(0, 200)}`);
      extractedData = mapExtracted(JSON.parse(cleaned));
    }

    // Para screenshots/fotos bajamos el umbral: el usuario lo subió intencionalmente
    const isScreenshot = imported.sourceType === 'screenshot' || imported.sourceType === 'photo';
    const threshold    = isScreenshot ? 0.1 : 0.3;
    const isUsable     = extractedData.confidence > threshold;

    console.log(`[ingest] Confianza: ${extractedData.confidence} (umbral: ${threshold}) → ${isUsable ? 'USABLE' : 'RECHAZADO'}`);

    await prisma.importedSocialCase.update({
      where: { id: importedCaseId },
      data: {
        extractedData: extractedData as object,
        status: isUsable ? 'processed' : 'rejected',
      },
    });

    // ── Auto-crear avistamiento siempre que haya info útil ───────────────────
    if (isUsable) {
      const loc       = extractedData.location;
      const hasCoords = loc && loc.lat !== 0 && loc.lng !== 0;

      // Fotos: screenshots/photos ya están en Cloudinary.
      // Si hay múltiples (separadas por \n), las guardamos todas como photos
      // del avistamiento — útil para que el usuario pueda ver todas las
      // capturas originales del post.
      const photos = isScreenshot
        ? imported.rawInput.split('\n').map((u: string) => u.trim()).filter(Boolean)
        : [];

      // Coordenadas: usar las de la IA, o fallback a centro de Argentina
      const lat = hasCoords ? loc!.lat : -38.4161;
      const lng = hasCoords ? loc!.lng : -63.6167;

      // Ciudad: usar la extraída o marcar como "Sin ubicación"
      const city = loc?.city ?? 'Sin ubicación especificada';

      // Fecha: usar la extraída por la IA, pero validarla.
      // La IA puede caer en fechas viejas de su training si no logra inferir desde el post.
      // Si la fecha extraída es de hace más de 30 días, asumimos que la IA se equivocó
      // y usamos la fecha en que el usuario importó el caso (hoy o ayer).
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      let seenAt: Date;
      if (extractedData.seenAt) {
        const aiDate = new Date(extractedData.seenAt);
        const ageMs  = Date.now() - aiDate.getTime();
        if (ageMs > THIRTY_DAYS_MS) {
          console.log(`[ingest] Fecha extraída por IA (${aiDate.toISOString()}) es de hace ${Math.round(ageMs / 86_400_000)} días — usando createdAt`);
          seenAt = imported.createdAt;
        } else {
          seenAt = aiDate;
        }
      } else {
        seenAt = imported.createdAt;
      }

      // Descripción: usar la natural que escribió la IA. El contacto NO se
      // pega más en el texto — se guarda en su propio campo (contactPhone)
      // y se muestra como botón clickeable en el frontend.
      let description = (extractedData.description ?? '').trim();
      if (!description) {
        description = 'Sin descripción extraída del post.';
      }

      // Contacto del DUEÑO del perro (extraído del post original).
      // Limpiamos prefijos típicos como "WhatsApp:", "Tel:", etc., dejando
      // solo el número (con caracteres válidos para tel: link).
      let contactPhone: string | null = null;
      if (extractedData.contactInfo) {
        const cleaned = extractedData.contactInfo
          .replace(/whatsapp[:.\s-]*/i, '')
          .replace(/tel[éef]fono[:.\s-]*/i, '')
          .replace(/contacto[:.\s-]*/i, '')
          .replace(/wsp[:.\s-]*/i, '')
          .trim();
        contactPhone = cleaned || null;
      }

      const sighting = await prisma.sighting.create({
        data: {
          reporterId:      imported.submittedById,
          locationLat:     lat,
          locationLng:     lng,
          locationAddress: loc?.address,
          locationCity:    city,
          seenAt,
          photos,
          description,
          contactPhone,
          source:          'social_import',
          importedCaseId:  imported.id,
        },
      });

      console.log(`[ingest] ✅ Avistamiento creado: ${sighting.id} (ciudad: ${city}, visto: ${seenAt}, confianza: ${extractedData.confidence})`);
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ingest] ❌ Error procesando caso ${importedCaseId}: ${msg}`);
    await prisma.importedSocialCase.update({
      where: { id: importedCaseId },
      data:  { status: 'rejected' },
    });
    throw err; // re-lanzar para que la ruta HTTP maneje el error
  }
}

// ─── Mapea la respuesta de Claude a ExtractedCaseData ────────────────────────
function mapExtracted(raw: Record<string, unknown>): ExtractedCaseData {
  const rawLoc = raw.location as Record<string, unknown> | undefined;
  return {
    description:   raw.description  as string | undefined,
    location: rawLoc ? {
      lat:     Number(rawLoc.lat ?? 0),
      lng:     Number(rawLoc.lng ?? 0),
      address: rawLoc.address as string | undefined,
      city:    rawLoc.city    as string | undefined,
      country: rawLoc.country as string | undefined,
    } : undefined,
    seenAt:        raw.seenAt ? new Date(raw.seenAt as string) : undefined,
    photos:        [],
    contactInfo:   raw.contactInfo  as string | undefined,
    reward:        raw.reward       as number | undefined,
    dogAttributes: raw.dogAttributes as ExtractedCaseData['dogAttributes'] | undefined,
    confidence:    Number(raw.confidence ?? 0),
  };
}
