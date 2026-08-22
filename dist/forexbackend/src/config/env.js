"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.getEnv = getEnv;
exports.logEnvStatus = logEnvStatus;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
/**
 * The single .env file lives at the repo root (see /.env.example), not
 * inside /backend. Load it explicitly so `npm run dev` works the same way
 * whether it's invoked from the repo root or from inside /backend.
 * Falls back to a local backend/.env if present, for flexibility.
 */
function loadEnvFile() {
    const rootEnvPath = path_1.default.resolve(__dirname, '../../../.env');
    const localEnvPath = path_1.default.resolve(__dirname, '../../.env');
    if (fs_1.default.existsSync(rootEnvPath)) {
        dotenv_1.default.config({ path: rootEnvPath });
    }
    else if (fs_1.default.existsSync(localEnvPath)) {
        dotenv_1.default.config({ path: localEnvPath });
    }
    else {
        // No .env file yet is fine at this phase - just use defaults / OS env vars.
        dotenv_1.default.config();
    }
}
loadEnvFile();
function getEnv() {
    return {
        port: Number(process.env.PORT) || 3001,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        nodeEnv: process.env.NODE_ENV || 'development',
        databaseUrl: process.env.DATABASE_URL || undefined,
        twelveDataApiKey: process.env.TWELVE_DATA_API_KEY || undefined,
        finnhubApiKey: process.env.FINNHUB_API_KEY || undefined,
        aiApiKey: process.env.AI_API_KEY || undefined,
        aiApiUrl: process.env.AI_API_URL || undefined,
        aiModel: process.env.AI_MODEL || undefined,
        aiFallbackApiKey: process.env.AI_FALLBACK_API_KEY || undefined,
        aiFallbackApiUrl: process.env.AI_FALLBACK_API_URL || undefined,
        aiFallbackModel: process.env.AI_FALLBACK_MODEL || undefined,
    };
}
/**
 * Variables that later phases will require. Missing them is NOT a fatal
 * error yet (Phase 2 has no database/provider/AI calls to make), but we
 * log a clear, non-secret-leaking warning so it's obvious what still needs
 * configuring before those phases run.
 */
const REQUIRED_FROM_PHASE = {
    'Phase 3 (market data provider)': 'twelveDataApiKey',
    'Phase 3 (market data provider - finnhub fallback)': 'finnhubApiKey',
    'Phase 16 (AI layer)': 'aiApiKey',
    'Phase 19 (database/history)': 'databaseUrl',
};
function logEnvStatus(config) {
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
exports.env = getEnv();
//# sourceMappingURL=env.js.map