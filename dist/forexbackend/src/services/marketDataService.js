"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCandleCache = clearCandleCache;
exports.getValidatedCandles = getValidatedCandles;
const validation_1 = require("../validation");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('marketDataService');
const CACHE_TTL_MS = 90_000;
const candleCache = new Map();
function candleCacheKey(symbol, timeframe, limit) {
    return `${symbol}:${timeframe}:${limit ?? 'default'}`;
}
function getCachedCandles(symbol, timeframe, limit) {
    const key = candleCacheKey(symbol, timeframe, limit);
    const entry = candleCache.get(key);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        candleCache.delete(key);
        return null;
    }
    return entry;
}
function setCachedCandles(symbol, timeframe, limit, data, source) {
    const key = candleCacheKey(symbol, timeframe, limit);
    candleCache.set(key, { timestamp: Date.now(), data, source });
}
function clearCandleCache() {
    candleCache.clear();
}
async function getValidatedCandles(symbol, timeframe, options = {}) {
    const cached = getCachedCandles(symbol, timeframe, options.limit);
    if (cached) {
        const validated = (0, validation_1.validateCandleSeries)(cached.data, timeframe, {
            minCandles: options.minCandles,
            context: { symbol, timeframe },
        });
        return { ...validated, source: cached.source, fetchedAt: new Date(cached.timestamp).toISOString() };
    }
    const provider = options.provider ?? (await loadDefaultProvider());
    const rawCandles = await provider.getCandles(symbol, timeframe, options.limit);
    setCachedCandles(symbol, timeframe, options.limit, rawCandles, provider.name);
    const validated = (0, validation_1.validateCandleSeries)(rawCandles, timeframe, {
        minCandles: options.minCandles,
        context: { symbol, timeframe },
    });
    return { ...validated, source: provider.name, fetchedAt: new Date().toISOString() };
}
async function loadDefaultProvider() {
    const { getMarketDataProvider } = await import('../providers');
    return getMarketDataProvider();
}
//# sourceMappingURL=marketDataService.js.map