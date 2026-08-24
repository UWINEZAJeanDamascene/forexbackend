"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearMomentumAnalysisCache = clearMomentumAnalysisCache;
exports.getMomentumAnalysis = getMomentumAnalysis;
const marketDataService_1 = require("../services/marketDataService");
const indicatorService_1 = require("./indicatorService");
const marketStructureService_1 = require("./marketStructureService");
const momentumAnalysisEngine_1 = require("./momentumAnalysisEngine");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('momentumAnalysis');
const CACHE_TTL_MS = 90_000;
const cache = new Map();
function cacheKey(symbol, timeframe, limit, candles) {
    const last = candles[candles.length - 1];
    return `${symbol}:${timeframe}:${limit}:${candles.length}:${last?.timestamp ?? 'empty'}`;
}
function getCached(symbol, timeframe, limit, candles) {
    const key = cacheKey(symbol, timeframe, limit, candles);
    const entry = cache.get(key);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}
function setCache(symbol, timeframe, limit, candles, data) {
    const key = cacheKey(symbol, timeframe, limit, candles);
    cache.set(key, { timestamp: Date.now(), data });
}
function clearMomentumAnalysisCache() {
    cache.clear();
}
async function getMomentumAnalysis(symbol, timeframe, options = {}) {
    const limit = options.limit ?? marketDataService_1.DEFAULT_ANALYSIS_CANDLE_LIMIT;
    const { analysisCandles: candles } = await (0, marketDataService_1.getValidatedCandles)(symbol, timeframe, { limit });
    const cached = getCached(symbol, timeframe, limit, candles);
    if (cached) {
        return cached;
    }
    const indicators = (0, indicatorService_1.computeIndicators)(candles, symbol, timeframe);
    const structureResult = (0, marketStructureService_1.getMarketStructure)(candles, {});
    const momentum = (0, momentumAnalysisEngine_1.analyzeMomentum)(candles, indicators.indicators, structureResult.structure);
    const result = {
        symbol,
        timeframe,
        momentum,
    };
    setCache(symbol, timeframe, limit, candles, result);
    return result;
}
//# sourceMappingURL=momentumAnalysisService.js.map