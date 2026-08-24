"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeHistoricalDecision = analyzeHistoricalDecision;
const indicatorService_1 = require("../analysis/indicatorService");
const trendAnalysisEngine_1 = require("../analysis/trendAnalysisEngine");
const marketStructureService_1 = require("../analysis/marketStructureService");
const supportResistanceService_1 = require("../analysis/supportResistanceService");
const momentumAnalysisEngine_1 = require("../analysis/momentumAnalysisEngine");
const volatilityAnalysisEngine_1 = require("../analysis/volatilityAnalysisEngine");
/**
 * Evaluates one completed decision candle using only the prefix available at
 * that point in history. Later candles are deliberately excluded.
 */
function analyzeHistoricalDecision(candles, decisionIndex, symbol, timeframe, options = {}) {
    if (!Number.isInteger(decisionIndex) || decisionIndex < 0 || decisionIndex >= candles.length) {
        throw new Error(`Historical decision index ${decisionIndex} is outside the candle series.`);
    }
    const candlesThroughDecision = candles.slice(0, decisionIndex + 1);
    const decisionCandle = candlesThroughDecision[decisionIndex];
    const indicators = (0, indicatorService_1.computeIndicators)(candlesThroughDecision, symbol, timeframe).indicators;
    const structure = (0, marketStructureService_1.getMarketStructure)(candlesThroughDecision, {
        swingWindow: options.swingWindow,
        confirmedSwingOnly: true,
    }).structure;
    const trend = (0, trendAnalysisEngine_1.analyzeTrend)(candlesThroughDecision, indicators, structure);
    const supportResistance = (0, supportResistanceService_1.getSupportResistance)(candlesThroughDecision, {
        swingWindow: options.swingWindow,
        confirmedSwingOnly: true,
    });
    const momentum = (0, momentumAnalysisEngine_1.analyzeMomentum)(candlesThroughDecision, indicators, structure);
    const volatility = (0, volatilityAnalysisEngine_1.analyzeVolatility)(candlesThroughDecision, indicators);
    return {
        symbol,
        timeframe,
        decisionIndex,
        decisionTimestamp: decisionCandle.timestamp,
        candlesThroughDecision,
        indicators,
        trend,
        structure,
        supportResistance,
        momentum,
        volatility,
        higherTimeframeTrends: options.higherTimeframeTrends ?? {},
    };
}
//# sourceMappingURL=historicalAnalysisService.js.map