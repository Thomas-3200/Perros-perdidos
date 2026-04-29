/**
 * Workers BullMQ — procesan los jobs asíncronos de IA.
 * Arrancar con: tsx src/workers.ts (proceso separado del servidor HTTP)
 */
import { Worker, type Job } from 'bullmq';
import {
  redisConnection,
  type MatchingJobData,
  type IngestJobData,
  type NotifyJobData,
} from './lib/queue.js';
import { processSighting } from '@perros/ai';
import { parseImportedCase } from '@perros/ai';
import prisma from '@perros/db';
import { enqueueNotification } from './lib/queue.js';
import { CONFIDENCE_THRESHOLDS } from '@perros/shared';

// ─── Worker de matching ───────────────────────────────────────────────────────
export const matchingWorker = new Worker(
  'matching',
  async (job: Job<MatchingJobData>) => {
    const { sightingId } = job.data;
    let results: Awaited<ReturnType<typeof processSighting>> = [];

    try {
      results = await processSighting(sightingId);
    } catch (err) {
      console.error(`[worker:matching] Error procesando sighting ${sightingId}:`, err);
      return [];
    }

    for (const result of results) {
      if (result.confidenceLevel === 'high') {
        const lostCase = await prisma.lostCase.findUnique({
          where:   { id: result.lostCaseId },
          include: { dog: true },
        });
        if (lostCase) {
          await enqueueNotification({
            userId: lostCase.ownerId,
            type:   'match_high',
            title:  `🐾 ¡Posible avistamiento de ${lostCase.dog.name}!`,
            body:   `Coincidencia con ${Math.round(result.totalScore * 100)}% de similitud.${result.aiEnhanced ? ' (IA)' : ''}`,
            data:   { lostCaseId: result.lostCaseId, sightingId },
          });
        }
      }
    }

    console.log(`[worker:matching] ${results.length} matches para sighting ${sightingId}`);
    return results;
  },
  { connection: redisConnection, concurrency: 3 },
);

// ─── Worker de ingesta ────────────────────────────────────────────────────────
export const ingestWorker = new Worker(
  'ingest',
  async (job: Job<IngestJobData>) => {
    const { importedCaseId } = job.data;
    await parseImportedCase(importedCaseId);
    console.log(`[worker:ingest] Caso ${importedCaseId} procesado`);
  },
  { connection: redisConnection, concurrency: 5 },
);

// ─── Worker de notificaciones ─────────────────────────────────────────────────
export const notifyWorker = new Worker(
  'notify',
  async (job: Job<NotifyJobData>) => {
    const { userId, type, title, body, data } = job.data;
    await prisma.notification.create({
      data: { userId, type: type as never, title, body, data: data ?? {}, read: false },
    });
    console.log(`[worker:notify] Notificación para user ${userId}: ${title}`);
  },
  { connection: redisConnection, concurrency: 10 },
);

for (const worker of [matchingWorker, ingestWorker, notifyWorker]) {
  worker.on('failed', (job, err) => console.error(`[worker] Job ${job?.id} falló:`, err.message));
  worker.on('completed', (job) => console.log(`[worker] Job ${job.id} completado`));
}

console.log('⚙️  Workers BullMQ arrancados: matching | ingest | notify');
