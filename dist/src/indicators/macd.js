"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.macd = macd;
const ema_1 = require("./ema");
function macd(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (fastPeriod >= slowPeriod) {
        throw new Error(`MACD fastPeriod (${fastPeriod}) must be less than slowPeriod (${slowPeriod}).`);
    }
    if (signalPeriod < 1) {
        throw new Error(`MACD signalPeriod must be >= 1, got ${signalPeriod}.`);
    }
    const fastEma = (0, ema_1.ema)(closes, fastPeriod);
    const slowEma = (0, ema_1.ema)(closes, slowPeriod);
    const macdLine = [];
    for (let i = 0; i < closes.length; i++) {
        const fast = fastEma[i];
        const slow = slowEma[i];
        if (fast === null || slow === null) {
            macdLine.push(null);
        }
        else {
            macdLine.push(fast - slow);
        }
    }
    const signalLine = (0, ema_1.ema)(macdLine.filter((v) => v !== null), signalPeriod);
    // Pad the start of signalLine with nulls so it aligns with macdLine.
    const firstNonNull = macdLine.findIndex((v) => v !== null);
    const paddedSignal = firstNonNull === -1
        ? new Array(closes.length).fill(null)
        : new Array(firstNonNull).fill(null).concat(signalLine);
    const histogram = [];
    for (let i = 0; i < closes.length; i++) {
        const macd = macdLine[i];
        const signal = paddedSignal[i];
        if (macd === null || signal === null) {
            histogram.push(null);
        }
        else {
            histogram.push(macd - signal);
        }
    }
    return {
        macdLine,
        signalLine: paddedSignal,
        histogram,
    };
}
//# sourceMappingURL=macd.js.map