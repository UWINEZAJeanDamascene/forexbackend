"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearTrendAnalysisCache = clearTrendAnalysisCache;
exports.getTrendAnalysis = getTrendAnalysis;
const marketDataService_1 = require("../services/marketDataService");
const indicatorService_1 = require("./indicatorService");
const marketStructureService_1 = require("./marketStructureService");
const trendAnalysisEngine_1 = require("./trendAnalysisEngine");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('trendAnalysisService');
const CACHE_TTL_MS = 90_000;
const cache = new Map();
function cacheKey(symbol, timeframe, options, candles) {
    const lastCandle = candles[candles.length - 1];
    const snapshot = lastCandle ? `${candles.length}:${lastCandle.timestamp}` : 'empty';
    return `${symbol}:${timeframe}:${options.limit ?? 'default'}:${options.swingWindow ?? 2}:${snapshot}`;
}
function getCached(symbol, timeframe, options, candles) {
    const key = cacheKey(symbol, timeframe, options, candles);
    const entry = cache.get(key);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}
function setCache(symbol, timeframe, options, candles, data) {
    const key = cacheKey(symbol, timeframe, options, candles);
    cache.set(key, { timestamp: Date.now(), data });
}
function clearTrendAnalysisCache() {
    cache.clear();
}
async function getTrendAnalysis(symbol, timeframe, options = {}) {
    // Fetch the validated closed-candle snapshot before consulting the analysis
    // cache. This makes the cache revision-sensitive: a new candle, a changed
    // lookback, or a changed swing window cannot reuse an older trend result.
    const analysisLimit = options.limit ?? marketDataService_1.DEFAULT_ANALYSIS_CANDLE_LIMIT;
    const effectiveOptions = { ...options, limit: analysisLimit };
    const validated = await (0, marketDataService_1.getValidatedCandles)(symbol, timeframe, { limit: analysisLimit });
    const candles = validated.analysisCandles ?? validated.candles;
    const cached = getCached(symbol, timeframe, effectiveOptions, candles);
    if (cached) {
        return cached;
    }
    const indicators = (0, indicatorService_1.computeIndicators)(candles, symbol, timeframe);
    const structureResult = (0, marketStructureService_1.getMarketStructure)(candles, options);
    const trend = (0, trendAnalysisEngine_1.analyzeTrend)(candles, indicators.indicators, structureResult.structure);
    const result = {
        symbol,
        timeframe,
        trend,
    };
    setCache(symbol, timeframe, effectiveOptions, candles, result);
    return result;
}
//# sourceMappingURL=trendAnalysisService.js.map