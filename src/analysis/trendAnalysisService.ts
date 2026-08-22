import { Candle } from '../../shared/types/market';
import { DEFAULT_ANALYSIS_CANDLE_LIMIT, getValidatedCandles } from '../services/marketDataService';
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

function cacheKey(
  symbol: Symbol,
  timeframe: Timeframe,
  options: GetTrendOptions,
  candles: Candle[]
): string {
  const lastCandle = candles[candles.length - 1];
  const snapshot = lastCandle ? `${candles.length}:${lastCandle.timestamp}` : 'empty';
  return `${symbol}:${timeframe}:${options.limit ?? 'default'}:${options.swingWindow ?? 2}:${snapshot}`;
}

function getCached(symbol: Symbol, timeframe: Timeframe, options: GetTrendOptions, candles: Candle[]): TrendResponse | null {
  const key = cacheKey(symbol, timeframe, options, candles);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(symbol: Symbol, timeframe: Timeframe, options: GetTrendOptions, candles: Candle[], data: TrendResponse): void {
  const key = cacheKey(symbol, timeframe, options, candles);
  cache.set(key, { timestamp: Date.now(), data });
}

export function clearTrendAnalysisCache(): void {
  cache.clear();
}

export async function getTrendAnalysis(symbol: string, timeframe: string, options: GetTrendOptions = {}): Promise<TrendResponse> {
  // Fetch the validated closed-candle snapshot before consulting the analysis
  // cache. This makes the cache revision-sensitive: a new candle, a changed
  // lookback, or a changed swing window cannot reuse an older trend result.
  const analysisLimit = options.limit ?? DEFAULT_ANALYSIS_CANDLE_LIMIT;
  const effectiveOptions = { ...options, limit: analysisLimit };
  const validated = await getValidatedCandles(symbol, timeframe, { limit: analysisLimit });
  const candles = validated.analysisCandles ?? validated.candles;
  const cached = getCached(symbol as Symbol, timeframe as Timeframe, effectiveOptions, candles);
  if (cached) {
    return cached;
  }

  const indicators = computeIndicators(candles, symbol, timeframe);
  const structureResult = getMarketStructure(candles, options);
  const trend = analyzeTrend(candles, indicators.indicators, structureResult.structure);

  const result: TrendResponse = {
    symbol,
    timeframe,
    trend,
  };

  setCache(symbol as Symbol, timeframe as Timeframe, effectiveOptions, candles, result);
  return result;
}
