"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAICompatibleProvider = exports.AiProviderError = void 0;
class AiProviderError extends Error {
    kind;
    constructor(kind, message) {
        super(message);
        this.name = 'AiProviderError';
        this.kind = kind;
    }
}
exports.AiProviderError = AiProviderError;
/** Provider adapter for OpenAI-compatible chat-completions APIs. */
class OpenAICompatibleProvider {
    name;
    apiKey;
    endpoint;
    model;
    timeoutMs;
    constructor(options) {
        this.name = options.name;
        this.apiKey = options.apiKey;
        this.endpoint = options.endpoint;
        this.model = options.model;
        this.timeoutMs = options.timeoutMs ?? 20_000;
    }
    async generate(input) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const isGroqGptOss = this.endpoint.includes('api.groq.com') && this.model.startsWith('openai/gpt-oss-');
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    temperature: 0.2,
                    max_completion_tokens: 4096,
                    ...(isGroqGptOss ? { reasoning_effort: 'low', include_reasoning: false } : {}),
                    messages: [
                        { role: 'system', content: input.systemPrompt },
                        { role: 'user', content: input.userPrompt },
                    ],
                }),
                signal: controller.signal,
            });
            if (response.status === 429)
                throw new AiProviderError('rate_limit', `${this.name} rate limit`);
            if (!response.ok)
                throw new AiProviderError('provider_error', `${this.name} returned HTTP ${response.status}`);
            const body = await response.json();
            const choice = body && typeof body === 'object' && 'choices' in body
                ? body.choices?.[0]
                : undefined;
            const rawContent = choice?.message?.content ?? choice?.text;
            const content = typeof rawContent === 'string'
                ? rawContent
                : Array.isArray(rawContent)
                    ? rawContent
                        .map((part) => part && typeof part === 'object' && 'text' in part ? part.text : part)
                        .filter((part) => typeof part === 'string')
                        .join('')
                    : '';
            if (content.trim().length === 0) {
                throw new AiProviderError('malformed_response', `${this.name} returned no text`);
            }
            return content.trim();
        }
        catch (error) {
            if (error instanceof AiProviderError)
                throw error;
            if (error instanceof Error && error.name === 'AbortError') {
                throw new AiProviderError('timeout', `${this.name} timed out`);
            }
            throw new AiProviderError('provider_error', `${this.name} request failed`);
        }
        finally {
            clearTimeout(timer);
        }
    }
}
exports.OpenAICompatibleProvider = OpenAICompatibleProvider;
//# sourceMappingURL=aiProvider.js.map