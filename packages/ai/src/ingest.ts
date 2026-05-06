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

// Modelo configurable por env var — si el modelo por defecto da 404,
// podés cambiarlo en Render → Environment → ANTHROPIC_MODEL
const DEFAULT_MODEL = 'claude-3-haiku-20240307';
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

const EXTRACTION_PROMPT = `Eres un asistente especializado en analizar publicaciones sobre perros perdidos en Argentina y Latinoamérica.

Analiza el contenido provisto (puede ser texto de un post, un screenshot, o una imagen) y extrae la información relevante.

Responde SOLO con JSON válido siguiendo esta estructura exacta (sin markdown, sin texto adicional):
{
  "caseType": "lost|found|unknown",
  "description": "descripción del perro con todas las señas particulares que encuentres",
  "location": {
    "address": "dirección si la hay",
    "city": "ciudad",
    "country": "país (por defecto Argentina si no se indica)",
    "lat": número de latitud estimada según la ciudad (ej: -34.6037 para Buenos Aires), o null,
    "lng": número de longitud estimada según la ciudad (ej: -58.3816 para Buenos Aires), o null
  },
  "seenAt": "fecha en ISO 8601 si se puede inferir, o null",
  "contactInfo": "teléfono/email/usuario de red social del contacto si aparece",
  "reward": número en moneda local o null,
  "dogAttributes": {
    "breed": "raza o null",
    "color": ["colores del perro"],
    "size": "small|medium|large|extra_large o null"
  },
  "confidence": número entre 0 y 1 indicando confianza de la extracción
}

Si el contenido no tiene relación con perros perdidos o encontrados, pon confidence: 0 y caseType: "unknown".
Si hay información parcial, extraé lo que puedas y ajustá confidence al porcentaje de datos disponibles.`;

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

      // Descargar la imagen desde Cloudinary como base64
      const imageUrl = imported.rawInput;
      console.log(`[ingest] Descargando imagen: ${imageUrl.substring(0, 80)}...`);

      const imageRes = await fetch(imageUrl, {
        headers: { 'Accept': 'image/*' },
        signal: AbortSignal.timeout(20_000), // 20s timeout para la descarga
      });
      if (!imageRes.ok) throw new Error(`No se pudo descargar la imagen: ${imageRes.status} ${imageRes.statusText}`);

      const buffer      = await imageRes.arrayBuffer();
      const base64      = Buffer.from(buffer).toString('base64');
      const contentType = imageRes.headers.get('content-type') ?? 'image/jpeg';
      const mediaType   = (contentType.split(';')[0].trim()) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

      console.log(`[ingest] Imagen descargada (${(buffer.byteLength / 1024).toFixed(0)} KB, ${mediaType}). Llamando a Claude...`);

      const response = await claude.messages.create({
        model: getModel(),
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: EXTRACTION_PROMPT,
              },
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
        system: EXTRACTION_PROMPT,
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

      // Fotos: screenshots/photos ya están en Cloudinary
      const photos = isScreenshot ? [imported.rawInput] : [];

      // Coordenadas: usar las de la IA, o fallback a centro de Argentina
      const lat = hasCoords ? loc!.lat : -38.4161;
      const lng = hasCoords ? loc!.lng : -63.6167;

      // Ciudad: usar la extraída o marcar como "Sin ubicación"
      const city = loc?.city ?? 'Sin ubicación especificada';

      const sighting = await prisma.sighting.create({
        data: {
          reporterId:      imported.submittedById,
          locationLat:     lat,
          locationLng:     lng,
          locationAddress: loc?.address,
          locationCity:    city,
          seenAt:          imported.createdAt, // siempre fecha actual, nunca la del post antiguo
          photos,
          description:     extractedData.description,
          source:          'social_import',
          importedCaseId:  imported.id,
        },
      });

      console.log(`[ingest] ✅ Avistamiento creado: ${sighting.id} (ciudad: ${city}, confianza: ${extractedData.confidence})`);
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
