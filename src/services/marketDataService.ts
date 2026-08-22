import type { MarketDataProvider } from '../providers/MarketDataProvider';
import { Candle } from '../../../shared/types/market';
import { Symbol, Timeframe, timeframeToMs } from '../../../shared/constants/instruments';
import { validateCandleSeries, CandleSeriesValidationResult, DataValidationError } from '../validation';
import { createLogger } from '../utils/logger';

const logger = createLogger('marketDataService');

const CACHE_TTL_MS = 90_000;
// One shared lookback keeps every analysis panel on the same market snapshot.
// Chart display limits may differ, but analytical decisions must not.
export const DEFAULT_ANALYSIS_CANDLE_LIMIT = 500;

interface CandleCacheEntry {
  timestamp: number;
  data: Candle[];
  source: string;
  fallbackUsed: boolean;
  fallbackFrom?: string;
  providerFailureKinds: string[];
}

const candleCache = new Map<string, CandleCacheEntry>();

function candleCacheKey(symbol: Symbol, timeframe: Timeframe, limit?: number): string {
  return `${symbol}:${timeframe}:${limit ?? 'default'}`;
}

function getCachedCandles(symbol: Symbol, timeframe: Timeframe, limit?: number): CandleCacheEntry | null {
  const key = candleCacheKey(symbol, timeframe, limit);
  const entry = candleCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    candleCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedCandles(symbol: Symbol, timeframe: Timeframe, limit: number | undefined, data: Candle[], metadata: { provider: string; fallbackUsed: boolean; fallbackFrom?: string; failureKinds: string[] }): void {
  const key = candleCacheKey(symbol, timeframe, limit);
  candleCache.set(key, { timestamp: Date.now(), data, source: metadata.provider, fallbackUsed: metadata.fallbackUsed, fallbackFrom: metadata.fallbackFrom, providerFailureKinds: metadata.failureKinds });
}

export function clearCandleCache(): void {
  candleCache.clear();
}

export interface GetValidatedCandlesOptions {
  limit?: number;
  minCandles?: number;
  provider?: MarketDataProvider;
}

export interface ValidatedMarketData {
  candles: Candle[];
  analysisCandles: Candle[];
  issues: CandleSeriesValidationResult<Candle>['issues'];
  source: string;
  fetchedAt: string;
  provider: string;
  fallbackUsed: boolean;
  fallbackFrom?: string;
  providerFailureKinds: string[];
}

function providerMetadata(provider: MarketDataProvider) {
  return provider.getLastFetchMetadata?.() ?? { provider: provider.name, fallbackUsed: false, failureKinds: [] as string[] };
}

function rejectFutureLastCandle(candles: Candle[], timeframe: Timeframe, context: { symbol: Symbol; timeframe: Timeframe }): void {
  if (candles.length === 0) return;
  const lastTimestamp = new Date(candles[candles.length - 1].timestamp).getTime();
  if (!Number.isFinite(lastTimestamp) || lastTimestamp <= Date.now() + 60_000) return;

  const issue = {
    type: 'FUTURE_CANDLE_TIMESTAMP' as const,
    severity: 'error' as const,
    message: `Latest ${timeframe} candle timestamp is in the future. Data is not safe for analysis until the provider timestamp is corrected.`,
    timestamp: candles[candles.length - 1].timestamp,
  };
  throw new DataValidationError(`Market data for ${context.symbol} has a future-dated candle.`, [issue]);
}

function getClosedAnalysisCandles(candles: Candle[], timeframe: Timeframe): Candle[] {
  if (candles.length < 3) return candles;
  const lastTimestamp = new Date(candles[candles.length - 1].timestamp).getTime();
  const lastIsClosed = Number.isFinite(lastTimestamp) && Date.now() - lastTimestamp >= timeframeToMs(timeframe);
  return lastIsClosed ? candles : candles.slice(0, -1);
}

export async function getValidatedCandles(
  symbol: Symbol,
  timeframe: Timeframe,
  options: GetValidatedCandlesOptions = {}
): Promise<ValidatedMarketData> {
  const cached = getCachedCandles(symbol, timeframe, options.limit);
  if (cached) {
    const validated = validateCandleSeries(cached.data, timeframe, {
      minCandles: options.minCandles,
      context: { symbol, timeframe },
    });
    rejectFutureLastCandle(validated.candles, timeframe, { symbol, timeframe });
    return { ...validated, analysisCandles: getClosedAnalysisCandles(validated.candles, timeframe), source: cached.source, fetchedAt: new Date(cached.timestamp).toISOString(), provider: cached.source, fallbackUsed: cached.fallbackUsed, fallbackFrom: cached.fallbackFrom, providerFailureKinds: cached.providerFailureKinds };
  }

  const provider = options.provider ?? (await loadDefaultProvider());

  const rawCandles = await provider.getCandles(symbol, timeframe, options.limit);

  const validated = validateCandleSeries(rawCandles, timeframe, {
    minCandles: options.minCandles,
    context: { symbol, timeframe },
  });
  rejectFutureLastCandle(validated.candles, timeframe, { symbol, timeframe });
  const metadata = providerMetadata(provider);
  setCachedCandles(symbol, timeframe, options.limit, rawCandles, metadata);
  return { ...validated, analysisCandles: getClosedAnalysisCandles(validated.candles, timeframe), source: metadata.provider, fetchedAt: new Date().toISOString(), provider: metadata.provider, fallbackUsed: metadata.fallbackUsed, fallbackFrom: metadata.fallbackFrom, providerFailureKinds: metadata.failureKinds ?? [] };
}

async function loadDefaultProvider(): Promise<MarketDataProvider> {
  const { getMarketDataProvider } = await import('../providers');
  return getMarketDataProvider();
}
