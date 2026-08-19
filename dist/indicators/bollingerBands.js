"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bollingerBands = bollingerBands;
/**
 * Bollinger Bands — 20-period SMA middle band with ±2 standard deviations
 * by default.
 *
 * The first `period - 1` values are `null` because there isn't enough
 * history to compute the SMA.
 */
function bollingerBands(candles, period = 20, stdDevMultiplier = 2) {
    if (period < 1) {
        throw new Error(`Bollinger Bands period must be >= 1, got ${period}`);
    }
    if (stdDevMultiplier <= 0) {
        throw new Error(`Bollinger Bands stdDevMultiplier must be > 0, got ${stdDevMultiplier}.`);
    }
    const closes = candles.map((c) => c.close);
    const upper = new Array(period - 1).fill(null);
    const middle = new Array(period - 1).fill(null);
    const lower = new Array(period - 1).fill(null);
    for (let i = period; i <= closes.length; i++) {
        const window = closes.slice(i - period, i);
        const sum = window.reduce((acc, v) => acc + v, 0);
        const sma = sum / period;
        const variance = window.reduce((acc, v) => acc + (v - sma) ** 2, 0) / period;
        const stdDev = Math.sqrt(variance);
        middle.push(sma);
        upper.push(sma + stdDevMultiplier * stdDev);
        lower.push(sma - stdDevMultiplier * stdDev);
    }
    return { upper, middle, lower };
}
//# sourceMappingURL=bollingerBands.js.map