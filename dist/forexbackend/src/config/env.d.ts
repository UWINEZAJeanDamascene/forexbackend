/**
 * Centralized environment configuration.
 *
 * IMPORTANT: This module is backend-only. Nothing exported from here should
 * ever be imported by frontend code. Secrets (API keys, DB credentials) must
 * never cross into client-bundled code.
 */
export interface EnvConfig {
    port: number;
    frontendUrl: string;
    nodeEnv: 'development' | 'production' | 'test';
    databaseUrl: string | undefined;
    twelveDataApiKey: string | undefined;
    finnhubApiKey: string | undefined;
    aiApiKey: string | undefined;
    aiApiUrl: string | undefined;
    aiModel: string | undefined;
    aiFallbackApiKey: string | undefined;
    aiFallbackApiUrl: string | undefined;
    aiFallbackModel: string | undefined;
}
export declare function getEnv(): EnvConfig;
export declare function logEnvStatus(config: EnvConfig): void;
export declare const env: EnvConfig;
