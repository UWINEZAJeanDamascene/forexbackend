import { AnalysisContext, AiAnalysisResponse } from '../../../shared/types/aiAnalysis';
import { AiProvider } from './aiProvider';
/**
 * Keep the AI request faithful to the deterministic panels without sending
 * historical arrays or implementation-only payloads to the provider.
 */
export declare function buildAiPromptContext(context: AnalysisContext): Record<string, unknown>;
export interface AiUsageStats {
    requests: number;
    providerAttempts: number;
    cacheHits: number;
    failures: number;
    lastRequestAt: string | null;
}
export declare class AiAnalysisService {
    private readonly providers;
    private readonly cache;
    private readonly usage;
    constructor(providers: AiProvider[]);
    getUsage(): AiUsageStats;
    explain(context: AnalysisContext): Promise<AiAnalysisResponse>;
    private generateWithFallback;
    private unavailable;
}
