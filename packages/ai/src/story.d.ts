export interface StoryInput {
    dogName: string;
    breed: string;
    ownerName: string;
    daysMissing: number;
    city: string;
    storyText?: string;
}
export declare function generateReunionStory(input: StoryInput): Promise<string>;
//# sourceMappingURL=story.d.ts.map