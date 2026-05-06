import { type ConfidenceLevel } from '@perros/shared';
export interface MatchResult {
    lostCaseId: string;
    sightingId: string;
    totalScore: number;
    confidenceLevel: ConfidenceLevel;
    aiEnhanced: boolean;
    breakdown: {
        visual: number;
        geo: number;
        time: number;
        attribute: number;
    };
}
export declare function processSighting(sightingId: string): Promise<MatchResult[]>;
//# sourceMappingURL=matching.d.ts.map