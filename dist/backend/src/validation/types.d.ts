export type ValidationIssueType = 'INVALID_PRICE' | 'NEGATIVE_PRICE' | 'INVALID_OHLC_RELATIONSHIP' | 'DUPLICATE_TIMESTAMP' | 'OUT_OF_ORDER_TIMESTAMP' | 'MISSING_CANDLE_GAP' | 'INSUFFICIENT_CANDLE_COUNT';
export type ValidationSeverity = 'warning' | 'error';
export interface ValidationIssue {
    type: ValidationIssueType;
    severity: ValidationSeverity;
    message: string;
    /** Index in the ORIGINAL input array, when the issue is candle-specific. */
    index?: number;
    timestamp?: string;
}
/**
 * Thrown when a candle series cannot be safely used at all - e.g. every
 * candle was corrupted, or too few valid candles remain after cleaning to
 * do any meaningful analysis. Callers (indicators/analysis) should never
 * receive candles that would trigger this.
 */
export declare class DataValidationError extends Error {
    readonly issues: ValidationIssue[];
    constructor(message: string, issues: ValidationIssue[]);
}
export interface CandleSeriesValidationResult<TCandle> {
    /** Cleaned, deduplicated, chronologically sorted candles safe to use downstream. */
    candles: TCandle[];
    /** Every issue found, including ones that were auto-repaired (e.g. sorted, deduped). */
    issues: ValidationIssue[];
}
