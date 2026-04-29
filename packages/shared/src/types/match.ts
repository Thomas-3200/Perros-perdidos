// ─── Resultado del motor de matching ─────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type MatchStatus     = 'pending' | 'confirmed' | 'rejected';

export interface Match {
  id: string;
  lostCaseId: string;
  sightingId: string;

  // Scores individuales (0-1 cada uno)
  visualScore:    number;   // Similitud visual CLIP embedding (peso 50%)
  geoScore:       number;   // Proximidad geográfica normalizada (peso 25%)
  timeScore:      number;   // Proximidad temporal normalizada (peso 15%)
  attributeScore: number;   // Raza, color, tamaño (peso 10%)
  totalScore:     number;   // Score combinado final (0-1)

  confidenceLevel: ConfidenceLevel;
  status: MatchStatus;

  reviewedBy?: string;      // User ID del moderador
  reviewedAt?: Date;
  ownerConfirmedAt?: Date;

  createdAt: Date;
}

// ─── Pesos del scoring (configurables) ───────────────────────────────────────
export const MATCH_WEIGHTS = {
  visual:    0.50,
  geo:       0.25,
  time:      0.15,
  attribute: 0.10,
} as const;

// ─── Umbrales de confianza ────────────────────────────────────────────────────
export const CONFIDENCE_THRESHOLDS = {
  high:   0.85,   // Notificación directa al dueño
  medium: 0.65,   // Revisión humana antes de notificar
  // < 0.65 → LOW: archivado silencioso
} as const;

export const MAX_DAILY_NOTIFICATIONS = 5; // Anti-fatiga para el dueño
