"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsi = rsi;
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
function rsi(closes, period = 14) {
    if (period < 1) {
        throw new Error(`RSI period must be >= 1, got ${period}`);
    }
    if (closes.length <= period) {
        return closes.map(() => null);
    }
    const result = new Array(period).fill(null);
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) {
            gains += change;
        }
        else {
            losses += Math.abs(change);
        }
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    const firstRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const firstRsi = 100 - 100 / (1 + firstRs);
    result.push(firstRsi);
    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
    }
    return result;
}
//# sourceMappingURL=rsi.js.map