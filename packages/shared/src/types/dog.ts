// ─── Perfil de perro ──────────────────────────────────────────────────────────

export type DogSize = 'small' | 'medium' | 'large' | 'extra_large';
export type DogSex  = 'male' | 'female' | 'unknown';

export interface Dog {
  id: string;
  ownerId: string;
  name: string;
  breed?: string;          // Raza (puede ser mixta)
  color: string[];         // Ej: ['brown', 'white']
  size: DogSize;
  age?: number;            // Años aprox.
  sex: DogSex;
  neutered?: boolean;
  microchipId?: string;
  photos: string[];        // URLs de Cloudinary
  description?: string;   // Señas particulares
  qrCodeId?: string;       // Vinculado a qr_profiles (futuro)
  createdAt: Date;
  updatedAt: Date;
}

export interface DogAttributes {
  breed?: string;
  color: string[];
  size: DogSize;
  sex: DogSex;
  distinguishingFeatures?: string[]; // Ej: ['manchas negras', 'oreja caída']
}
