/**
 * Colas BullMQ para jobs asíncronos:
 * - matching: procesar embeddings + buscar matches cuando llega un avistamiento
 * - ingest: parsear casos importados de redes sociales con IA
 * - notify: enviar notificaciones push
 */
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

const redisConnection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  lazyConnect: true,
});

// Evitar que ECONNRESET crashee el proceso
redisConnection.on('error', (err) => {
  console.warn('[redis] Conexión error (no fatal):', err.message);
});

// ─── Definición de colas ──────────────────────────────────────────────────────

export const matchingQueue = new Queue('matching', { connection: redisConnection });
export const ingestQueue   = new Queue('ingest',   { connection: redisConnection });
export const notifyQueue   = new Queue('notify',   { connection: redisConnection });

// ─── Tipos de jobs ────────────────────────────────────────────────────────────

export interface MatchingJobData {
  sightingId: string;
}

export interface IngestJobData {
  importedCaseId: string;
}

export interface NotifyJobData {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// ─── Helpers para encolar jobs ────────────────────────────────────────────────

export async function enqueueMatching(sightingId: string) {
  return matchingQueue.add('process-sighting', { sightingId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
}

export async function enqueueIngest(importedCaseId: string) {
  return ingestQueue.add('parse-social-case', { importedCaseId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
  });
}

export async function enqueueNotification(data: NotifyJobData) {
  return notifyQueue.add('send-push', data, {
    attempts: 5,
    backoff: { type: 'fixed', delay: 1000 },
  });
}

export { redisConnection };
