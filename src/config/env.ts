import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

/**
 * The single .env file lives at the repo root (see /.env.example), not
 * inside /backend. Load it explicitly so `npm run dev` works the same way
 * whether it's invoked from the repo root or from inside /backend.
 * Falls back to a local backend/.env if present, for flexibility.
 */
function loadEnvFile(): void {
  const rootEnvPath = path.resolve(__dirname, '../../../.env');
  const localEnvPath = path.resolve(__dirname, '../../.env');

  if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
  } else if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath });
  } else {
    // No .env file yet is fine at this phase - just use defaults / OS env vars.
    dotenv.config();
  }
}

loadEnvFile();

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
  resendApiKey: string | undefined;
  authEmailFrom: string | undefined;
}

export function getEnv(): EnvConfig {
  return {
    port: Number(process.env.PORT) || 3001,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    nodeEnv: (process.env.NODE_ENV as EnvConfig['nodeEnv']) || 'development',
    databaseUrl: process.env.DATABASE_URL || undefined,
    twelveDataApiKey: process.env.TWELVE_DATA_API_KEY || undefined,
    finnhubApiKey: process.env.FINNHUB_API_KEY || undefined,
    aiApiKey: process.env.AI_API_KEY || undefined,
    aiApiUrl: process.env.AI_API_URL || undefined,
    aiModel: process.env.AI_MODEL || undefined,
    aiFallbackApiKey: process.env.AI_FALLBACK_API_KEY || undefined,
    aiFallbackApiUrl: process.env.AI_FALLBACK_API_URL || undefined,
    aiFallbackModel: process.env.AI_FALLBACK_MODEL || undefined,
    resendApiKey: process.env.RESEND_API_KEY || undefined,
    authEmailFrom: process.env.AUTH_EMAIL_FROM || undefined,
  };
}

/**
 * Variables that later phases will require. Missing them is NOT a fatal
 * error yet (Phase 2 has no database/provider/AI calls to make), but we
 * log a clear, non-secret-leaking warning so it's obvious what still needs
 * configuring before those phases run.
 */
const REQUIRED_FROM_PHASE: Record<string, keyof EnvConfig> = {
  'Phase 3 (market data provider)': 'twelveDataApiKey',
  'Phase 3 (market data provider - finnhub fallback)': 'finnhubApiKey',
  'Phase 16 (AI layer)': 'aiApiKey',
  'Phase 19 (database/history)': 'databaseUrl',
};

export function logEnvStatus(config: EnvConfig): void {
  console.log(`[env] NODE_ENV=${config.nodeEnv}`);
  console.log(`[env] PORT=${config.port}`);
  console.log(`[env] FRONTEND_URL=${config.frontendUrl}`);

  for (const [phase, key] of Object.entries(REQUIRED_FROM_PHASE)) {
    const isSet = Boolean(config[key]);
    // Never log the actual secret value - only whether it's present.
    console.log(`[env] ${key}: ${isSet ? 'set' : 'not set'} (required by ${phase})`);
  }
  console.log(`[env] aiFallbackApiKey: ${config.aiFallbackApiKey ? 'set' : 'not set'} (optional fallback provider)`);
}

export const env = getEnv();
