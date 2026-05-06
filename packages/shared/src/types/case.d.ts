import type { GeoPoint } from './user.js';
export type LostCaseStatus = 'active' | 'found' | 'closed';
export type ContactMethod = 'phone' | 'whatsapp' | 'email' | 'in_app';
export interface LostCase {
    id: string;
    dogId: string;
    ownerId: string;
    status: LostCaseStatus;
    lastSeenLocation: GeoPoint;
    lastSeenAt: Date;
    reward?: number;
    rewardCurrency?: string;
    behaviorNotes?: string;
    contactMethod: ContactMethod;
    contactValue: string;
    searchRadiusKm: number;
    createdAt: Date;
    updatedAt: Date;
    closedAt?: Date;
}
export type DogSightingStatus = 'still_there' | 'gone' | 'retained' | 'injured' | 'unknown';
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
    importedCaseId?: string;
    createdAt: Date;
}
export type ImportedCaseSourceType = 'link' | 'screenshot' | 'photo' | 'text';
export type ImportedCaseStatus = 'pending' | 'processed' | 'rejected';
export interface ImportedSocialCase {
    id: string;
    submittedBy: string;
    sourceType: ImportedCaseSourceType;
    rawInput: string;
    extractedData?: ExtractedCaseData;
    status: ImportedCaseStatus;
    createdCaseId?: string;
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
    confidence: number;
}
//# sourceMappingURL=case.d.ts.map