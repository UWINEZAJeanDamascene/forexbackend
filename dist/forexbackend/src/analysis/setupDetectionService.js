"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSetupDetection = getSetupDetection;
const marketDataService_1 = require("../services/marketDataService");
const trendAnalysisService_1 = require("./trendAnalysisService");
const marketStructureService_1 = require("./marketStructureService");
const momentumAnalysisService_1 = require("./momentumAnalysisService");
const volatilityAnalysisService_1 = require("./volatilityAnalysisService");
const supportResistanceService_1 = require("./supportResistanceService");
const multiTimeframeAnalysisEngine_1 = require("./multiTimeframeAnalysisEngine");
const setupDetectionEngine_1 = require("./setupDetectionEngine");
async function getSetupDetection(symbol, timeframe) {
    const { analysisCandles: candles } = await (0, marketDataService_1.getValidatedCandles)(symbol, timeframe, { limit: marketDataService_1.DEFAULT_ANALYSIS_CANDLE_LIMIT });
    const [trendResponse, structureResponse, momentumResponse, volatilityResponse, srResponse, mtfResponse] = await Promise.all([
        (0, trendAnalysisService_1.getTrendAnalysis)(symbol, timeframe, {}),
        (0, marketStructureService_1.getMarketStructure)(candles, {}),
        (0, momentumAnalysisService_1.getMomentumAnalysis)(symbol, timeframe),
        (0, volatilityAnalysisService_1.getVolatilityAnalysis)(symbol, timeframe),
        (0, supportResistanceService_1.getSupportResistance)(candles, {}),
        (0, multiTimeframeAnalysisEngine_1.analyzeMultiTimeframe)(symbol, timeframe),
    ]);
    const expectedHigher = multiTimeframeAnalysisEngine_1.TIMEFRAME_HIERARCHY[timeframe]?.higher ?? null;
    const higherSnap = mtfResponse.higherTimeframe;
    // Only treat as incomplete when the higher TF is missing or explicitly failed.
    // Neutral HTF with status ok is valid data — not incomplete.
    const higherIncomplete = expectedHigher !== null &&
        (higherSnap === null || higherSnap.status === 'error' || higherSnap.status === 'insufficient_data');
    const ctx = {
        symbol,
        currentPrice: trendResponse.trend.currentPrice,
        trend: {
            trend: trendResponse.trend.trend,
            strength: trendResponse.trend.strength,
            ema: trendResponse.trend.ema,
        },
        structure: {
            trend: structureResponse.structure.trend,
            events: structureResponse.structure.events.map((e) => ({ type: e.type, price: e.price })),
        },
        momentum: {
            momentum: momentumResponse.momentum.momentum,
            strength: momentumResponse.momentum.strength,
            counterTrend: momentumResponse.momentum.counterTrend,
        },
        volatility: {
            classification: volatilityResponse.volatility.classification,
        },
        supportResistance: {
            supports: srResponse.supports,
            resistances: srResponse.resistances,
        },
        multiTimeframe: {
            alignment: mtfResponse.alignment,
            possiblePattern: mtfResponse.possiblePattern,
            higherTimeframe: mtfResponse.higherTimeframe
                ? {
                    timeframe: mtfResponse.higherTimeframe.timeframe,
                    trend: mtfResponse.higherTimeframe.trend,
                    status: mtfResponse.higherTimeframe.status,
                }
                : null,
            analysis: {
                timeframe: mtfResponse.analysisTimeframe,
                trend: mtfResponse.analysis.trend,
                score: mtfResponse.analysis.score,
                status: mtfResponse.analysis.status,
            },
            lowerTimeframe: mtfResponse.lowerTimeframe
                ? {
                    timeframe: mtfResponse.lowerTimeframe.timeframe,
                    trend: mtfResponse.lowerTimeframe.trend,
                    status: mtfResponse.lowerTimeframe.status,
                }
                : null,
            higherTimeframeIncomplete: higherIncomplete,
        },
    };
    const setups = (0, setupDetectionEngine_1.detectSetups)(ctx);
    return {
        symbol,
        timeframe,
        setups,
        dataQualityNote: higherIncomplete
            ? 'Higher timeframe data incomplete — setups that require multi-timeframe confirmation were excluded.'
            : null,
    };
}
//# sourceMappingURL=setupDetectionService.js.map