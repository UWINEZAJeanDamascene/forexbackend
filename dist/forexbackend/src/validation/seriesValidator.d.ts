import { Candle } from '../../../shared/types/market';
import { Timeframe } from '../../../shared/constants/instruments';
import { CandleSeriesValidationResult, ValidationIssue } from './types';
/** Default minimum candles required for the series to be considered usable at all. */
export declare const DEFAULT_MIN_CANDLES = 2;
/** Removes candles with a duplicate timestamp, keeping the first occurrence. */
export declare function checkDuplicateTimestamps(candles: Candle[]): {
    deduped: Candle[];
    issues: ValidationIssue[];
};
/** Sorts candles chronologically (oldest first) and reports if they weren't already. */
export declare function sortAndDetectOutOfOrder(candles: Candle[]): {
    sorted: Candle[];
    issues: ValidationIssue[];
};
/**
 * Flags gaps larger than expected between consecutive candles. This is a
 * WARNING, not an error - forex markets close on weekends/holidays, so
 * gaps are often legitimate rather than a sign of corrupted data.
 */
export declare function detectGaps(candles: Candle[], timeframe: Timeframe): ValidationIssue[];
export interface ValidateCandleSeriesOptions {
    /** Minimum usable candles required after cleaning. Defaults to 2. */
    minCandles?: number;
    /** Symbol/timeframe, used only for log context - does not affect validation logic. */
    context?: {
        symbol?: string;
        timeframe?: Timeframe;
    };
}
/**
 * The single entry point for data validation (Phase 4). Every candle series
 * from a provider must pass through this before reaching indicators,
 * analysis, or AI.
 *
 * Pipeline:
 *   1. Drop candles with invalid prices or bad OHLC relationships (error).
 *   2. Drop duplicate timestamps, keeping the first occurrence (error).
 *   3. Sort into chronological order if needed (error, auto-repaired).
 *   4. Flag (but don't remove) unusually large gaps between candles (warning).
 *   5. If too few usable candles remain, throw DataValidationError.
 *
 * Every issue found is logged. The function never throws for warnings -
 * only when the resulting series is too small/corrupted to be usable.
 */
export declare function validateCandleSeries(rawCandles: Candle[], timeframe: Timeframe, options?: ValidateCandleSeriesOptions): CandleSeriesValidationResult<Candle>;
