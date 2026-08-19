import { Timeframe } from '../../../../shared/constants/instruments';
import { MarketDataError } from '../MarketDataProvider';

/**
 * Maps our internal Timeframe values to Twelve Data's `interval` query
 * parameter values. Keeping this mapping in one place means the rest of
 * the app never has to know Twelve Data's naming conventions.
 * Reference: https://twelvedata.com/docs#time-series
 */
const TIMEFRAME_TO_TWELVE_DATA_INTERVAL: Record<Timeframe, string> = {
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1H': '1h',
  '4H': '4h',
  '1D': '1day',
};

export function toTwelveDataInterval(timeframe: Timeframe): string {
  const interval = TIMEFRAME_TO_TWELVE_DATA_INTERVAL[timeframe];
  if (!interval) {
    throw new MarketDataError(
      'UNSUPPORTED_TIMEFRAME',
      'twelvedata',
      `Timeframe "${timeframe}" has no Twelve Data interval mapping.`
    );
  }
  return interval;
}
