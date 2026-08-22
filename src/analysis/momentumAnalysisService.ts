import { Candle } from '../../shared/types/market';
import { DEFAULT_ANALYSIS_CANDLE_LIMIT, getValidatedCandles } from '../services/marketDataService';
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

function cacheKey(symbol: string, timeframe: string, limit: number, candles: Candle[]): string {
  const last = candles[candles.length - 1];
  return `${symbol}:${timeframe}:${limit}:${candles.length}:${last?.timestamp ?? 'empty'}`;
}

function getCached(symbol: string, timeframe: string, limit: number, candles: Candle[]): MomentumResponse | null {
  const key = cacheKey(symbol, timeframe, limit, candles);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(symbol: string, timeframe: string, limit: number, candles: Candle[], data: MomentumResponse): void {
  const key = cacheKey(symbol, timeframe, limit, candles);
  cache.set(key, { timestamp: Date.now(), data });
}

export interface GetMomentumOptions {
  limit?: number;
}

export function clearMomentumAnalysisCache(): void {
  cache.clear();
}

export async function getMomentumAnalysis(symbol: string, timeframe: string, options: GetMomentumOptions = {}): Promise<MomentumResponse> {
  const limit = options.limit ?? DEFAULT_ANALYSIS_CANDLE_LIMIT;
  const { analysisCandles: candles } = await getValidatedCandles(symbol, timeframe, { limit });
  const cached = getCached(symbol, timeframe, limit, candles);
  if (cached) {
    return cached;
  }

  const indicators = computeIndicators(candles, symbol, timeframe);
  const structureResult = getMarketStructure(candles, {});
  const momentum = analyzeMomentum(candles, indicators.indicators, structureResult.structure);

  const result: MomentumResponse = {
    symbol,
    timeframe,
    momentum,
  };

  setCache(symbol, timeframe, limit, candles, result);
  return result;
}
