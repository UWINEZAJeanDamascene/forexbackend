"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeIndicators = computeIndicators;
const ema_1 = require("../indicators/ema");
const rsi_1 = require("../indicators/rsi");
const macd_1 = require("../indicators/macd");
const atr_1 = require("../indicators/atr");
const bollingerBands_1 = require("../indicators/bollingerBands");
/**
 * Computes all Phase 6 technical indicators from validated candle data.
 *
 * This is the single entry point for indicator calculation. All other
 * backend code (controllers, analysis engines, AI service) should use this
 * rather than calling individual indicator functions directly, so future
 * changes to indicator sets/config only require updating this file.
 */
function computeIndicators(candles, symbol, timeframe) {
    const closes = candles.map((c) => c.close);
    const ema20 = (0, ema_1.ema)(closes, 20);
    const ema50 = (0, ema_1.ema)(closes, 50);
    const ema200 = (0, ema_1.ema)(closes, 200);
    const rsi14 = (0, rsi_1.rsi)(closes, 14);
    const macdResult = (0, macd_1.macd)(closes, 12, 26, 9);
    const atr14 = (0, atr_1.atr)(candles, 14);
    const bb = (0, bollingerBands_1.bollingerBands)(candles, 20, 2);
    return {
        symbol,
        timeframe,
        indicators: {
            ema20,
            ema50,
            ema200,
            rsi14,
            macd: {
                line: macdResult.macdLine,
                signal: macdResult.signalLine,
                histogram: macdResult.histogram,
            },
            atr14,
            bollingerBands: {
                upper: bb.upper,
                middle: bb.middle,
                lower: bb.lower,
            },
        },
    };
}
//# sourceMappingURL=indicatorService.js.map