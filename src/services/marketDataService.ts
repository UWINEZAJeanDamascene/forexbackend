import type { MarketDataProvider } from '../providers/MarketDataProvider';
import { Candle } from '../../../shared/types/market';
import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { validateCandleSeries, CandleSeriesValidationResult } from '../validation';
import { createLogger } from '../utils/logger';

const logger = createLogger('marketDataService');

const CACHE_TTL_MS = 90_000;

interface CandleCacheEntry {
  timestamp: number;
  data: Candle[];
}

const candleCache = new Map<string, CandleCacheEntry>();

function candleCacheKey(symbol: Symbol, timeframe: Timeframe, limit?: number): string {
  return `${symbol}:${timeframe}:${limit ?? 'default'}`;
}

function getCachedCandles(symbol: Symbol, timeframe: Timeframe, limit?: number): Candle[] | null {
  const key = candleCacheKey(symbol, timeframe, limit);
  const entry = candleCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    candleCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedCandles(symbol: Symbol, timeframe: Timeframe, limit: number | undefined, data: Candle[]): void {
  const key = candleCacheKey(symbol, timeframe, limit);
  candleCache.set(key, { timestamp: Date.now(), data });
}

export function clearCandleCache(): void {
  candleCache.clear();
}

export interface GetValidatedCandlesOptions {
  limit?: number;
  minCandles?: number;
  provider?: MarketDataProvider;
}

export async function getValidatedCandles(
  symbol: Symbol,
  timeframe: Timeframe,
  options: GetValidatedCandlesOptions = {}
): Promise<CandleSeriesValidationResult<Candle>> {
  const cached = getCachedCandles(symbol, timeframe, options.limit);
  if (cached) {
    return validateCandleSeries(cached, timeframe, {
      minCandles: options.minCandles,
      context: { symbol, timeframe },
    });
  }

  const provider = options.provider ?? (await loadDefaultProvider());

  const rawCandles = await provider.getCandles(symbol, timeframe, options.limit);

  setCachedCandles(symbol, timeframe, options.limit, rawCandles);

  return validateCandleSeries(rawCandles, timeframe, {
    minCandles: options.minCandles,
    context: { symbol, timeframe },
  });
}

async function loadDefaultProvider(): Promise<MarketDataProvider> {
  const { getMarketDataProvider } = await import('../providers');
  return getMarketDataProvider();
}
