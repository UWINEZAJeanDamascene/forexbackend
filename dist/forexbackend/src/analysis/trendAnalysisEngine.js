"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeTrend = analyzeTrend;
/**
 * Trend scoring weights and direction thresholds.
 *
 * Design decisions documented here:
 *
 * 1. Neutral factors contribute 0, not a negative penalty.
 *    A factor returning "neutral" means "no clear directional evidence,"
 *    not "evidence of conflict." This means two bullish factors + two
 *    neutral factors can produce a bullish score even though only half
 *    the factors are actively bullish. If that is too sensitive for a
 *    given use case, raise BULLISH_THRESHOLD/BEARISH_THRESHOLD rather
 *    than penalizing neutrality.
 *
 * 2. Strength is derived from the same total score that determines trend
 *    direction. There is no second, independent strength calculation.
 *    Bands: |score| >= 70 => strong, 50-69 => moderate, <50 => weak.
 *
 * 3. Trend label thresholds are intentionally higher than the midpoint
 *    of the score range to reduce sensitivity. With four factors summing
 *    to a theoretical max of 100, a score of 50+ requires more than half
 *    of the maximum possible evidence before labeling the trend bullish.
 *
 * 4. Price vs EMA is EMA20-primary (what traders see on the chart).
 *    Price below EMA20 must not be labeled bullish merely because price
 *    remains above EMA50/EMA200. Longer EMAs only modulate magnitude.
 */
