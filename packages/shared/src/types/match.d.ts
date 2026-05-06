export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type MatchStatus = 'pending' | 'confirmed' | 'rejected';
export interface Match {
    id: string;
    lostCaseId: string;
    sightingId: string;
    visualScore: number;
    geoScore: number;
    timeScore: number;
    attributeScore: number;
    totalScore: number;
    confidenceLevel: ConfidenceLevel;
    status: MatchStatus;
    reviewedBy?: string;
    reviewedAt?: Date;
    ownerConfirmedAt?: Date;
    createdAt: Date;
}
export declare const MATCH_WEIGHTS: {
    readonly visual: 0.5;
    readonly geo: 0.25;
    readonly time: 0.15;
    readonly attribute: 0.1;
};
export declare const CONFIDENCE_THRESHOLDS: {
    readonly high: 0.85;
    readonly medium: 0.65;
};
export declare const MAX_DAILY_NOTIFICATIONS = 5;
//# sourceMappingURL=match.d.ts.map