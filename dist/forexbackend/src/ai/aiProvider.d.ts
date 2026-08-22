export interface AiGenerationInput {
    systemPrompt: string;
    userPrompt: string;
}
export interface AiProvider {
    readonly name: string;
    generate(input: AiGenerationInput): Promise<string>;
}
export declare class AiProviderError extends Error {
    readonly kind: 'timeout' | 'rate_limit' | 'provider_error' | 'malformed_response';
    constructor(kind: AiProviderError['kind'], message: string);
}
interface OpenAICompatibleProviderOptions {
    name: string;
    apiKey: string;
    endpoint: string;
    model: string;
    timeoutMs?: number;
}
/** Provider adapter for OpenAI-compatible chat-completions APIs. */
export declare class OpenAICompatibleProvider implements AiProvider {
    readonly name: string;
    private readonly apiKey;
    private readonly endpoint;
    private readonly model;
    private readonly timeoutMs;
    constructor(options: OpenAICompatibleProviderOptions);
    generate(input: AiGenerationInput): Promise<string>;
}
export {};
