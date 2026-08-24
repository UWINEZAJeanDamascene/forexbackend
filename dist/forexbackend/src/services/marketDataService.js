"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ANALYSIS_CANDLE_LIMIT = void 0;
exports.clearCandleCache = clearCandleCache;
exports.getValidatedCandles = getValidatedCandles;
const instruments_1 = require("../../../shared/constants/instruments");
const validation_1 = require("../validation");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('marketDataService');
const CACHE_TTL_MS = 90_000;
// One shared lookback keeps every analysis panel on the same market snapshot.
// Chart display limits may differ, but analytical decisions must not.
exports.DEFAULT_ANALYSIS_CANDLE_LIMIT = 500;
const candleCache = new Map();
const pendingCandleRequests = new Map();
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
function setCachedCandles(symbol, timeframe, limit, data, metadata) {
    const key = candleCacheKey(symbol, timeframe, limit);
    candleCache.set(key, { timestamp: Date.now(), data, source: metadata.provider, fallbackUsed: metadata.fallbackUsed, fallbackFrom: metadata.fallbackFrom, providerFailureKinds: metadata.failureKinds });
}
function clearCandleCache() {
    candleCache.clear();
    pendingCandleRequests.clear();
}
function providerMetadata(provider) {
    return provider.getLastFetchMetadata?.() ?? { provider: provider.name, fallbackUsed: false, failureKinds: [] };
}
function rejectFutureLastCandle(candles, timeframe, context) {
    if (candles.length === 0)
        return;
    const lastTimestamp = new Date(candles[candles.length - 1].timestamp).getTime();
    if (!Number.isFinite(lastTimestamp) || lastTimestamp <= Date.now() + 60_000)
        return;
    const issue = {
        type: 'FUTURE_CANDLE_TIMESTAMP',
        severity: 'error',
        message: `Latest ${timeframe} candle timestamp is in the future. Data is not safe for analysis until the provider timestamp is corrected.`,
        timestamp: candles[candles.length - 1].timestamp,
    };
    throw new validation_1.DataValidationError(`Market data for ${context.symbol} has a future-dated candle.`, [issue]);
}
function getClosedAnalysisCandles(candles, timeframe) {
    if (candles.length === 0)
        return candles;
    const lastTimestamp = new Date(candles[candles.length - 1].timestamp).getTime();
    const lastIsClosed = Number.isFinite(lastTimestamp) && Date.now() - lastTimestamp >= (0, instruments_1.timeframeToMs)(timeframe);
    return lastIsClosed ? candles : candles.slice(0, -1);
}
async function getValidatedCandles(symbol, timeframe, options = {}) {
    const cached = getCachedCandles(symbol, timeframe, options.limit);
    if (cached) {
        const validated = (0, validation_1.validateCandleSeries)(cached.data, timeframe, {
            minCandles: options.minCandles,
            context: { symbol, timeframe },
        });
        rejectFutureLastCandle(validated.candles, timeframe, { symbol, timeframe });
        return { ...validated, analysisCandles: getClosedAnalysisCandles(validated.candles, timeframe), source: cached.source, fetchedAt: new Date(cached.timestamp).toISOString(), provider: cached.source, fallbackUsed: cached.fallbackUsed, fallbackFrom: cached.fallbackFrom, providerFailureKinds: cached.providerFailureKinds };
    }
    const requestKey = candleCacheKey(symbol, timeframe, options.limit);
    const pending = pendingCandleRequests.get(requestKey);
    if (pending)
        return pending;
    const provider = options.provider ?? (await loadDefaultProvider());
    const request = (async () => {
        const rawCandles = await provider.getCandles(symbol, timeframe, options.limit);
        const validated = (0, validation_1.validateCandleSeries)(rawCandles, timeframe, {
            minCandles: options.minCandles,
            context: { symbol, timeframe },
        });
        rejectFutureLastCandle(validated.candles, timeframe, { symbol, timeframe });
        const metadata = providerMetadata(provider);
        setCachedCandles(symbol, timeframe, options.limit, rawCandles, metadata);
        return { ...validated, analysisCandles: getClosedAnalysisCandles(validated.candles, timeframe), source: metadata.provider, fetchedAt: new Date().toISOString(), provider: metadata.provider, fallbackUsed: metadata.fallbackUsed, fallbackFrom: metadata.fallbackFrom, providerFailureKinds: metadata.failureKinds ?? [] };
    })();
    pendingCandleRequests.set(requestKey, request);
    try {
        return await request;
    }
    finally {
        pendingCandleRequests.delete(requestKey);
    }
}
async function loadDefaultProvider() {
    const { getMarketDataProvider } = await import('../providers');
    return getMarketDataProvider();
}
//# sourceMappingURL=marketDataService.js.map