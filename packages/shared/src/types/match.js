// ─── Resultado del motor de matching ─────────────────────────────────────────
// ─── Pesos del scoring (configurables) ───────────────────────────────────────
export const MATCH_WEIGHTS = {
    visual: 0.50,
    geo: 0.25,
    time: 0.15,
    attribute: 0.10,
};
// ─── Umbrales de confianza ────────────────────────────────────────────────────
export const CONFIDENCE_THRESHOLDS = {
    high: 0.85, // Notificación directa al dueño
    medium: 0.65, // Revisión humana antes de notificar
    // < 0.65 → LOW: archivado silencioso
};
export const MAX_DAILY_NOTIFICATIONS = 5; // Anti-fatiga para el dueño
//# sourceMappingURL=match.js.map