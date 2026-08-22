"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRiskAnalysis = getRiskAnalysis;
const trendAnalysisService_1 = require("./trendAnalysisService");
const marketStructureService_1 = require("./marketStructureService");
const volatilityAnalysisService_1 = require("./volatilityAnalysisService");
const supportResistanceService_1 = require("./supportResistanceService");
const setupDetectionService_1 = require("./setupDetectionService");
const marketDataService_1 = require("../services/marketDataService");
const riskAnalysisEngine_1 = require("./riskAnalysisEngine");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('riskAnalysis');
async function getRiskAnalysis(symbol, timeframe, request) {
    try {
        const { candles } = await (0, marketDataService_1.getValidatedCandles)(symbol, timeframe, { limit: 500 });
        const [trend, volatility, sr, setups] = await Promise.all([
            (0, trendAnalysisService_1.getTrendAnalysis)(symbol, timeframe, {}),
            (0, volatilityAnalysisService_1.getVolatilityAnalysis)(symbol, timeframe),
            (0, supportResistanceService_1.getSupportResistance)(candles, { swingWindow: 2 }),
            (0, setupDetectionService_1.getSetupDetection)(symbol, timeframe),
        ]);
        const structure = (0, marketStructureService_1.getMarketStructure)(candles, { swingWindow: 2 });
        const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
        const risk = (0, riskAnalysisEngine_1.computeRiskAnalysis)({
            trend: trend.trend,
            structure: structure.structure,
            volatility: volatility.volatility,
            supportResistance: sr,
            setups: setups.setups,
            currentPrice,
            accountSize: request?.accountSize,
            maxRiskPercent: request?.maxRiskPercent,
        });
        return {
            symbol,
            timeframe,
            risk,
        };
    }
    catch (err) {
        logger.error('Failed to compute risk analysis', {
            message: err instanceof Error ? err.message : String(err),
        });
        throw err;
    }
}
//# sourceMappingURL=riskAnalysisService.js.map