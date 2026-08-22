/**
 * Exponential Moving Average.
 *
 * The first `period - 1` values are `null` because there isn't enough
 * history to compute a meaningful EMA. The first EMA value is seeded from
 * the simple moving average of the first `period` closes, then subsequent
 * values use the standard EMA recurrence:
 *
 *   k = 2 / (period + 1)
 *   EMA[i] = close[i] * k + EMA[i-1] * (1 - k)
 */
export declare function ema(closes: number[], period: number): (number | null)[];
