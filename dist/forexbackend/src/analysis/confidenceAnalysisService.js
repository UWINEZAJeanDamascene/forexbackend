"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfidenceAnalysis = getConfidenceAnalysis;
const trendAnalysisService_1 = require("./trendAnalysisService");
const marketStructureService_1 = require("./marketStructureService");
const momentumAnalysisService_1 = require("./momentumAnalysisService");
const volatilityAnalysisService_1 = require("./volatilityAnalysisService");
const supportResistanceService_1 = require("./supportResistanceService");
const multiTimeframeAnalysisService_1 = require("./multiTimeframeAnalysisService");
const setupDetectionService_1 = require("./setupDetectionService");
const marketDataService_1 = require("../services/marketDataService");
const confidenceAnalysisEngine_1 = require("./confidenceAnalysisEngine");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('confidenceAnalysis');
async function getConfidenceAnalysis(symbol, timeframe) {
    try {
        const { analysisCandles: candles } = await (0, marketDataService_1.getValidatedCandles)(symbol, timeframe, { limit: marketDataService_1.DEFAULT_ANALYSIS_CANDLE_LIMIT });
        const [trend, momentum, volatility, sr, mtf, setups] = await Promise.all([
            (0, trendAnalysisService_1.getTrendAnalysis)(symbol, timeframe, {}),
            (0, momentumAnalysisService_1.getMomentumAnalysis)(symbol, timeframe),
            (0, volatilityAnalysisService_1.getVolatilityAnalysis)(symbol, timeframe),
            (0, supportResistanceService_1.getSupportResistance)(candles, { swingWindow: 2 }),
            (0, multiTimeframeAnalysisService_1.getMultiTimeframeAnalysis)(symbol, timeframe),
            (0, setupDetectionService_1.getSetupDetection)(symbol, timeframe),
        ]);
        const structure = (0, marketStructureService_1.getMarketStructure)(candles, { swingWindow: 2 });
        const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
        const confidence = (0, confidenceAnalysisEngine_1.computeConfidence)({
            trend: trend.trend,
            structure: structure.structure,
            momentum: momentum.momentum,
            volatility: volatility.volatility,
            supportResistance: sr,
            multiTimeframe: mtf.multiTimeframe,
            setups: setups.setups,
            currentPrice,
        });
        return {
            symbol,
            timeframe,
            confidence,
        };
    }
    catch (err) {
        logger.error('Failed to compute confidence analysis', {
            message: err instanceof Error ? err.message : String(err),
        });
        throw err;
    }
}
//# sourceMappingURL=confidenceAnalysisService.js.map