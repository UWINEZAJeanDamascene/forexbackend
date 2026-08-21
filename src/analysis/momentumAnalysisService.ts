import { Candle } from '../../shared/types/market';
import { getValidatedCandles } from '../services/marketDataService';
import { computeIndicators } from './indicatorService';
import { getMarketStructure } from './marketStructureService';
import { analyzeMomentum } from './momentumAnalysisEngine';
import { MomentumResponse } from '../../shared/types/momentumAnalysis';
import { createLogger } from '../utils/logger';

const logger = createLogger('momentumAnalysis');

const CACHE_TTL_MS = 90_000;

interface CacheEntry {
  timestamp: number;
  data: MomentumResponse;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(symbol: string, timeframe: string): string {
  return `${symbol}:${timeframe}`;
}

function getCached(symbol: string, timeframe: string): MomentumResponse | null {
  const key = cacheKey(symbol, timeframe);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(symbol: string, timeframe: string, data: MomentumResponse): void {
  const key = cacheKey(symbol, timeframe);
  cache.set(key, { timestamp: Date.now(), data });
}

export interface GetMomentumOptions {
  limit?: number;
}

export function clearMomentumAnalysisCache(): void {
  cache.clear();
}

export async function getMomentumAnalysis(symbol: string, timeframe: string, options: GetMomentumOptions = {}): Promise<MomentumResponse> {
  const cached = getCached(symbol, timeframe);
  if (cached) {
    return cached;
  }

  const { candles } = await getValidatedCandles(symbol, timeframe, { limit: options.limit });
  const indicators = computeIndicators(candles, symbol, timeframe);
  const structureResult = getMarketStructure(candles, {});
  const momentum = analyzeMomentum(candles, indicators.indicators, structureResult.structure);

  const result: MomentumResponse = {
    symbol,
    timeframe,
    momentum,
  };

  setCache(symbol, timeframe, result);
  return result;
}
