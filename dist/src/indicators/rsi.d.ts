/**
 * Relative Strength Index (RSI) — 14-period by default.
 *
 * Uses Wilder's smoothing for the average gain/loss after the first period.
 * The first `period` values are `null` because RSI requires `period + 1`
 * closes to compute the first value.
 *
 *   RS = avgGain / avgLoss
 *   RSI = 100 - (100 / (1 + RS))
 */
export declare function rsi(closes: number[], period?: number): (number | null)[];
