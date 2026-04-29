import type { GeoPoint } from './user.js';

// ─── Caso de perro perdido ────────────────────────────────────────────────────

export type LostCaseStatus = 'active' | 'found' | 'closed';
export type ContactMethod  = 'phone' | 'whatsapp' | 'email' | 'in_app';

export interface LostCase {
  id: string;
  dogId: string;
  ownerId: string;
  status: LostCaseStatus;
  lastSeenLocation: GeoPoint;
  lastSeenAt: Date;
  reward?: number;
  rewardCurrency?: string;   // 'ARS', 'USD', 'MXN', etc.
  behaviorNotes?: string;    // "Asustadizo, responde al nombre Max"
  contactMethod: ContactMethod;
  contactValue: string;      // Número, email, etc.
  searchRadiusKm: number;    // Radio de búsqueda activo
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

// ─── Avistamiento ─────────────────────────────────────────────────────────────

export type DogSightingStatus =
  | 'still_there'   // Sigue en el lugar
  | 'gone'          // Ya no estaba
  | 'retained'      // Lo tiene el reportador
  | 'injured'       // Herido
  | 'unknown';

export type SightingSource = 'app' | 'social_import';

export interface Sighting {
  id: string;
  reporterId: string;
  location: GeoPoint;
  seenAt: Date;
  photos: string[];
  dogStatus: DogSightingStatus;
  description?: string;
  source: SightingSource;
  importedCaseId?: string;   // Si viene de Human API
  createdAt: Date;
}

// ─── Caso importado desde redes sociales (Human API) ─────────────────────────

export type ImportedCaseSourceType = 'link' | 'screenshot' | 'photo' | 'text';
export type ImportedCaseStatus     = 'pending' | 'processed' | 'rejected';

export interface ImportedSocialCase {
  id: string;
  submittedBy: string;
  sourceType: ImportedCaseSourceType;
  rawInput: string;           // URL, texto, o path de imagen
  extractedData?: ExtractedCaseData;
  status: ImportedCaseStatus;
  createdCaseId?: string;     // ID del sighting o lost_case generado
  createdAt: Date;
}

export interface ExtractedCaseData {
  description?: string;
  location?: GeoPoint;
  seenAt?: Date;
  photos?: string[];
  contactInfo?: string;
  reward?: number;
  dogAttributes?: {
    breed?: string;
    color?: string[];
    size?: string;
  };
  confidence: number;          // 0-1, qué tan segura está la IA de la extracción
}
