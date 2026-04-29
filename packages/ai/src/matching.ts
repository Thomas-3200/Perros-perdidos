/**
 * Motor de matching multimodal.
 *
 * Pipeline AI (cuando hay API keys):
 *   embedding visual → extracción de atributos GPT-4o → score combinado
 *
 * Pipeline básico (fallback sin IA):
 *   geo + tiempo + similitud textual de atributos
 *
 * Pesos básicos (sin IA): geo 40% | tiempo 20% | atributos 40%
 * Pesos con IA:           visual 50% | geo 25% | tiempo 15% | atributos 10%
 */
import prisma from '@perros/db';
import {
  haversineKm,
  geoScoreFromKm,
  timeScoreFromDays,
  attributeScore,
  MATCH_WEIGHTS,
  CONFIDENCE_THRESHOLDS,
  type ConfidenceLevel,
} from '@perros/shared';
import { generateImageEmbedding, cosineSimilarity, extractDogAttributesFromImage } from './embedding.js';

export interface MatchResult {
  lostCaseId:      string;
  sightingId:      string;
  totalScore:      number;
  confidenceLevel: ConfidenceLevel;
  aiEnhanced:      boolean;
  breakdown: {
    visual:    number;
    geo:       number;
    time:      number;
    attribute: number;
  };
}

// Palabras clave por tamaño para matching textual
const SIZE_KEYWORDS: Record<string, string[]> = {
  small:       ['pequeño', 'chico', 'mini', 'toy', 'pequeña', 'chica'],
  medium:      ['mediano', 'mediana', 'medio'],
  large:       ['grande', 'grandote', 'grandes'],
  extra_large: ['muy grande', 'enorme', 'gigante'],
};

// Lista plana de todas las palabras de tamaño (para detectar si la descripción menciona tamaño)
const ALL_SIZE_KWS = (Object.values(SIZE_KEYWORDS) as string[][]).flat();

// Vocabulario de colores en español para detectar si la descripción menciona un color
const COLOR_VOCAB = [
  'negro', 'negra', 'negros', 'negras',
  'blanco', 'blanca', 'blancos', 'blancas',
  'marron', 'marrón', 'cafe', 'café',
  'dorado', 'dorada', 'naranja', 'gris',
  'rojo', 'roja', 'amarillo', 'amarilla',
  'beige', 'crema', 'tricolor', 'bicolor',
  'manchado', 'manchada', 'canela', 'arena',
  'tostado', 'tostada',
];

// ─── Helpers de logging ───────────────────────────────────────────────────────

const pct = (n: number) => `${Math.round(n * 100)}%`;
const fmt = (v: boolean | null) => v === null ? 'null' : v ? 'true' : 'false';

// ─── Matching básico (sin IA) ─────────────────────────────────────────────────

