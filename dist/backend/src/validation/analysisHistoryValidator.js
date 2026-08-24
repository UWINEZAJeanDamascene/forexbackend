"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSaveAnalysisRequest = validateSaveAnalysisRequest;
const instruments_1 = require("../../../shared/constants/instruments");
const STATUSES = ['complete', 'incomplete', 'error'];
const TRENDS = ['bullish', 'bearish', 'neutral'];
const STRUCTURE_TRENDS = ['bullish', 'bearish', 'range', 'unclear'];
const LEVEL_TYPES = ['support', 'resistance'];
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function isDate(value) {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
function validateSaveAnalysisRequest(value) {
    const errors = [];
    if (!isRecord(value))
        return ['Request body must be an object.'];
    if (!instruments_1.ENABLED_SYMBOLS.includes(value.symbol))
        errors.push('symbol is not enabled.');
    if (!instruments_1.ENABLED_TIMEFRAMES.includes(value.timeframe))
        errors.push('timeframe is not enabled.');
    if (value.status !== undefined && !STATUSES.includes(value.status))
        errors.push('status must be complete, incomplete, or error.');
    if (!isDate(value.analysisTimestamp))
        errors.push('analysisTimestamp must be a valid timestamp.');
    if (value.marketDataTimestamp !== undefined && !isDate(value.marketDataTimestamp))
        errors.push('marketDataTimestamp must be a valid timestamp.');
    if (!isFiniteNumber(value.currentPrice) || value.currentPrice <= 0)
        errors.push('currentPrice must be a positive finite number.');
    if (typeof value.dataProvider !== 'string' || value.dataProvider.trim().length === 0)
        errors.push('dataProvider is required.');
    if (!TRENDS.includes(value.trend))
        errors.push('trend must be bullish, bearish, or neutral.');
    if (typeof value.momentum !== 'string' || value.momentum.trim().length === 0)
        errors.push('momentum is required.');
    if (typeof value.volatility !== 'string' || value.volatility.trim().length === 0)
        errors.push('volatility is required.');
    if (!STRUCTURE_TRENDS.includes(value.structureTrend))
        errors.push('structureTrend is invalid.');
    for (const field of ['higherHighsCount', 'higherLowsCount', 'lowerHighsCount', 'lowerLowsCount']) {
        if (!Number.isInteger(value[field]) || value[field] < 0)
            errors.push(`${field} must be a non-negative integer.`);
    }
    if (!Number.isInteger(value.confidenceScore) || value.confidenceScore < 0 || value.confidenceScore > 100)
        errors.push('confidenceScore must be an integer between 0 and 100.');
    if (value.tradeQualityReasons !== undefined && !isStringArray(value.tradeQualityReasons))
        errors.push('tradeQualityReasons must be an array of strings.');
    if (value.setupConditionsMet !== undefined && !isStringArray(value.setupConditionsMet))
        errors.push('setupConditionsMet must be an array of strings.');
    if (value.setupConditionsMissing !== undefined && !isStringArray(value.setupConditionsMissing))
        errors.push('setupConditionsMissing must be an array of strings.');
    if (value.historicalCandles !== undefined)
        validateCandles(value.historicalCandles, errors);
    if (value.indicators !== undefined)
        validateIndicators(value.indicators, errors);
    if (value.structureSnapshot !== undefined)
        validateStructure(value.structureSnapshot, errors);
    if (value.srLevels !== undefined)
        validateLevels(value.srLevels, errors);
    return errors;
}
function validateCandles(value, errors) {
    if (!Array.isArray(value) || value.length === 0 || value.length > 500) {
        errors.push('historicalCandles must contain between 1 and 500 candles.');
        return;
    }
    value.forEach((candle, index) => {
        if (!isRecord(candle) || !isDate(candle.timestamp) || !['open', 'high', 'low', 'close'].every((field) => isFiniteNumber(candle[field]))) {
            errors.push(`historicalCandles[${index}] must contain a valid timestamp and OHLC numbers.`);
            return;
        }
        if (candle.high < candle.low || candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0)
            errors.push(`historicalCandles[${index}] contains invalid OHLC relationships.`);
        if (candle.volume !== undefined && candle.volume !== null && !isFiniteNumber(candle.volume))
            errors.push(`historicalCandles[${index}].volume must be finite.`);
    });
}
function validateIndicators(value, errors) {
    if (!Array.isArray(value)) {
        errors.push('indicators must be an array.');
        return;
    }
    value.forEach((indicator, index) => {
        if (!isRecord(indicator) || typeof indicator.type !== 'string' || indicator.type.trim().length === 0)
            errors.push(`indicators[${index}].type is required.`);
        if (indicator.period !== undefined && (!Number.isInteger(indicator.period) || indicator.period <= 0))
            errors.push(`indicators[${index}].period must be positive.`);
        for (const field of ['value', 'upperBand', 'middleBand', 'lowerBand', 'macdLine', 'signalLine', 'histogram'])
            if (indicator[field] !== undefined && !isFiniteNumber(indicator[field]))
                errors.push(`indicators[${index}].${field} must be finite.`);
    });
}
function validateStructure(value, errors) {
    if (!isRecord(value) || !STRUCTURE_TRENDS.includes(value.trend))
        errors.push('structureSnapshot.trend is invalid.');
    if (isRecord(value) && value.events !== undefined && !Array.isArray(value.events))
        errors.push('structureSnapshot.events must be an array.');
    if (isRecord(value) && value.latestEventTimestamp !== undefined && !isDate(value.latestEventTimestamp))
        errors.push('structureSnapshot.latestEventTimestamp must be valid.');
    if (isRecord(value) && value.latestEventPrice !== undefined && !isFiniteNumber(value.latestEventPrice))
        errors.push('structureSnapshot.latestEventPrice must be finite.');
}
function validateLevels(value, errors) {
    if (!Array.isArray(value)) {
        errors.push('srLevels must be an array.');
        return;
    }
    value.forEach((level, index) => {
        if (!isRecord(level) || !LEVEL_TYPES.includes(level.type))
            errors.push(`srLevels[${index}].type is invalid.`);
        for (const field of ['price', 'zoneLow', 'zoneHigh', 'strength', 'touches'])
            if (isRecord(level) && level[field] !== undefined && !isFiniteNumber(level[field]))
                errors.push(`srLevels[${index}].${field} must be finite.`);
        if (isRecord(level) && (!isFiniteNumber(level.strength) || level.strength < 0 || level.strength > 100))
            errors.push(`srLevels[${index}].strength must be between 0 and 100.`);
        if (isRecord(level) && level.lastReactionTime !== undefined && !isDate(level.lastReactionTime))
            errors.push(`srLevels[${index}].lastReactionTime must be valid.`);
    });
}
//# sourceMappingURL=analysisHistoryValidator.js.map