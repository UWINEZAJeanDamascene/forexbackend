import { Candle } from '../../shared/types/market';
import { getValidatedCandles } from '../services/marketDataService';
import { computeIndicators } from './indicatorService';
import { analyzeVolatility } from './volatilityAnalysisEngine';
import { VolatilityResponse } from '../../shared/types/volatilityAnalysis';
import { createLogger } from '../utils/logger';

const logger = createLogger('volatilityAnalysis');

const CACHE_TTL_MS = 15_000;

interface CacheEntry {
  timestamp: number;
  data: VolatilityResponse;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(symbol: string, timeframe: string): string {
  return `${symbol}:${timeframe}`;
}

function getCached(symbol: string, timeframe: string): VolatilityResponse | null {
  const key = cacheKey(symbol, timeframe);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(symbol: string, timeframe: string, data: VolatilityResponse): void {
  const key = cacheKey(symbol, timeframe);
  cache.set(key, { timestamp: Date.now(), data });
}

export function clearVolatilityAnalysisCache(): void {
  cache.clear();
}

export interface GetVolatilityOptions {
  limit?: number;
}

export async function getVolatilityAnalysis(symbol: string, timeframe: string, options: GetVolatilityOptions = {}): Promise<VolatilityResponse> {
  const cached = getCached(symbol, timeframe);
  if (cached) {
    return cached;
  }

  const { candles } = await getValidatedCandles(symbol, timeframe, { limit: options.limit });
  const indicators = computeIndicators(candles, symbol, timeframe);
  const volatility = analyzeVolatility(candles, indicators.indicators);

  const result: VolatilityResponse = {
    symbol,
    timeframe,
    volatility,
  };

  setCache(symbol, timeframe, result);
  return result;
}
