"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRiskAnalysis = getRiskAnalysis;
const trendAnalysisService_1 = require("./trendAnalysisService");
const marketStructureService_1 = require("./marketStructureService");
const volatilityAnalysisService_1 = require("./volatilityAnalysisService");
const supportResistanceService_1 = require("./supportResistanceService");
const setupDetectionService_1 = require("./setupDetectionService");
const momentumAnalysisService_1 = require("./momentumAnalysisService");
const multiTimeframeAnalysisEngine_1 = require("./multiTimeframeAnalysisEngine");
const marketDataService_1 = require("../services/marketDataService");
const riskAnalysisEngine_1 = require("./riskAnalysisEngine");
const logger_1 = require("../utils/logger");
const quoteService_1 = require("../services/quoteService");
const logger = (0, logger_1.createLogger)('riskAnalysis');
async function getRiskAnalysis(symbol, timeframe, request) {
    try {
        const { analysisCandles: candles } = await (0, marketDataService_1.getValidatedCandles)(symbol, timeframe, { limit: 500 });
        const [trend, volatility, sr, setups, momentum, multiTimeframe] = await Promise.all([
            (0, trendAnalysisService_1.getTrendAnalysis)(symbol, timeframe, {}),
            (0, volatilityAnalysisService_1.getVolatilityAnalysis)(symbol, timeframe),
            (0, supportResistanceService_1.getSupportResistance)(candles, { swingWindow: 2 }),
            (0, setupDetectionService_1.getSetupDetection)(symbol, timeframe),
            (0, momentumAnalysisService_1.getMomentumAnalysis)(symbol, timeframe),
            (0, multiTimeframeAnalysisEngine_1.analyzeMultiTimeframe)(symbol, timeframe),
        ]);
        const structure = (0, marketStructureService_1.getMarketStructure)(candles, { swingWindow: 2 });
        const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
        let quoteToAccountRate;
        if (request?.accountSize !== undefined && request.maxRiskPercent !== undefined) {
            try {
                quoteToAccountRate = await getQuoteToUsdRate(symbol);
            }
            catch (conversionError) {
                logger.warn('Position sizing skipped because quote-currency conversion is unavailable', {
                    symbol,
                    message: conversionError instanceof Error ? conversionError.message : String(conversionError),
                });
            }
        }
        const sizingInputs = quoteToAccountRate === undefined
            ? { accountSize: undefined, maxRiskPercent: undefined }
            : { accountSize: request?.accountSize, maxRiskPercent: request?.maxRiskPercent };
        const risk = (0, riskAnalysisEngine_1.computeRiskAnalysis)({
            trend: trend.trend,
            structure: structure.structure,
            volatility: volatility.volatility,
            supportResistance: sr,
            setups: setups.setups,
            momentum: momentum.momentum,
            multiTimeframe,
            currentPrice,
            accountSize: sizingInputs.accountSize,
            maxRiskPercent: sizingInputs.maxRiskPercent,
            quoteToAccountRate,
            accountCurrency: 'USD',
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
async function getQuoteToUsdRate(symbol) {
    const quoteCurrency = symbol.split('/')[1];
    if (quoteCurrency === 'USD')
        return 1;
    const conversionSymbol = `USD/${quoteCurrency}`;
    const quote = await (0, quoteService_1.getCachedQuote)(conversionSymbol);
    if (!Number.isFinite(quote.price) || quote.price <= 0)
        return undefined;
    return 1 / quote.price;
}
//# sourceMappingURL=riskAnalysisService.js.map