import { Candle } from '../../shared/types/market';
import { getValidatedCandles } from '../services/marketDataService';
import { computeIndicators } from './indicatorService';
import { getMarketStructure } from './marketStructureService';
import { analyzeTrend } from './trendAnalysisEngine';
import { TrendResponse } from '../../shared/types/trendAnalysis';
import { Symbol, Timeframe } from '../../shared/constants/instruments';
import { createLogger } from '../utils/logger';

const logger = createLogger('trendAnalysisService');

export interface GetTrendOptions {
  swingWindow?: number;
  limit?: number;
}

const CACHE_TTL_MS = 90_000;

interface CacheEntry {
  timestamp: number;
  data: TrendResponse;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(symbol: Symbol, timeframe: Timeframe): string {
  return `${symbol}:${timeframe}`;
}

function getCached(symbol: Symbol, timeframe: Timeframe): TrendResponse | null {
  const key = cacheKey(symbol, timeframe);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(symbol: Symbol, timeframe: Timeframe, data: TrendResponse): void {
  const key = cacheKey(symbol, timeframe);
  cache.set(key, { timestamp: Date.now(), data });
}

export function clearTrendAnalysisCache(): void {
  cache.clear();
}

export async function getTrendAnalysis(symbol: string, timeframe: string, options: GetTrendOptions = {}): Promise<TrendResponse> {
  const cached = getCached(symbol as Symbol, timeframe as Timeframe);
  if (cached) {
    return cached;
  }

  const { candles } = await getValidatedCandles(symbol, timeframe, { limit: options.limit });
  const indicators = computeIndicators(candles, symbol, timeframe);
  const structureResult = getMarketStructure(candles, options);
  const trend = analyzeTrend(candles, indicators.indicators, structureResult.structure);

  const result: TrendResponse = {
    symbol,
    timeframe,
    trend,
  };

  setCache(symbol as Symbol, timeframe as Timeframe, result);
  return result;
}
