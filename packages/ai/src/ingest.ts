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

let _anthropic: Anthropic | null = null;
const getAnthropic = () => {
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

  let extractedData: ExtractedCaseData;

  try {
    const claude = getAnthropic();

    if (imported.sourceType === 'screenshot' || imported.sourceType === 'photo') {
      // ── Imagen/screenshot → Claude Vision con OCR ──────────────────────────

      // Descargar la imagen desde Cloudinary como base64
      const imageUrl = imported.rawInput;
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) throw new Error(`No se pudo descargar la imagen: ${imageRes.status}`);

      const buffer = await imageRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = imageRes.headers.get('content-type') ?? 'image/jpeg';
      const mediaType = (contentType.split(';')[0].trim()) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

      const response = await claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
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

      const raw = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      extractedData = mapExtracted(JSON.parse(cleaned));

    } else {
      // ── Texto / link → solo texto ──────────────────────────────────────────
      const content = imported.sourceType === 'link'
        ? `Se compartió este link de red social: ${imported.rawInput}\n\nNo puedes acceder a la URL, pero intentá inferir lo que puedas del propio link (nombre del grupo, palabras clave, etc.).`
        : imported.rawInput;

      const response = await claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        system: EXTRACTION_PROMPT,
        messages: [
          { role: 'user', content },
        ],
      });

      const raw = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      extractedData = mapExtracted(JSON.parse(cleaned));
    }

    // Para screenshots/fotos bajamos el umbral: el usuario lo subió intencionalmente
    const isScreenshot = imported.sourceType === 'screenshot' || imported.sourceType === 'photo';
    const threshold    = isScreenshot ? 0.1 : 0.3;
    const isUsable     = extractedData.confidence > threshold;

    await prisma.importedSocialCase.update({
      where: { id: importedCaseId },
      data: {
        extractedData: extractedData as object,
        status: isUsable ? 'processed' : 'rejected',
      },
    });

    // ── Auto-crear avistamiento SIEMPRE que haya info útil ───────────────────
    // Antes se bloqueaba si no había ciudad/coords — ahora siempre se crea
    if (isUsable) {
      const loc       = extractedData.location;
      const hasCoords = loc && loc.lat !== 0 && loc.lng !== 0;

      // Fotos: screenshots/photos ya están en Cloudinary
      const photos = isScreenshot ? [imported.rawInput] : [];

      // Coordenadas: usar las de la IA, o fallback a centro de Argentina si no hay
      const lat = hasCoords ? loc!.lat : -38.4161;
      const lng = hasCoords ? loc!.lng : -63.6167;

      // Ciudad: usar la extraída o marcar como "Sin ubicación"
      const city = loc?.city ?? (hasCoords ? undefined : 'Sin ubicación especificada');

      const sighting = await prisma.sighting.create({
        data: {
          reporterId:      imported.submittedById,
          locationLat:     lat,
          locationLng:     lng,
          locationAddress: loc?.address,
          locationCity:    city,
          seenAt:          imported.createdAt, // siempre usar fecha de hoy, no lo que diga el post
          photos,
          description:     extractedData.description,
          source:          'social_import',
          importedCaseId:  imported.id,
        },
      });

      console.log(`[ingest] Avistamiento creado: ${sighting.id} (confianza: ${extractedData.confidence}, ciudad: ${city ?? 'sin ciudad'})`);
    }

    console.log(`[ingest] Caso ${importedCaseId} procesado con Claude. Confianza: ${extractedData.confidence}`);

  } catch (err) {
    console.error(`[ingest] Error procesando caso ${importedCaseId}:`, err);
    await prisma.importedSocialCase.update({
      where: { id: importedCaseId },
      data: { status: 'rejected' },
    });
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
