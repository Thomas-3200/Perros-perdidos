// ─── Historia de reunificación ────────────────────────────────────────────────

export interface ReunionStory {
  id: string;
  lostCaseId: string;
  ownerId: string;
  photos: string[];
  videoUrl?: string;
  storyText?: string;          // Escrito por el dueño
  aiGeneratedStory?: string;   // Generado por Claude
  published: boolean;          // Visible en el feed público
  publishedAt?: Date;
  createdAt: Date;
}

// ─── Sesión de apoyo emocional ────────────────────────────────────────────────

export interface SupportMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SupportSession {
  id: string;
  userId: string;
  lostCaseId: string;
  messages: SupportMessage[];
  startedAt: Date;
  lastActiveAt: Date;
}

// ─── Contribución comunitaria ─────────────────────────────────────────────────

export type ContributionType = 'sighting' | 'social_import' | 'helper_mode' | 'reunion_share';

export interface Contribution {
  id: string;
  userId: string;
  type: ContributionType;
  caseId?: string;
  pointsEarned: number;
  createdAt: Date;
}

// ─── Socio (refugio, vet, rescatista) ────────────────────────────────────────

export type PartnerType = 'shelter' | 'vet' | 'rescuer' | 'ngo';

export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  location: import('./user.js').GeoPoint;
  contact: string;
  verified: boolean;
  dogsCurrentlyHolding: string[]; // IDs de perros
  createdAt: Date;
}
