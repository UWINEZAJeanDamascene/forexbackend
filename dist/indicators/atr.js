"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.atr = atr;
const ema_1 = require("./ema");
/**
 * Average True Range (ATR) — 14-period by default.
 *
 * True Range for each candle is the greatest of:
 *   - high - low
 *   - |high - previous close|
 *   - |low - previous close|
 *
 * The first value is `null` because TR requires the previous close. ATR is
 * then the EMA of the TR series (same smoothing as the EMA indicator).
 */
function atr(candles, period = 14) {
    if (period < 1) {
        throw new Error(`ATR period must be >= 1, got ${period}`);
    }
    if (candles.length < 2) {
        return candles.map(() => null);
    }
    const trueRanges = [candles[0].high - candles[0].low];
    for (let i = 1; i < candles.length; i++) {
        const prevClose = candles[i - 1].close;
        const high = candles[i].high;
        const low = candles[i].low;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trueRanges.push(tr);
    }
    return (0, ema_1.ema)(trueRanges, period);
}
//# sourceMappingURL=atr.js.map