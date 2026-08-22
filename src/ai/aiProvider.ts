export interface AiGenerationInput {
  systemPrompt: string;
  userPrompt: string;
}

export interface AiProvider {
  readonly name: string;
  generate(input: AiGenerationInput): Promise<string>;
}

export class AiProviderError extends Error {
  readonly kind: 'timeout' | 'rate_limit' | 'provider_error' | 'malformed_response';

  constructor(kind: AiProviderError['kind'], message: string) {
    super(message);
    this.name = 'AiProviderError';
    this.kind = kind;
  }
}

interface OpenAICompatibleProviderOptions {
  name: string;
  apiKey: string;
  endpoint: string;
  model: string;
  timeoutMs?: number;
}

/** Provider adapter for OpenAI-compatible chat-completions APIs. */
export class OpenAICompatibleProvider implements AiProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.name = options.name;
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint;
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  async generate(input: AiGenerationInput): Promise<string> {
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

      if (response.status === 429) throw new AiProviderError('rate_limit', `${this.name} rate limit`);
      if (!response.ok) throw new AiProviderError('provider_error', `${this.name} returned HTTP ${response.status}`);

      const body: unknown = await response.json();
      const choice = body && typeof body === 'object' && 'choices' in body
        ? (body as {
          choices?: Array<{
            text?: unknown;
            message?: { content?: unknown };
          }>;
        }).choices?.[0]
        : undefined;
      const rawContent = choice?.message?.content ?? choice?.text;
      const content = typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent
            .map((part) => part && typeof part === 'object' && 'text' in part ? (part as { text?: unknown }).text : part)
            .filter((part): part is string => typeof part === 'string')
            .join('')
          : '';
      if (content.trim().length === 0) {
        throw new AiProviderError('malformed_response', `${this.name} returned no text`);
      }
      return content.trim();
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiProviderError('timeout', `${this.name} timed out`);
      }
      throw new AiProviderError('provider_error', `${this.name} request failed`);
    } finally {
      clearTimeout(timer);
    }
  }
}
