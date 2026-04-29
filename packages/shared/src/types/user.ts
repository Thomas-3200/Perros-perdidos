// ─── Roles de usuario ────────────────────────────────────────────────────────

export type UserRole =
  | 'owner'        // Dueño de perro
  | 'helper'       // Colaborador / helper
  | 'finder'       // Encontró un perro
  | 'partner'      // Refugio / vet / rescatista verificado
  | 'moderator'    // Modera casos y matches ambiguos
  | 'admin';       // Acceso total

export interface User {
  id: string;
  email: string;
  phone?: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  reputationScore: number;
  locationDefault?: GeoPoint;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  country?: string;
}
