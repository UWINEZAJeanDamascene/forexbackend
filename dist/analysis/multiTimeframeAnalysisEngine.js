"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BANNED_WORDS = exports.TIMEFRAME_HIERARCHY = void 0;
exports.clearMultiTimeframeCache = clearMultiTimeframeCache;
exports.classifyAlignment = classifyAlignment;
exports.detectPattern = detectPattern;
exports.generateExplanation = generateExplanation;
exports.analyzeMultiTimeframe = analyzeMultiTimeframe;
const instruments_1 = require("../../../shared/constants/instruments");
const trendAnalysisService_1 = require("./trendAnalysisService");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('multiTimeframe');
exports.TIMEFRAME_HIERARCHY = {
    '5m': { higher: '1H', lower: null },
    '15m': { higher: '4H', lower: '5m' },
    '30m': { higher: '4H', lower: '15m' },
    '1H': { higher: '4H', lower: '15m' },
    '4H': { higher: '1D', lower: '1H' },
    '1D': { higher: null, lower: '4H' },
};
const MIN_CANDLES = 60;
const CACHE_TTL_MS = 90_000;
const cache = new Map();
function clearMultiTimeframeCache() {
    cache.clear();
}
function cacheKey(symbol, timeframe) {
    return `${symbol}:${timeframe}`;
}
function getCached(symbol, timeframe) {
    const key = cacheKey(symbol, timeframe);
    const entry = cache.get(key);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}
