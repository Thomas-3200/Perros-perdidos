export type UserRole = 'owner' | 'helper' | 'finder' | 'partner' | 'moderator' | 'admin';
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
//# sourceMappingURL=user.d.ts.map