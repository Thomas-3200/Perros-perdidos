export interface ReunionStory {
    id: string;
    lostCaseId: string;
    ownerId: string;
    photos: string[];
    videoUrl?: string;
    storyText?: string;
    aiGeneratedStory?: string;
    published: boolean;
    publishedAt?: Date;
    createdAt: Date;
}
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
export type ContributionType = 'sighting' | 'social_import' | 'helper_mode' | 'reunion_share';
export interface Contribution {
    id: string;
    userId: string;
    type: ContributionType;
    caseId?: string;
    pointsEarned: number;
    createdAt: Date;
}
export type PartnerType = 'shelter' | 'vet' | 'rescuer' | 'ngo';
export interface Partner {
    id: string;
    name: string;
    type: PartnerType;
    location: import('./user.js').GeoPoint;
    contact: string;
    verified: boolean;
    dogsCurrentlyHolding: string[];
    createdAt: Date;
}
//# sourceMappingURL=reunion.d.ts.map