const TREND_WEIGHTS = {
    emaAlignment: 25,
    marketStructure: 30,
    priceVsEma: 20,
    recentHighsLows: 25,
};
const BULLISH_THRESHOLD = 50;
const BEARISH_THRESHOLD = -50;
const RANGE_OVERRIDE_THRESHOLD = 70;
function analyzeTrend(candles, indicators, structure) {
    const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : null;
    const ema20 = lastNonNil(indicators.ema20);
    const ema50 = lastNonNil(indicators.ema50);
    const ema200 = lastNonNil(indicators.ema200);
    const atrValue = lastNonNil(indicators.atr14);
    const emaAlignment = analyzeEmaAlignment(ema20, ema50, ema200, atrValue);
    const priceVsEmaBreakdown = buildPriceVsEmaBreakdown(currentPrice, ema20, ema50, ema200);
    const priceVsEma = analyzePriceVsEma(currentPrice, ema20, ema50, ema200, atrValue, priceVsEmaBreakdown);
    const marketStructure = analyzeMarketStructureFactor(structure);
    const recentHighsLows = analyzeRecentHighsLows(structure);
    const factors = {
        emaAlignment,
        marketStructure,
        priceVsEma,
        recentHighsLows,
    };
    let totalScore = 0;
    totalScore += emaAlignment.score;
    totalScore += marketStructure.score;
    totalScore += priceVsEma.score;
    totalScore += recentHighsLows.score;
    let trend;
    const rangeNeedsConfirmation = structure.trend === 'range' && Math.abs(totalScore) < RANGE_OVERRIDE_THRESHOLD;
    if (!rangeNeedsConfirmation && totalScore >= BULLISH_THRESHOLD) {
        trend = 'bullish';
    }
    else if (!rangeNeedsConfirmation && totalScore <= BEARISH_THRESHOLD) {
        trend = 'bearish';
    }
    else {
        trend = 'neutral';
    }
    const strength = deriveStrength(totalScore);
    return {
        trend,
        strength,
        score: totalScore,
        factors,
        priceVsEmaBreakdown,
        currentPrice: currentPrice ?? 0,
        ema: {
            ema20,
            ema50,
            ema200,
        },
        analyzedAt: new Date().toISOString(),
    };
}
function lastNonNil(values) {
    for (let i = values.length - 1; i >= 0; i--) {
        if (values[i] !== null && values[i] !== undefined) {
            return values[i];
        }
    }
    return null;
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function normalizeByAtr(delta, atr) {
    if (atr === null || atr <= 0)
        return delta > 0 ? 1 : delta < 0 ? -1 : 0;
    return delta / atr;
}
function analyzeEmaAlignment(ema20, ema50, ema200, atrValue) {
    if (ema20 === null || ema50 === null) {
        return {
            direction: 'neutral',
            score: 0,
            explanation: 'Insufficient EMA data for alignment analysis.',
        };
    }
    const separation20_50 = ema20 - ema50;
    const separation50_200 = ema200 !== null ? ema50 - ema200 : 0;
    const normalized20_50 = normalizeByAtr(Math.abs(separation20_50), atrValue);
    const normalized50_200 = ema200 !== null ? normalizeByAtr(Math.abs(separation50_200), atrValue) : 0;
    const avgNormalized = ema200 !== null ? (normalized20_50 + normalized50_200) / 2 : normalized20_50;
    const magnitude = clamp(avgNormalized / 2, 0, 1);
    if (ema200 !== null) {
        if (ema20 > ema50 && ema50 > ema200) {
            return {
                direction: 'bullish',
                score: Math.round(TREND_WEIGHTS.emaAlignment * magnitude),
                explanation: `EMA stack is bullish with normalized separation of ${avgNormalized.toFixed(2)}× ATR.`,
            };
        }
        if (ema20 < ema50 && ema50 < ema200) {
            return {
                direction: 'bearish',
                score: Math.round(-TREND_WEIGHTS.emaAlignment * magnitude),
                explanation: `EMA stack is bearish with normalized separation of ${avgNormalized.toFixed(2)}× ATR.`,
            };
        }
    }
    if (separation20_50 > 0) {
        return {
            direction: 'bullish',
            score: Math.round(TREND_WEIGHTS.emaAlignment * 0.6 * magnitude),
            explanation: `EMA20 is above EMA50 with normalized separation of ${normalized20_50.toFixed(2)}× ATR.`,
        };
    }
    if (separation20_50 < 0) {
        return {
            direction: 'bearish',
            score: Math.round(-TREND_WEIGHTS.emaAlignment * 0.6 * magnitude),
            explanation: `EMA20 is below EMA50 with normalized separation of ${normalized20_50.toFixed(2)}× ATR.`,
        };
    }
    return {
        direction: 'neutral',
        score: 0,
        explanation: 'EMA20 and EMA50 are closely aligned with no clear direction.',
    };
}
function sideVsEma(price, ema) {
    if (ema === null)
        return null;
    if (price > ema)
        return 'bullish';
    if (price < ema)
        return 'bearish';
    return 'neutral';
}
function buildPriceVsEmaBreakdown(price, ema20, ema50, ema200) {
    if (price === null) {
        return {
            vsEma20: null,
            vsEma50: null,
            vsEma200: null,
            ema20,
            ema50,
            ema200,
        };
    }
    return {
        vsEma20: sideVsEma(price, ema20),
        vsEma50: sideVsEma(price, ema50),
        vsEma200: sideVsEma(price, ema200),
        ema20,
        ema50,
        ema200,
    };
}
/**
 * EMA20-primary price factor.
 * Longer EMAs may reduce magnitude when they disagree, but they must not
 * flip the label against the EMA20 side traders see on the chart.
 */
function analyzePriceVsEma(price, ema20, ema50, ema200, atrValue, breakdown) {
    if (price === null) {
        return {
            direction: 'neutral',
            score: 0,
            explanation: 'Current price is unavailable.',
        };
    }
    if (ema20 === null && ema50 === null && ema200 === null) {
        return {
            direction: 'neutral',
            score: 0,
            explanation: 'Insufficient EMA data for price comparison.',
        };
    }
    const primary = breakdown.vsEma20;
    const parts = [];
    if (breakdown.vsEma20 !== null && ema20 !== null) {
        parts.push(`EMA20 ${breakdown.vsEma20 === 'bullish' ? 'above' : breakdown.vsEma20 === 'bearish' ? 'below' : 'at'} ${ema20.toFixed(5)}`);
    }
    if (breakdown.vsEma50 !== null && ema50 !== null) {
        parts.push(`EMA50 ${breakdown.vsEma50 === 'bullish' ? 'above' : breakdown.vsEma50 === 'bearish' ? 'below' : 'at'} ${ema50.toFixed(5)}`);
    }
    if (breakdown.vsEma200 !== null && ema200 !== null) {
        parts.push(`EMA200 ${breakdown.vsEma200 === 'bullish' ? 'above' : breakdown.vsEma200 === 'bearish' ? 'below' : 'at'} ${ema200.toFixed(5)}`);
    }
    // No EMA20: fall back to stack majority (honest about missing chart EMA).
    if (primary === null) {
        const sides = [breakdown.vsEma50, breakdown.vsEma200].filter((s) => s !== null);
        const bullish = sides.filter((s) => s === 'bullish').length;
        const bearish = sides.filter((s) => s === 'bearish').length;
        let direction = 'neutral';
        if (bullish > bearish)
            direction = 'bullish';
        else if (bearish > bullish)
            direction = 'bearish';
        const mag = clamp(sides.length > 0 ? Math.abs(bullish - bearish) / sides.length : 0, 0, 1);
        return {
            direction,
            score: Math.round(TREND_WEIGHTS.priceVsEma * 0.5 * mag * (direction === 'bullish' ? 1 : direction === 'bearish' ? -1 : 0)),
            explanation: `EMA20 unavailable. Stack fallback: ${parts.join('; ') || 'no EMA data'}.`,
        };
    }
    if (primary === 'neutral') {
        return {
            direction: 'neutral',
            score: 0,
            explanation: `Price is at EMA20. ${parts.join('; ')}.`,
        };
    }
    const distanceToEma20 = ema20 !== null ? Math.abs(price - ema20) : 0;
    const normalizedDistance = normalizeByAtr(distanceToEma20, atrValue);
    let magnitude = clamp(normalizedDistance / 2, 0.25, 1);
    // Longer EMAs confirm or dampen — they do not override EMA20 direction.
    const longer = [breakdown.vsEma50, breakdown.vsEma200].filter((s) => s !== null && s !== 'neutral');
    if (longer.length > 0) {
        const agreeing = longer.filter((s) => s === primary).length;
        const disagreeing = longer.length - agreeing;
        if (disagreeing > agreeing) {
            magnitude *= 0.45;
            parts.push('longer EMAs disagree with EMA20 (score dampened)');
        }
        else if (agreeing === longer.length) {
            magnitude = clamp(magnitude * 1.15, 0, 1);
        }
        else {
            magnitude *= 0.75;
            parts.push('mixed longer-EMA confirmation');
        }
    }
    const signed = primary === 'bullish' ? 1 : -1;
    return {
        direction: primary,
        score: Math.round(TREND_WEIGHTS.priceVsEma * magnitude * signed),
        explanation: `Price is ${primary === 'bullish' ? 'above' : 'below'} EMA20 (chart reference). ${parts.join('; ')}.`,
    };
}
function analyzeMarketStructureFactor(structure) {
    const { higherHighsCount, higherLowsCount, lowerHighsCount, lowerLowsCount } = structure;
    const total = higherHighsCount + higherLowsCount + lowerHighsCount + lowerLowsCount;
    if (total === 0) {
        return {
            direction: 'neutral',
            score: 0,
            explanation: 'Insufficient swing points to determine market structure.',
        };
    }
    const bullishCount = higherHighsCount + higherLowsCount;
    const bearishCount = lowerHighsCount + lowerLowsCount;
    const ratio = (bullishCount - bearishCount) / total;
    const magnitude = clamp(Math.abs(ratio), 0, 1);
    const structureTrend = structure.trend;
    if (structureTrend === 'bullish') {
        const score = Math.round(TREND_WEIGHTS.marketStructure * clamp(magnitude * 1.5, 0.5, 1));
        return {
            direction: 'bullish',
            score,
            explanation: `Market structure is bullish (${bullishCount} bullish vs ${bearishCount} bearish classifications).`,
        };
    }
    if (structureTrend === 'bearish') {
        const score = Math.round(-TREND_WEIGHTS.marketStructure * clamp(magnitude * 1.5, 0.5, 1));
        return {
            direction: 'bearish',
            score,
            explanation: `Market structure is bearish (${bearishCount} bearish vs ${bullishCount} bullish classifications).`,
        };
    }
    return {
        direction: 'neutral',
        score: 0,
        explanation: `Market structure is mixed/ranging (${bullishCount} bullish vs ${bearishCount} bearish).`,
    };
}
function analyzeRecentHighsLows(structure) {
    const { higherHighsCount, higherLowsCount, lowerHighsCount, lowerLowsCount } = structure;
    const total = higherHighsCount + higherLowsCount + lowerHighsCount + lowerLowsCount;
    if (total === 0) {
        return {
            direction: 'neutral',
            score: 0,
            explanation: 'Insufficient recent swing data for highs/lows analysis.',
        };
    }
    const bullishCount = higherHighsCount + higherLowsCount;
    const bearishCount = lowerHighsCount + lowerLowsCount;
    const ratio = (bullishCount - bearishCount) / total;
    const magnitude = clamp(Math.abs(ratio), 0, 1);
    const score = Math.round(TREND_WEIGHTS.recentHighsLows * ratio);
    let direction;
    if (score > 0)
        direction = 'bullish';
    else if (score < 0)
        direction = 'bearish';
    else
        direction = 'neutral';
    return {
        direction,
        score,
        explanation: `Recent swings show ${bullishCount} bullish vs ${bearishCount} bearish events (net ${(ratio * 100).toFixed(0)}% bias).`,
    };
}
function deriveStrength(score) {
    const absScore = Math.abs(score);
    if (absScore >= 70) {
        return 'strong';
    }
    if (absScore >= 50) {
        return 'moderate';
    }
    return 'weak';
}
//# sourceMappingURL=trendAnalysisEngine.js.map