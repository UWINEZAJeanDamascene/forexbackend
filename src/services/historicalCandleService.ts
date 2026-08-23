import { Candle } from '../../../shared/types/market';
import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { MarketDataProvider } from '../providers/MarketDataProvider';
import { getMarketDataProvider } from '../providers';
import { validateCandleSeries, CandleSeriesValidationResult } from '../validation';

export interface LoadHistoricalCandlesOptions {
  provider?: MarketDataProvider;
  minCandles?: number;
}

export interface HistoricalCandleData {
  candles: Candle[];
  issues: CandleSeriesValidationResult<Candle>['issues'];
  symbol: Symbol;
  timeframe: Timeframe;
  startDate: string;
  endDate: string;
  provider: string;
  fetchedAt: string;
  fallbackUsed: boolean;
  fallbackFrom?: string;
  providerFailureKinds: string[];
}

export async function loadHistoricalCandles(
  symbol: Symbol,
  timeframe: Timeframe,
  startDate: Date,
  endDate: Date,
  options: LoadHistoricalCandlesOptions = {}
): Promise<HistoricalCandleData> {
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate >= endDate) {
    throw new Error('Historical candle range must contain valid dates with startDate before endDate.');
  }

  const provider = options.provider ?? getMarketDataProvider();
  const rawCandles = await provider.getHistoricalData(symbol, timeframe, startDate, endDate);
  const invalidTimestamp = rawCandles.find((candle) => {
    const timestamp = new Date(candle.timestamp).getTime();
    return !Number.isFinite(timestamp) || timestamp < startDate.getTime() || timestamp > endDate.getTime();
  });
  if (invalidTimestamp) {
    throw new Error(`Historical provider returned candle ${invalidTimestamp.timestamp} outside the requested date range.`);
  }

  const validated = validateCandleSeries(rawCandles, timeframe, {
    minCandles: options.minCandles,
    context: { symbol, timeframe },
  });
  const providerMetadata = provider.getLastFetchMetadata?.() ?? { provider: provider.name, fallbackUsed: false, failureKinds: [] as string[] };

  return {
    candles: validated.candles,
    issues: validated.issues,
    symbol,
    timeframe,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    provider: provider.name,
    fetchedAt: new Date().toISOString(),
    fallbackUsed: providerMetadata.fallbackUsed,
    fallbackFrom: providerMetadata.fallbackFrom,
    providerFailureKinds: providerMetadata.failureKinds ?? [],
  };
}