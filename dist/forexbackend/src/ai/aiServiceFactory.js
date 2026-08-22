"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiAnalysisService = void 0;
const env_1 = require("../config/env");
const aiAnalysisService_1 = require("./aiAnalysisService");
const aiProvider_1 = require("./aiProvider");
function buildService() {
    const providers = [];
    if (env_1.env.aiApiKey) {
        providers.push(new aiProvider_1.OpenAICompatibleProvider({
            name: 'primary-ai',
            apiKey: env_1.env.aiApiKey,
            endpoint: env_1.env.aiApiUrl ?? 'https://api.openai.com/v1/chat/completions',
            model: env_1.env.aiModel ?? 'gpt-4o-mini',
        }));
    }
    if (env_1.env.aiFallbackApiKey) {
        providers.push(new aiProvider_1.OpenAICompatibleProvider({
            name: 'fallback-ai',
            apiKey: env_1.env.aiFallbackApiKey,
            endpoint: env_1.env.aiFallbackApiUrl ?? 'https://api.openai.com/v1/chat/completions',
            model: env_1.env.aiFallbackModel ?? env_1.env.aiModel ?? 'gpt-4o-mini',
        }));
    }
    return new aiAnalysisService_1.AiAnalysisService(providers);
}
exports.aiAnalysisService = buildService();
//# sourceMappingURL=aiServiceFactory.js.map