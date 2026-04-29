/**
 * Parser de casos importados desde redes sociales (Human API).
 *
 * Entrada: link, screenshot, foto o texto
 * Salida:  ExtractedCaseData estructurado
 *
 * Usa GPT-4o para:
 * - OCR de screenshots
 * - Extracción de entidades (fecha, ubicación, descripción, fotos, contacto)
 * - Clasificación: ¿es un perro PERDIDO o ENCONTRADO?
 */
import OpenAI from 'openai';
import prisma from '@perros/db';
import type { ExtractedCaseData } from '@perros/shared';

let _openai: OpenAI | null = null;
const getOpenAI = () => { if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? 'placeholder' }); return _openai; };

const EXTRACTION_PROMPT = `Eres un asistente especializado en analizar publicaciones sobre perros perdidos.

Analiza el contenido provisto (puede ser texto de un post, un screenshot, o una URL) y extrae la información relevante.

Responde SOLO con JSON válido siguiendo esta estructura exacta:
{
  "caseType": "lost|found|unknown",
  "description": "descripción del perro",
  "location": {
    "address": "dirección si la hay",
    "city": "ciudad",
    "country": "país"
  },
  "seenAt": "fecha en ISO 8601 si se puede inferir, o null",
  "contactInfo": "teléfono/email/usuario de red social del contacto",
  "reward": número en moneda local o null,
  "dogAttributes": {
    "breed": "raza o null",
    "color": ["colores"],
    "size": "small|medium|large|extra_large o null"
  },
  "confidence": número entre 0 y 1 indicando confianza de la extracción
}

Si el contenido no tiene relación con perros perdidos o encontrados, pon confidence: 0 y caseType: "unknown".`;

export async function parseImportedCase(importedCaseId: string): Promise<void> {
  const imported = await prisma.importedSocialCase.findUniqueOrThrow({
    where: { id: importedCaseId },
  });

  let extractedData: ExtractedCaseData;

  try {
    if (imported.sourceType === 'screenshot' || imported.sourceType === 'photo') {
      // Imagen → GPT-4o Vision con OCR
      const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imported.rawInput, detail: 'high' },
              },
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
        max_tokens: 600,
        temperature: 0,
      });
      const raw = response.choices[0]?.message?.content ?? '{}';
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      extractedData = mapExtracted(JSON.parse(cleaned));

    } else {
      // Texto / link → contexto solo texto
      const content = imported.sourceType === 'link'
        ? `URL del post: ${imported.rawInput}\n\nExtrae la información disponible solo de la URL (sin acceder a ella).`
        : imported.rawInput;

      const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user',   content },
        ],
        max_tokens: 600,
        temperature: 0,
      });
      const raw = response.choices[0]?.message?.content ?? '{}';
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      extractedData = mapExtracted(JSON.parse(cleaned));
    }

    await prisma.importedSocialCase.update({
      where: { id: importedCaseId },
      data: {
        extractedData: extractedData as object,
        status: extractedData.confidence > 0.3 ? 'processed' : 'rejected',
      },
    });

    console.log(`[ingest] Caso ${importedCaseId} procesado. Confianza: ${extractedData.confidence}`);

  } catch (err) {
    console.error(`[ingest] Error procesando caso ${importedCaseId}:`, err);
    await prisma.importedSocialCase.update({
      where: { id: importedCaseId },
      data: { status: 'rejected' },
    });
  }
}

// ─── Mapea la respuesta cruda de la IA a ExtractedCaseData ───────────────────
function mapExtracted(raw: Record<string, unknown>): ExtractedCaseData {
  return {
    description:   raw.description as string | undefined,
    location:      raw.location as ExtractedCaseData['location'] | undefined,
    seenAt:        raw.seenAt ? new Date(raw.seenAt as string) : undefined,
    photos:        [],
    contactInfo:   raw.contactInfo as string | undefined,
    reward:        raw.reward as number | undefined,
    dogAttributes: raw.dogAttributes as ExtractedCaseData['dogAttributes'] | undefined,
    confidence:    Number(raw.confidence ?? 0),
  };
}
