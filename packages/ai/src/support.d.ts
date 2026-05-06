export interface SupportInput {
    userMessage: string;
    dogName: string;
    daysMissing: number;
    conversationHistory: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
}
export declare function emotionalSupport(input: SupportInput): Promise<string>;
//# sourceMappingURL=support.d.ts.map