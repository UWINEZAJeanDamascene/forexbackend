"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeVolatility = analyzeVolatility;
const MIN_CANDLES = 60;
const ROLLING_BASELINE_PERIOD = 100;
const ATR_LOW_THRESHOLD = 0.7;
const ATR_HIGH_THRESHOLD = 1.3;
const PERCENTILE_LOW_THRESHOLD = 30;
const PERCENTILE_HIGH_THRESHOLD = 70;
const VOLATILITY_EXPLAINERS = {
    low: 'Price is moving less than usual. Ranges may be tighter and moves slower to develop.',
    normal: 'Price is moving within its typical recent range.',
    high: 'Price is moving more than usual. Moves can be faster and stop-outs more likely — this reflects market activity, not direction.',
};
function analyzeVolatility(candles, indicators) {
    if (candles.length < MIN_CANDLES) {
        return {
            classification: 'normal',
            score: 0,
            currentAtr: 0,
            averageAtr: 0,
            atrPercentile: 0,
            bandWidth: 0,
            bandWidthPercentile: 0,
            bandDisagreement: false,
            explanation: 'Insufficient data for volatility analysis.',
            dataQuality: {
                sufficient: false,
                candleCount: candles.length,
                minimumRequired: MIN_CANDLES,
            },
        };
    }
    const atrSeries = indicators.atr14.filter((v) => v !== null);
    const currentAtr = atrSeries.length > 0 ? atrSeries[atrSeries.length - 1] : 0;
    if (currentAtr <= 0) {
        return {
            classification: 'normal',
            score: 0,
            currentAtr: 0,
            averageAtr: 0,
            atrPercentile: 0,
            bandWidth: 0,
            bandWidthPercentile: 0,
            bandDisagreement: false,
            explanation: 'ATR is zero or negative; volatility cannot be assessed.',
            dataQuality: {
                sufficient: true,
                candleCount: candles.length,
                minimumRequired: MIN_CANDLES,
            },
        };
    }
    const rollingBaseline = computeRollingBaseline(atrSeries, currentAtr);
    const averageAtr = rollingBaseline.average;
    const atrRatio = currentAtr / averageAtr;
    const atrPercentile = percentileRank(rollingBaseline.values, currentAtr);
    const upperSeries = indicators.bollingerBands.upper.filter((v) => v !== null);
    const lowerSeries = indicators.bollingerBands.lower.filter((v) => v !== null);
    const bandWidth = upperSeries.length > 0 && lowerSeries.length > 0
        ? upperSeries[upperSeries.length - 1] - lowerSeries[lowerSeries.length - 1]
        : 0;
    const bandWidths = computeBandWidths(indicators.bollingerBands);
    const bandWidthPercentile = bandWidths.length > 0
        ? percentileRank(bandWidths, bandWidth)
        : 0;
    const bandDisagreement = bandWidth > 0 ? detectBandDisagreement(atrPercentile, bandWidthPercentile) : false;
    let classification;
    if (atrPercentile < PERCENTILE_LOW_THRESHOLD) {
        classification = 'low';
    }
    else if (atrPercentile > PERCENTILE_HIGH_THRESHOLD) {
        classification = 'high';
    }
    else {
        classification = 'normal';
    }
    const score = atrPercentile;
    const explanation = generateExplanation(classification, currentAtr, averageAtr, atrPercentile, atrRatio, bandWidth, bandWidthPercentile, bandDisagreement, rollingBaseline.count);
    return {
        classification,
        score,
        currentAtr,
        averageAtr,
        atrPercentile,
        bandWidth,
        bandWidthPercentile,
        bandDisagreement,
        explanation,
        dataQuality: {
            sufficient: true,
            candleCount: candles.length,
            minimumRequired: MIN_CANDLES,
        },
    };
}
function computeRollingBaseline(atrSeries, currentAtr) {
    const lookback = Math.min(ROLLING_BASELINE_PERIOD, atrSeries.length - 1);
    if (lookback <= 0) {
        return { average: currentAtr, count: 0, values: [] };
    }
    const baselineValues = atrSeries.slice(-lookback - 1, -1);
    const sum = baselineValues.reduce((acc, val) => acc + val, 0);
    const count = baselineValues.length;
    return {
        average: count > 0 ? sum / count : currentAtr,
        count,
        values: baselineValues,
    };
}
function computeBandWidths(bollingerBands) {
    const upper = bollingerBands.upper.filter((v) => v !== null);
    const lower = bollingerBands.lower.filter((v) => v !== null);
    const lengths = Math.min(upper.length, lower.length);
    if (lengths === 0)
        return [];
    const widths = [];
    for (let i = 0; i < lengths; i++) {
        widths.push(upper[i] - lower[i]);
    }
    return widths;
}
function percentileRank(values, target) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = sorted.filter((v) => v <= target).length;
    return Math.round((rank / sorted.length) * 100);
}
function detectBandDisagreement(atrPercentile, bandWidthPercentile) {
    const gap = Math.abs(atrPercentile - bandWidthPercentile);
    const atrExtreme = atrPercentile <= 20 || atrPercentile >= 80;
    const bbExtreme = bandWidthPercentile <= 20 || bandWidthPercentile >= 80;
    const atrMiddle = !atrExtreme;
    const bbMiddle = !bbExtreme;
    // Both in extreme but opposite ends (e.g., ATR high, BB low)
    if (atrExtreme && bbExtreme && gap >= 60)
        return true;
    // One extreme, the other in middle territory
    if ((atrExtreme && bbMiddle) || (bbExtreme && atrMiddle))
        return true;
    // Both in middle but significantly diverged
    if (atrMiddle && bbMiddle && gap >= 25)
        return true;
    return false;
}
function generateExplanation(classification, currentAtr, averageAtr, atrPercentile, atrRatio, bandWidth, bandWidthPercentile, bandDisagreement, baselineCount) {
    const explainer = VOLATILITY_EXPLAINERS[classification];
    let narrative = `ATR is ${currentAtr.toFixed(4)}, at the ${atrPercentile}th percentile of its ${baselineCount > 0 ? `${baselineCount}-period` : 'rolling'} history (${Math.round(atrRatio * 100)}% of average) — volatility is ${classification} (below ${PERCENTILE_LOW_THRESHOLD}th percentile = low, ${PERCENTILE_HIGH_THRESHOLD}th+ = high).`;
    if (bandWidth > 0 && baselineCount > 0) {
        const bandWidthDirection = bandWidthPercentile > 60 ? 'expanding' : bandWidthPercentile < 40 ? 'contracting' : 'stable';
        narrative += ` Bollinger Band width is ${bandWidth.toFixed(4)} (${bandWidthPercentile}th percentile, ${bandWidthDirection}).`;
    }
    if (bandDisagreement) {
        narrative += ' ATR and Bollinger Band width are giving mixed signals — volatility may be shifting unevenly.';
    }
    return `${explainer} ${narrative}`;
}
//# sourceMappingURL=volatilityAnalysisEngine.js.map