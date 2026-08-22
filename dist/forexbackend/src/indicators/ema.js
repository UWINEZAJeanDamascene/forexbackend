"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ema = ema;
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
function ema(closes, period) {
    if (period < 1) {
        throw new Error(`EMA period must be >= 1, got ${period}`);
    }
    if (closes.length < period) {
        return closes.map(() => null);
    }
    const result = new Array(period - 1).fill(null);
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += closes[i];
    }
    let prevEma = sum / period;
    result.push(prevEma);
    const k = 2 / (period + 1);
    for (let i = period; i < closes.length; i++) {
        const current = closes[i] * k + prevEma * (1 - k);
        result.push(current);
        prevEma = current;
    }
    return result;
}
//# sourceMappingURL=ema.js.map