async function basicProcessSighting(sightingId: string): Promise<MatchResult[]> {
  const sighting = await prisma.sighting.findUniqueOrThrow({
    where: { id: sightingId },
  });

  const activeCases = await prisma.lostCase.findMany({
    where: { status: 'active' },
    include: { dog: true },
  });

  const desc = (sighting.description ?? '').toLowerCase();

  const nearbyCases = activeCases.filter(c => {
    const dist = haversineKm(
      sighting.locationLat, sighting.locationLng,
      c.lastSeenLat, c.lastSeenLng,
    );
    return dist <= c.searchRadiusKm;
  });

  const results: MatchResult[] = [];

  for (const lostCase of nearbyCases) {
    const distKm = haversineKm(
      sighting.locationLat, sighting.locationLng,
      lostCase.lastSeenLat, lostCase.lastSeenLng,
    );
    const geo  = geoScoreFromKm(distKm, lostCase.searchRadiusKm);
    const daysDiff = Math.abs(
      (sighting.seenAt.getTime() - lostCase.lastSeenAt.getTime()) / 86_400_000,
    );
    const time = timeScoreFromDays(daysDiff);

    // Matching textual: busca raza, colores y tamaño en la descripción del avistamiento.
    //
    // Regla clave: un atributo es `null` (neutro) cuando no está mencionado en la
    // descripción, NO `false` (penalización). Un reporte "vi un perro en el parque"
    // no contradice que sea un labrador blanco grande — el reportero no lo describió.
    // Solo marcamos `false` cuando hay una mención EXPLÍCITA que contradice el atributo.
    const hasDesc = desc.trim().length > 0;

    // Breed: true si aparece en la descripción, null en todos los demás casos.
    // Ausencia de mención de raza ≠ raza incorrecta.
    const breedMatch: boolean | null = (hasDesc && lostCase.dog.breed &&
      desc.includes(lostCase.dog.breed.toLowerCase()))
      ? true
      : null;

    // Color: evaluamos solo si la descripción menciona algún color conocido.
    // Si no hay ningún color en el texto, no podemos concluir nada → null.
    const descHasColor = hasDesc && COLOR_VOCAB.some(w => desc.includes(w));
    const colorMatch: boolean | null = (descHasColor && lostCase.dog.color.length > 0)
      ? lostCase.dog.color.some(c => desc.includes(c.toLowerCase()))
      : null;

    // Size: evaluamos solo si la descripción menciona alguna palabra de tamaño.
    // "vi un perro perdido" no contradice que sea grande → null.
    const descHasSize = hasDesc && ALL_SIZE_KWS.some(kw => desc.includes(kw));
    const sizeKws = SIZE_KEYWORDS[lostCase.dog.size] ?? [];
    const sizeMatch: boolean | null = (descHasSize && sizeKws.length > 0)
      ? sizeKws.some(kw => desc.includes(kw))
      : null;

    const attrScore = attributeScore({ breedMatch, sizeMatch, colorMatch });

    // Pesos sin IA: geo 40% | tiempo 20% | atributos 40%
    const total = geo * 0.40 + time * 0.20 + attrScore * 0.40;

    const confidence: ConfidenceLevel =
      total >= CONFIDENCE_THRESHOLDS.high   ? 'high'   :
      total >= CONFIDENCE_THRESHOLDS.medium ? 'medium' : 'low';

    // Log explainable por cada candidato evaluado (incluye casos LOW para debug)
    const capNote = colorMatch === false ? ' [CAP:color-mismatch]' : '';
    console.log(
      `[match:eval] sighting=${sightingId} case=${lostCase.id} dog="${lostCase.dog.name}"` +
      ` | geo=${pct(geo)} time=${pct(time)} attr=${pct(attrScore)}` +
      ` (breed:${fmt(breedMatch)} color:${fmt(colorMatch)} size:${fmt(sizeMatch)})` +
      `${capNote} | total=${pct(total)} -> ${confidence.toUpperCase()}`,
    );

    if (confidence === 'low') continue;

    await prisma.match.upsert({
      where:  { lostCaseId_sightingId: { lostCaseId: lostCase.id, sightingId } },
      update: { geoScore: geo, timeScore: time, attributeScore: attrScore, totalScore: total, confidenceLevel: confidence },
      create: {
        lostCaseId:     lostCase.id,
        sightingId,
        visualScore:    0,
        geoScore:       geo,
        timeScore:      time,
        attributeScore: attrScore,
        totalScore:     total,
        confidenceLevel: confidence,
        status:         'pending',
      },
    });

    results.push({
      lostCaseId:      lostCase.id,
      sightingId,
      totalScore:      total,
      confidenceLevel: confidence,
      aiEnhanced:      false,
      breakdown:       { visual: 0, geo, time, attribute: attrScore },
    });
  }

  console.log(`[matching:basic] Sighting ${sightingId}: ${results.length} match(es) guardados (${nearbyCases.length} casos evaluados)`);
  return results;
}

// ─── Matching con IA (cuando las API keys están disponibles) ──────────────────

