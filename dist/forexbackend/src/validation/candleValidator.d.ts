import { Candle } from '../../../shared/types/market';
import { ValidationIssue } from './types';
/**
 * Validates a single candle's price fields. Pure function, no I/O - returns
 * every issue found rather than throwing, so the caller (validateCandleSeries)
 * decides whether to drop the candle, warn, or reject the whole series.
 *
 * Checks required by spec:
 *   high >= open
 *   high >= close
 *   low <= open
 *   low <= close
 *   high >= low
 * plus: non-finite prices, negative/zero prices.
 */
export declare function validateCandle(candle: Candle, index: number): ValidationIssue[];
/** True if a candle has any error-severity issue (i.e. should be dropped). */
export declare function isCandleCorrupted(candle: Candle, index: number): boolean;
