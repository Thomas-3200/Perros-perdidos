/**
 * Re-exporta los tipos de jobs para que el package api los use.
 * Los workers reales viven en @perros/api/src/workers.ts
 * para evitar dependencia circular entre ai ↔ api.
 */
export type { MatchingJobData, IngestJobData, NotifyJobData } from '../../api/src/lib/queue.js';