async function aiProcessSighting(sightingId: string): Promise<MatchResult[]> {
  const sighting = await prisma.sighting.findUniqueOrThrow({ where: { id: sightingId } });
  if (sighting.photos.length === 0) throw new Error('No hay fotos para procesar con IA');

  const sightingEmbedding = await generateImageEmbedding(sighting.photos[0]!);
  const sightingAttrs     = await extractDogAttributesFromImage(sighting.photos[0]!);

  if (!sightingAttrs.hasDogDetected) {
    console.warn(`[matching:ai] No se detectó perro en sighting ${sightingId}`);
    return [];
  }

  const activeCases = await prisma.lostCase.findMany({
    where: { status: 'active' },
    include: { dog: true },
  });

  const nearbyCases = activeCases.filter(c => {
    const dist = haversineKm(
      sighting.locationLat, sighting.locationLng,
      c.lastSeenLat, c.lastSeenLng,
    );
    return dist <= c.searchRadiusKm;
  });

  const results: MatchResult[] = [];

  for (const lostCase of nearbyCases) {
    if (lostCase.dog.photos.length === 0) continue;

    const caseEmbedding = await generateImageEmbedding(lostCase.dog.photos[0]!);
    const visual = cosineSimilarity(sightingEmbedding, caseEmbedding);

    const distKm = haversineKm(
      sighting.locationLat, sighting.locationLng,
      lostCase.lastSeenLat, lostCase.lastSeenLng,
    );
    const geo  = geoScoreFromKm(distKm, lostCase.searchRadiusKm);
    const daysDiff = Math.abs(
      (sighting.seenAt.getTime() - lostCase.lastSeenAt.getTime()) / 86_400_000,
    );
    const time = timeScoreFromDays(daysDiff);

    const caseAttrs = await extractDogAttributesFromImage(lostCase.dog.photos[0]!);
    const attrScore = attributeScore({
      breedMatch: caseAttrs.breed && sightingAttrs.breed
        ? caseAttrs.breed.toLowerCase().includes(sightingAttrs.breed.toLowerCase())
        : null,
      sizeMatch:  caseAttrs.size && sightingAttrs.size
        ? caseAttrs.size === sightingAttrs.size
        : null,
      colorMatch: caseAttrs.colors.length > 0 && sightingAttrs.colors.length > 0
        ? caseAttrs.colors.some(c => sightingAttrs.colors.includes(c))
        : null,
    });

    const total =
      visual    * MATCH_WEIGHTS.visual    +
      geo       * MATCH_WEIGHTS.geo       +
      time      * MATCH_WEIGHTS.time      +
      attrScore * MATCH_WEIGHTS.attribute;

    const confidence: ConfidenceLevel =
      total >= CONFIDENCE_THRESHOLDS.high   ? 'high'   :
      total >= CONFIDENCE_THRESHOLDS.medium ? 'medium' : 'low';

    if (confidence === 'low') continue;

    await prisma.match.upsert({
      where:  { lostCaseId_sightingId: { lostCaseId: lostCase.id, sightingId } },
      update: { visualScore: visual, geoScore: geo, timeScore: time, attributeScore: attrScore, totalScore: total, confidenceLevel: confidence },
      create: {
        lostCaseId:      lostCase.id,
        sightingId,
        visualScore:     visual,
        geoScore:        geo,
        timeScore:       time,
        attributeScore:  attrScore,
        totalScore:      total,
        confidenceLevel: confidence,
        status:          'pending',
      },
    });

    results.push({
      lostCaseId:      lostCase.id,
      sightingId,
      totalScore:      total,
      confidenceLevel: confidence,
      aiEnhanced:      true,
      breakdown:       { visual, geo, time, attribute: attrScore },
    });
  }

  console.log(`[matching:ai] Sighting ${sightingId}: ${results.length} matches`);
  return results;
}

// ─── Entrada pública: intenta IA, cae a básico ────────────────────────────────

export async function processSighting(sightingId: string): Promise<MatchResult[]> {
  if (process.env.OPENAI_API_KEY && process.env.REPLICATE_API_TOKEN) {
    try {
      return await aiProcessSighting(sightingId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[matching] AI falló (${msg}), usando matching básico`);
    }
  }
  return basicProcessSighting(sightingId);
}
