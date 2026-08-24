"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateHistoricalStrategy = evaluateHistoricalStrategy;
exports.getEntryEligibility = getEntryEligibility;
function priceNearLevel(price, zoneLow, zoneHigh) {
    const width = Math.max(zoneHigh - zoneLow, Number.EPSILON);
    const distance = price < zoneLow ? zoneLow - price : price > zoneHigh ? price - zoneHigh : 0;
    return distance <= width * 2.5;
}
function evaluateConditions(snapshot, config, direction) {
    const met = [];
    const missing = [];
    const currentPrice = snapshot.trend.currentPrice;
    const expectedTrend = config.requiredTrend ?? direction;
    if (expectedTrend === direction && snapshot.trend.trend === direction)
        met.push(`Trend: ${direction}`);
    else
        missing.push(`Trend: ${direction}`);
    if (config.requireMarketStructure) {
        if (snapshot.structure.trend === direction)
            met.push(`Market structure: ${direction}`);
        else
            missing.push(`Market structure: ${direction}`);
    }
    if (config.requireSupportResistance) {
        const levels = direction === 'bullish' ? snapshot.supportResistance.supports : snapshot.supportResistance.resistances;
        const nearLevel = levels.some((level) => priceNearLevel(currentPrice, level.zoneLow, level.zoneHigh));
        if (nearLevel)
            met.push(direction === 'bullish' ? 'Price near support' : 'Price near resistance');
        else
            missing.push(direction === 'bullish' ? 'Price near support' : 'Price near resistance');
    }
    if (config.requireMomentum) {
        if (snapshot.momentum.momentum === direction)
            met.push(`Momentum: ${direction}`);
        else
            missing.push(`Momentum: ${direction}`);
    }
    if (config.requireVolatility) {
        if (snapshot.volatility.dataQuality.sufficient)
            met.push(`Volatility data available: ${snapshot.volatility.classification}`);
        else
            missing.push('Sufficient volatility data');
    }
    if (config.requireHigherTimeframeAlignment) {
        const higherTrends = Object.values(snapshot.higherTimeframeTrends);
        if (higherTrends.length > 0 && higherTrends.every((trend) => trend.trend === direction))
            met.push(`Higher timeframes aligned: ${direction}`);
        else
            missing.push(`Higher timeframes aligned: ${direction}`);
    }
    return { met, missing };
}
function evaluateHistoricalStrategy(snapshot, decisionIndex, candles, config, execution) {
    const direction = config.requiredTrend === 'bearish' || snapshot.trend.trend === 'bearish' ? 'bearish' : 'bullish';
    const conditions = evaluateConditions(snapshot, config, direction);
    const setup = conditions.met.length >= config.minimumConditions
        ? {
            timestamp: snapshot.decisionTimestamp,
            direction,
            entryPrice: snapshot.trend.currentPrice,
            conditionsMet: conditions.met,
            conditionsMissing: conditions.missing,
            snapshot,
        }
        : null;
    return {
        setup,
        entry: getEntryEligibility(decisionIndex, candles, execution.entryModel, execution.entryPriceLevel),
    };
}
function getEntryEligibility(decisionIndex, candles, model, entryPriceLevel) {
    const decisionCandle = candles[decisionIndex];
    if (!decisionCandle) {
        return { eligible: false, model, decisionIndex, entryIndex: null, entryTimestamp: null, reason: 'Decision candle does not exist.' };
    }
    if (model === 'signal_close') {
        return { eligible: true, model, decisionIndex, entryIndex: decisionIndex, entryTimestamp: decisionCandle.timestamp, reason: 'Entry is eligible at the completed signal candle close.' };
    }
    if (model === 'price_level') {
        if (entryPriceLevel === undefined || !Number.isFinite(entryPriceLevel) || entryPriceLevel <= 0) {
            return { eligible: false, model, decisionIndex, entryIndex: null, entryTimestamp: null, reason: 'A positive entry price level is required.' };
        }
        for (let entryIndex = decisionIndex + 1; entryIndex < candles.length; entryIndex += 1) {
            const candle = candles[entryIndex];
            if (candle.low <= entryPriceLevel && candle.high >= entryPriceLevel) {
                return { eligible: true, model, decisionIndex, entryIndex, entryTimestamp: candle.timestamp, reason: 'Entry is eligible when the configured price level is reached.' };
            }
        }
        return { eligible: false, model, decisionIndex, entryIndex: null, entryTimestamp: null, reason: 'The configured price level was not reached.' };
    }
    const entryIndex = decisionIndex + 1;
    const entryCandle = candles[entryIndex];
    if (!entryCandle) {
        return { eligible: false, model, decisionIndex, entryIndex: null, entryTimestamp: null, reason: 'No next candle is available for execution.' };
    }
    if (model === 'next_candle_open') {
        return { eligible: true, model, decisionIndex, entryIndex, entryTimestamp: entryCandle.timestamp, reason: 'Entry is eligible at the next candle open.' };
    }
    return { eligible: false, model, decisionIndex, entryIndex, entryTimestamp: null, reason: 'Entry model is not supported.' };
}
//# sourceMappingURL=historicalStrategyEvaluator.js.map