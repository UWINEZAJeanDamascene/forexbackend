"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MIN_CANDLES = void 0;
exports.checkDuplicateTimestamps = checkDuplicateTimestamps;
exports.sortAndDetectOutOfOrder = sortAndDetectOutOfOrder;
exports.detectGaps = detectGaps;
exports.validateCandleSeries = validateCandleSeries;
const instruments_1 = require("../../../shared/constants/instruments");
const logger_1 = require("../utils/logger");
const candleValidator_1 = require("./candleValidator");
const types_1 = require("./types");
const logger = (0, logger_1.createLogger)('validation');
/** Default minimum candles required for the series to be considered usable at all. */
exports.DEFAULT_MIN_CANDLES = 2;
/**
 * If the gap between two consecutive candles is more than this multiple of
 * the expected timeframe duration, flag it. >1 tolerance avoids flagging
 * every candle for normal clock jitter, while still catching real gaps
 * (weekend closures, provider outages, etc.).
 */
const GAP_TOLERANCE_MULTIPLIER = 1.5;
/** Drops candles with any error-severity issue. Returns remaining candles + issues for all of them (kept or dropped). */
function filterCorruptedCandles(candles) {
    const issues = [];
    const clean = [];
    candles.forEach((candle, index) => {
        const candleIssues = (0, candleValidator_1.validateCandle)(candle, index);
        issues.push(...candleIssues);
        if (!(0, candleValidator_1.isCandleCorrupted)(candle, index)) {
            clean.push(candle);
        }
    });
    return { clean, issues };
}
/** Removes candles with a duplicate timestamp, keeping the first occurrence. */
function checkDuplicateTimestamps(candles) {
    const seen = new Set();
    const deduped = [];
    const issues = [];
    candles.forEach((candle, index) => {
        if (seen.has(candle.timestamp)) {
            issues.push({
                type: 'DUPLICATE_TIMESTAMP',
                severity: 'error',
                message: `Duplicate timestamp "${candle.timestamp}" at index ${index} was dropped (kept first occurrence).`,
                index,
                timestamp: candle.timestamp,
            });
            return;
        }
        seen.add(candle.timestamp);
        deduped.push(candle);
    });
    return { deduped, issues };
}
/** Sorts candles chronologically (oldest first) and reports if they weren't already. */
function sortAndDetectOutOfOrder(candles) {
    const issues = [];
    let alreadySorted = true;
    for (let i = 1; i < candles.length; i++) {
        if (candles[i].timestamp < candles[i - 1].timestamp) {
            alreadySorted = false;
            break;
        }
    }
    if (!alreadySorted) {
        issues.push({
            type: 'OUT_OF_ORDER_TIMESTAMP',
            severity: 'error',
            message: 'Candle series was not in chronological order and has been re-sorted.',
        });
    }
    const sorted = alreadySorted
        ? candles
        : [...candles].sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
    return { sorted, issues };
}
/**
 * Flags gaps larger than expected between consecutive candles. This is a
 * WARNING, not an error - forex markets close on weekends/holidays, so
 * gaps are often legitimate rather than a sign of corrupted data.
 */
function detectGaps(candles, timeframe) {
    const issues = [];
    const expectedMs = (0, instruments_1.timeframeToMs)(timeframe);
    const thresholdMs = expectedMs * GAP_TOLERANCE_MULTIPLIER;
    for (let i = 1; i < candles.length; i++) {
        const prev = new Date(candles[i - 1].timestamp).getTime();
        const curr = new Date(candles[i].timestamp).getTime();
        const gap = curr - prev;
        if (gap > thresholdMs) {
            issues.push({
                type: 'MISSING_CANDLE_GAP',
                severity: 'warning',
                message: `Gap of ${Math.round(gap / 60000)} minutes between candles at index ${i - 1} and ${i} (expected ~${expectedMs / 60000} minutes). May be a normal market closure.`,
                index: i,
                timestamp: candles[i].timestamp,
            });
        }
    }
    return issues;
}
function checkSufficientCount(candles, minCandles) {
    if (candles.length < minCandles) {
        return [
            {
                type: 'INSUFFICIENT_CANDLE_COUNT',
                severity: 'error',
                message: `Only ${candles.length} usable candle(s) remain, but at least ${minCandles} are required.`,
            },
        ];
    }
    return [];
}
/**
 * The single entry point for data validation (Phase 4). Every candle series
 * from a provider must pass through this before reaching indicators,
 * analysis, or AI.
 *
 * Pipeline:
 *   1. Drop candles with invalid prices or bad OHLC relationships (error).
 *   2. Drop duplicate timestamps, keeping the first occurrence (error).
 *   3. Sort into chronological order if needed (error, auto-repaired).
 *   4. Flag (but don't remove) unusually large gaps between candles (warning).
 *   5. If too few usable candles remain, throw DataValidationError.
 *
 * Every issue found is logged. The function never throws for warnings -
 * only when the resulting series is too small/corrupted to be usable.
 */
function validateCandleSeries(rawCandles, timeframe, options = {}) {
    const minCandles = options.minCandles ?? exports.DEFAULT_MIN_CANDLES;
    const allIssues = [];
    if (rawCandles.length === 0) {
        const issue = {
            type: 'INSUFFICIENT_CANDLE_COUNT',
            severity: 'error',
            message: `Received 0 candles, but at least ${minCandles} are required.`,
        };
        logger.error(issue.message, { context: options.context });
        throw new types_1.DataValidationError('No candle data received.', [issue]);
    }
    const { clean, issues: candleIssues } = filterCorruptedCandles(rawCandles);
    allIssues.push(...candleIssues);
    const { deduped, issues: dupeIssues } = checkDuplicateTimestamps(clean);
    allIssues.push(...dupeIssues);
    const { sorted, issues: orderIssues } = sortAndDetectOutOfOrder(deduped);
    allIssues.push(...orderIssues);
    const gapIssues = detectGaps(sorted, timeframe);
    allIssues.push(...gapIssues);
    const countIssues = checkSufficientCount(sorted, minCandles);
    allIssues.push(...countIssues);
    for (const issue of allIssues) {
        const log = issue.severity === 'error' ? logger.error : logger.warn;
        log(issue.message, { type: issue.type, index: issue.index, context: options.context });
    }
    if (countIssues.length > 0) {
        throw new types_1.DataValidationError(`Candle series for ${options.context?.symbol ?? 'unknown symbol'} rejected: insufficient usable data after validation.`, allIssues);
    }
    return { candles: sorted, issues: allIssues };
}
//# sourceMappingURL=seriesValidator.js.map