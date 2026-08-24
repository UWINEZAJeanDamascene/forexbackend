"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompletedCandlesAt = getCompletedCandlesAt;
exports.synchronizeHigherTimeframe = synchronizeHigherTimeframe;
const instruments_1 = require("../../../shared/constants/instruments");
function candleStartMs(candle) {
    return new Date(candle.timestamp).getTime();
}
/**
 * Provider timestamps represent candle starts. A candle is usable at a
 * decision timestamp only after its full timeframe duration has elapsed.
 */
function getCompletedCandlesAt(candles, timeframe, decisionTimestamp) {
    const decisionMs = typeof decisionTimestamp === 'string'
        ? new Date(decisionTimestamp).getTime()
        : decisionTimestamp.getTime();
    if (!Number.isFinite(decisionMs))
        return [];
    return candles
        .filter((candle) => {
        const startMs = candleStartMs(candle);
        return Number.isFinite(startMs) && startMs + (0, instruments_1.timeframeToMs)(timeframe) <= decisionMs;
    })
        .sort((a, b) => candleStartMs(a) - candleStartMs(b));
}
function synchronizeHigherTimeframe(decisionCandles, higherTimeframeCandles, higherTimeframe) {
    const sortedDecisions = [...decisionCandles].sort((a, b) => candleStartMs(a) - candleStartMs(b));
    const sortedHigher = [...higherTimeframeCandles].sort((a, b) => candleStartMs(a) - candleStartMs(b));
    let completedCount = 0;
    const contexts = [];
    for (const decisionCandle of sortedDecisions) {
        const decisionMs = candleStartMs(decisionCandle);
        while (completedCount < sortedHigher.length &&
            candleStartMs(sortedHigher[completedCount]) + (0, instruments_1.timeframeToMs)(higherTimeframe) <= decisionMs) {
            completedCount++;
        }
        const completed = sortedHigher.slice(0, completedCount);
        contexts.push({
            decisionCandle,
            completedHigherTimeframeCandles: completed,
            latestCompletedHigherTimeframeCandle: completed.at(-1) ?? null,
        });
    }
    return contexts;
}
//# sourceMappingURL=backtestTimeframeService.js.map