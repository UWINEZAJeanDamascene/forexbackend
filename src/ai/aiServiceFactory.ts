import { env } from '../config/env';
import { AiAnalysisService } from './aiAnalysisService';
import { OpenAICompatibleProvider } from './aiProvider';

function buildService(): AiAnalysisService {
  const providers: OpenAICompatibleProvider[] = [];
  if (env.aiApiKey) {
    providers.push(new OpenAICompatibleProvider({
      name: 'primary-ai',
      apiKey: env.aiApiKey,
      endpoint: env.aiApiUrl ?? 'https://api.openai.com/v1/chat/completions',
      model: env.aiModel ?? 'gpt-4o-mini',
    }));
  }
  if (env.aiFallbackApiKey) {
    providers.push(new OpenAICompatibleProvider({
      name: 'fallback-ai',
      apiKey: env.aiFallbackApiKey,
      endpoint: env.aiFallbackApiUrl ?? 'https://api.openai.com/v1/chat/completions',
      model: env.aiFallbackModel ?? env.aiModel ?? 'gpt-4o-mini',
    }));
  }
  return new AiAnalysisService(providers);
}

export const aiAnalysisService = buildService();
