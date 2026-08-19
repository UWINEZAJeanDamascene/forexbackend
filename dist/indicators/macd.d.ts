/**
 * MACD (Moving Average Convergence Divergence).
 *
 * Default configuration per the spec:
 *   - Fast EMA: 12
 *   - Slow EMA: 26
 *   - Signal EMA: 9
 *
 * Returns three parallel arrays, each `null` where the value cannot yet be
 * computed. The first `slowPeriod - 1` entries are `null` because the slow
 * EMA needs that much history; the signal line needs additional `signalPeriod`
 * values on top of that.
 */
export interface MacdResult {
    macdLine: (number | null)[];
    signalLine: (number | null)[];
    histogram: (number | null)[];
}
export declare function macd(closes: number[], fastPeriod?: number, slowPeriod?: number, signalPeriod?: number): MacdResult;