function setCache(symbol, timeframe, data) {
    const key = cacheKey(symbol, timeframe);
    cache.set(key, { timestamp: Date.now(), data });
}
exports.BANNED_WORDS = /\b(buy|sell|enter|exit|target|stop|guaranteed|profit|loss|long|short|call|put)\b/i;
async function fetchTimeframeTrend(symbol, timeframe) {
    try {
        const trendResponse = await (0, trendAnalysisService_1.getTrendAnalysis)(symbol, timeframe, {});
        const snapshot = {
            timeframe,
            trend: trendResponse.trend.trend,
            score: trendResponse.trend.score,
            strength: trendResponse.trend.strength,
            status: 'ok',
        };
        setCache(symbol, timeframe, snapshot);
        return snapshot;
    }
    catch (err) {
        const reason = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Failed to compute trend for timeframe', { symbol, timeframe, message: reason });
        // Prefer a recent successful snapshot over flipping the whole MTF/setups
        // pipeline to "incomplete" on transient rate limits.
        const stale = getCachedAllowStale(symbol, timeframe);
        if (stale && stale.status === 'ok') {
            return {
                ...stale,
                errorReason: `Using cached ${timeframe} snapshot after fetch failure: ${reason}`,
            };
        }
        return {
            timeframe,
            trend: 'neutral',
            score: 0,
            strength: 'weak',
            status: 'error',
            errorReason: reason,
        };
    }
}
function getCachedAllowStale(symbol, timeframe) {
    const key = cacheKey(symbol, timeframe);
    const entry = cache.get(key);
    return entry?.data ?? null;
}
function classifyAlignment(higher, analysis, lower) {
    if (analysis.status !== 'ok') {
        return 'insufficient_data';
    }
    const snapshots = [higher, analysis, lower].filter((s) => s !== null && s.status === 'ok');
    if (snapshots.length === 0) {
        return 'insufficient_data';
    }
    const allBullish = snapshots.every((s) => s.trend === 'bullish');
    const allBearish = snapshots.every((s) => s.trend === 'bearish');
    const allSameDirection = allBullish || allBearish;
    if (allBullish)
        return 'aligned_bullish';
    if (allBearish)
        return 'aligned_bearish';
    if (snapshots.length >= 2 && snapshots[0].trend === snapshots[1].trend && snapshots[1].trend !== 'neutral') {
        return snapshots[1].trend === 'bullish' ? 'partially_aligned_bullish' : 'partially_aligned_bearish';
    }
    return 'mixed';
}
function detectPattern(higher, analysis, lower) {
    if (!higher || !lower)
        return null;
    if (higher.status !== 'ok' || analysis.status !== 'ok' || lower.status !== 'ok')
        return null;
    if (higher.trend === 'bullish' && analysis.trend === 'bullish' && lower.trend === 'bearish') {
        return 'possible pullback within an uptrend';
    }
    if (higher.trend === 'bearish' && analysis.trend === 'bearish' && lower.trend === 'bullish') {
        return 'possible bounce within a downtrend';
    }
    if (higher.trend !== analysis.trend) {
        return 'conflicting higher and analysis timeframe trends';
    }
    return null;
}
function generateExplanation(alignment, higher, analysis, lower, pattern) {
    const parts = [];
    if (alignment === 'insufficient_data') {
        const failed = [higher, analysis, lower].filter((s) => s === null || s.status !== 'ok');
        parts.push('Insufficient data to complete multi-timeframe analysis.');
        for (const snap of failed) {
            if (snap && snap.errorReason) {
                parts.push(`${snap.timeframe} timeframe: ${snap.errorReason}`);
            }
        }
        return parts.join(' ');
    }
    const higherLabel = higher ? `${higher.timeframe} (${higher.trend}, score ${higher.score})` : 'no higher timeframe';
    const analysisLabel = `${analysis.timeframe} (${analysis.trend}, score ${analysis.score})`;
    const lowerLabel = lower ? `${lower.timeframe} (${lower.trend}, score ${lower.score})` : 'no lower timeframe';
    parts.push(`Higher timeframe ${higherLabel}; analysis timeframe ${analysisLabel}; lower timeframe ${lowerLabel}.`);
    if (pattern) {
        parts.push(`Pattern detected: ${pattern}.`);
    }
    parts.push('This is a description of current conditions across timeframes, not a trading signal.');
    return parts.join(' ');
}
async function analyzeMultiTimeframe(symbol, analysisTimeframe) {
    if (!instruments_1.ENABLED_TIMEFRAMES.includes(analysisTimeframe)) {
        throw new Error(`Timeframe ${analysisTimeframe} is not enabled.`);
    }
    const hierarchy = exports.TIMEFRAME_HIERARCHY[analysisTimeframe];
    const higherTimeframe = hierarchy.higher;
    const lowerTimeframe = hierarchy.lower;
    const cachedHigher = higherTimeframe ? getCached(symbol, higherTimeframe) : null;
    const cachedAnalysis = getCached(symbol, analysisTimeframe);
    const cachedLower = lowerTimeframe ? getCached(symbol, lowerTimeframe) : null;
    const fetchHigher = cachedHigher ? Promise.resolve(cachedHigher) : higherTimeframe ? fetchTimeframeTrend(symbol, higherTimeframe) : Promise.resolve(null);
    const fetchAnalysis = cachedAnalysis ? Promise.resolve(cachedAnalysis) : fetchTimeframeTrend(symbol, analysisTimeframe);
    const fetchLower = cachedLower ? Promise.resolve(cachedLower) : lowerTimeframe ? fetchTimeframeTrend(symbol, lowerTimeframe) : Promise.resolve(null);
    const [higher, analysis, lower] = await Promise.all([fetchHigher, fetchAnalysis, fetchLower]);
    const alignment = classifyAlignment(higher, analysis, lower);
    const pattern = detectPattern(higher, analysis, lower);
    const explanation = generateExplanation(alignment, higher, analysis, lower, pattern);
    if (exports.BANNED_WORDS.test(explanation)) {
        logger.error('Banned word found in MTF explanation', { explanation });
        throw new Error('Generated explanation contains prohibited trade-instruction language.');
    }
    return {
        symbol,
        analysisTimeframe,
        higherTimeframe: higher ?? null,
        analysis,
        lowerTimeframe: lower ?? null,
        alignment,
        possiblePattern: pattern,
        explanation,
    };
}
//# sourceMappingURL=multiTimeframeAnalysisEngine.js.map