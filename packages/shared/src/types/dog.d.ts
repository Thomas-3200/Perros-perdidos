export type DogSize = 'small' | 'medium' | 'large' | 'extra_large';
export type DogSex = 'male' | 'female' | 'unknown';
export interface Dog {
    id: string;
    ownerId: string;
    name: string;
    breed?: string;
    color: string[];
    size: DogSize;
    age?: number;
    sex: DogSex;
    neutered?: boolean;
    microchipId?: string;
    photos: string[];
    description?: string;
    qrCodeId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface DogAttributes {
    breed?: string;
    color: string[];
    size: DogSize;
    sex: DogSex;
    distinguishingFeatures?: string[];
}
//# sourceMappingURL=dog.d.ts.map