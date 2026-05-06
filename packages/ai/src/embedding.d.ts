export interface DogAttributesFromImage {
    breed?: string;
    colors: string[];
    size?: 'small' | 'medium' | 'large' | 'extra_large';
    sex?: 'male' | 'female';
    distinguishingFeatures: string[];
    hasDogDetected: boolean;
    confidence: number;
}
export declare function extractDogAttributesFromImage(imageUrl: string): Promise<DogAttributesFromImage>;
export declare function generateImageEmbedding(imageUrl: string): Promise<number[]>;
export declare function cosineSimilarity(a: number[], b: number[]): number;
//# sourceMappingURL=embedding.d.ts.map