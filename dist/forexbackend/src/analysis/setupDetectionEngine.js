"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SETUP_DEFINITIONS = void 0;
exports.detectSetups = detectSetups;
exports.rankAndFilterSetups = rankAndFilterSetups;
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('setupDetection');
const MIN_CONDITIONS_MET = 2;
const MAX_SETUPS_RETURNED = 3;
function isInZone(currentPrice, zoneLow, zoneHigh) {
    return currentPrice >= zoneLow && currentPrice <= zoneHigh;
}
function isNearResistance(currentPrice, resistances) {
    for (const level of resistances) {
        const zoneWidth = Math.max(level.zoneHigh - level.zoneLow, Number.EPSILON);
        const distanceToZone = currentPrice < level.zoneLow ? level.zoneLow - currentPrice : currentPrice > level.zoneHigh ? currentPrice - level.zoneHigh : 0;
        if (distanceToZone <= zoneWidth * 2.5) {
            return true;
        }
    }
    return false;
}
function isNearSupport(currentPrice, supports) {
    for (const level of supports) {
        const zoneWidth = Math.max(level.zoneHigh - level.zoneLow, Number.EPSILON);
        const distanceToZone = currentPrice < level.zoneLow ? level.zoneLow - currentPrice : currentPrice > level.zoneHigh ? currentPrice - level.zoneHigh : 0;
        if (distanceToZone <= zoneWidth * 2.5) {
            return true;
        }
    }
    return false;
}
function isAtOrAboveResistance(currentPrice, resistances) {
    return resistances.some((level) => currentPrice >= level.zoneLow);
}
function isAtOrBelowSupport(currentPrice, supports) {
    return supports.some((level) => currentPrice <= level.zoneHigh);
}
function hasRecentBOS(structure) {
    return structure.events.some((e) => e.type === 'break_of_structure' || e.type === 'change_of_character');
}
function findNearestSupport(currentPrice, supports) {
    let nearestBelow = null;
    let nearestAbove = null;
    for (const level of supports) {
        const distance = Math.abs(currentPrice - level.price);
        if (level.price <= currentPrice) {
            if (!nearestBelow || distance < nearestBelow.distance) {
                nearestBelow = { price: level.price, zoneLow: level.zoneLow, distance };
            }
        }
        else {
            if (!nearestAbove || distance < nearestAbove.distance) {
                nearestAbove = { price: level.price, zoneLow: level.zoneLow, distance };
            }
        }
    }
    return nearestBelow ? { price: nearestBelow.price, zoneLow: nearestBelow.zoneLow } :
        nearestAbove ? { price: nearestAbove.price, zoneLow: nearestAbove.zoneLow } : null;
}
function findNearestResistance(currentPrice, resistances) {
    let nearestAbove = null;
    let nearestBelow = null;
    for (const level of resistances) {
        const distance = Math.abs(currentPrice - level.price);
        if (level.price >= currentPrice) {
            if (!nearestAbove || distance < nearestAbove.distance) {
                nearestAbove = { price: level.price, zoneHigh: level.zoneHigh, distance };
            }
        }
        else {
            if (!nearestBelow || distance < nearestBelow.distance) {
                nearestBelow = { price: level.price, zoneHigh: level.zoneHigh, distance };
            }
        }
    }
    return nearestAbove ? { price: nearestAbove.price, zoneHigh: nearestAbove.zoneHigh } :
        nearestBelow ? { price: nearestBelow.price, zoneHigh: nearestBelow.zoneHigh } : null;
}
function higherTfOk(ctx) {
    return !ctx.multiTimeframe.higherTimeframeIncomplete;
}
function higherTfTrend(ctx, expected) {
    if (!higherTfOk(ctx))
        return false;
    return ctx.multiTimeframe.higherTimeframe?.trend === expected;
}
exports.SETUP_DEFINITIONS = [
    {
        setupName: 'Bullish Trend Continuation',
        direction: 'bullish',
        requiresHigherTfData: true,
        conditions: [
            { key: 'higherTfBullish', label: 'Higher timeframe trend bullish', check: (ctx) => higherTfTrend(ctx, 'bullish'), requiresHigherTf: true },
            { key: 'analysisTfBullish', label: 'Analysis timeframe trend bullish', check: (ctx) => ctx.multiTimeframe.analysis.trend === 'bullish' },
            { key: 'momentumBullish', label: 'Momentum bullish', check: (ctx) => ctx.momentum.momentum === 'bullish' },
            { key: 'noCounterTrend', label: 'No counter-trend momentum flag', check: (ctx) => !ctx.momentum.counterTrend },
        ],
        invalidationCondition: (ctx) => {
            const parts = [];
            if (ctx.multiTimeframe.higherTimeframe && higherTfOk(ctx)) {
                parts.push(`${ctx.multiTimeframe.higherTimeframe.timeframe} trend flips bearish`);
            }
            if (ctx.trend.ema.ema20) {
                parts.push(`price closes below ${ctx.trend.ema.ema20.toFixed(4)} (EMA20)`);
            }
            return parts.join(' or ') || 'analysis timeframe trend flips bearish';
        },
    },
    {
        setupName: 'Bearish Trend Continuation',
        direction: 'bearish',
        requiresHigherTfData: true,
        conditions: [
            { key: 'higherTfBearish', label: 'Higher timeframe trend bearish', check: (ctx) => higherTfTrend(ctx, 'bearish'), requiresHigherTf: true },
            { key: 'analysisTfBearish', label: 'Analysis timeframe trend bearish', check: (ctx) => ctx.multiTimeframe.analysis.trend === 'bearish' },
            { key: 'momentumBearish', label: 'Momentum bearish', check: (ctx) => ctx.momentum.momentum === 'bearish' },
            { key: 'noCounterTrend', label: 'No counter-trend momentum flag', check: (ctx) => !ctx.momentum.counterTrend },
        ],
        invalidationCondition: (ctx) => {
            const parts = [];
            if (ctx.multiTimeframe.higherTimeframe && higherTfOk(ctx)) {
                parts.push(`${ctx.multiTimeframe.higherTimeframe.timeframe} trend flips bullish`);
            }
            if (ctx.trend.ema.ema20) {
                parts.push(`price closes above ${ctx.trend.ema.ema20.toFixed(4)} (EMA20)`);
            }
            return parts.join(' or ') || 'analysis timeframe trend flips bullish';
        },
    },
    {
        setupName: 'Bullish Pullback',
        direction: 'bullish',
        requiresHigherTfData: true,
        conditions: [
            { key: 'mtfPullback', label: 'Multi-timeframe shows possible pullback', check: (ctx) => higherTfOk(ctx) && ctx.multiTimeframe.possiblePattern === 'possible pullback within an uptrend', requiresHigherTf: true },
            { key: 'nearSupport', label: 'Price near support', check: (ctx) => isNearSupport(ctx.currentPrice, ctx.supportResistance.supports) },
            { key: 'momentumNotStrongBearish', label: 'Momentum not strongly bearish', check: (ctx) => ctx.momentum.momentum !== 'bearish' || ctx.momentum.strength !== 'strong' },
        ],
        invalidationCondition: (ctx) => {
            const nearest = findNearestSupport(ctx.currentPrice, ctx.supportResistance.supports);
            return nearest ? `price closes below ${nearest.zoneLow.toFixed(4)}` : 'price closes below nearest support';
        },
    },
    {
        setupName: 'Bearish Pullback',
        direction: 'bearish',
        requiresHigherTfData: true,
        conditions: [
            { key: 'mtfBounce', label: 'Multi-timeframe shows possible bounce', check: (ctx) => higherTfOk(ctx) && ctx.multiTimeframe.possiblePattern === 'possible bounce within a downtrend', requiresHigherTf: true },
            { key: 'nearResistance', label: 'Price near resistance', check: (ctx) => isNearResistance(ctx.currentPrice, ctx.supportResistance.resistances) },
            { key: 'momentumNotStrongBullish', label: 'Momentum not strongly bullish', check: (ctx) => ctx.momentum.momentum !== 'bullish' || ctx.momentum.strength !== 'strong' },
        ],
        invalidationCondition: (ctx) => {
            const nearest = findNearestResistance(ctx.currentPrice, ctx.supportResistance.resistances);
            return nearest ? `price closes above ${nearest.zoneHigh.toFixed(4)}` : 'price closes above nearest resistance';
        },
    },
    {
        setupName: 'Bullish Breakout',
        direction: 'bullish',
        conditions: [
            { key: 'nearResistance', label: 'Price at or above resistance', check: (ctx) => isAtOrAboveResistance(ctx.currentPrice, ctx.supportResistance.resistances) },
            { key: 'hasBOS', label: 'Recent break of structure', check: (ctx) => hasRecentBOS(ctx.structure) },
            { key: 'volatilityNormalOrHigh', label: 'Volatility normal or high', check: (ctx) => ctx.volatility.classification === 'normal' || ctx.volatility.classification === 'high' },
        ],
        invalidationCondition: (ctx) => {
            const nearest = findNearestResistance(ctx.currentPrice, ctx.supportResistance.resistances);
            return nearest ? `price falls back below ${nearest.zoneHigh.toFixed(4)}` : 'price falls back below the resistance zone';
        },
    },
    {
        setupName: 'Bearish Breakout',
        direction: 'bearish',
        conditions: [
            { key: 'nearSupport', label: 'Price at or below support', check: (ctx) => isAtOrBelowSupport(ctx.currentPrice, ctx.supportResistance.supports) },
            { key: 'hasBOS', label: 'Recent break of structure', check: (ctx) => hasRecentBOS(ctx.structure) },
            { key: 'volatilityNormalOrHigh', label: 'Volatility normal or high', check: (ctx) => ctx.volatility.classification === 'normal' || ctx.volatility.classification === 'high' },
        ],
        invalidationCondition: (ctx) => {
            const nearest = findNearestSupport(ctx.currentPrice, ctx.supportResistance.supports);
            return nearest ? `price rises back above ${nearest.zoneLow.toFixed(4)}` : 'price rises back above the support zone';
        },
    },
    {
        setupName: 'Bullish Range Bounce',
        direction: 'bullish',
        conditions: [
            { key: 'structureRange', label: 'Market structure is range', check: (ctx) => ctx.structure.trend === 'range' },
            { key: 'nearSupport', label: 'Price near support', check: (ctx) => isNearSupport(ctx.currentPrice, ctx.supportResistance.supports) },
            { key: 'momentumBullish', label: 'Momentum bullish', check: (ctx) => ctx.momentum.momentum === 'bullish' },
        ],
        invalidationCondition: (ctx) => {
            const nearest = findNearestSupport(ctx.currentPrice, ctx.supportResistance.supports);
            return nearest ? `price breaks below ${nearest.zoneLow.toFixed(4)}` : 'price breaks below the support zone';
        },
    },
    {
        setupName: 'Bearish Range Bounce',
        direction: 'bearish',
        conditions: [
            { key: 'structureRange', label: 'Market structure is range', check: (ctx) => ctx.structure.trend === 'range' },
            { key: 'nearResistance', label: 'Price near resistance', check: (ctx) => isNearResistance(ctx.currentPrice, ctx.supportResistance.resistances) },
            { key: 'momentumBearish', label: 'Momentum bearish', check: (ctx) => ctx.momentum.momentum === 'bearish' },
        ],
        invalidationCondition: (ctx) => {
            const nearest = findNearestResistance(ctx.currentPrice, ctx.supportResistance.resistances);
            return nearest ? `price breaks above ${nearest.zoneHigh.toFixed(4)}` : 'price breaks above the resistance zone';
        },
    },
    {
        setupName: 'Bullish Momentum Continuation',
        direction: 'bullish',
        conditions: [
            { key: 'momentumStrongBullish', label: 'Momentum strong bullish', check: (ctx) => ctx.momentum.momentum === 'bullish' && ctx.momentum.strength === 'strong' },
            { key: 'trendAgrees', label: 'Trend direction matches setup', check: (ctx) => ctx.trend.trend === 'bullish' },
            { key: 'volatilityNotHigh', label: 'Volatility not high', check: (ctx) => ctx.volatility.classification !== 'high' },
            { key: 'noCounterTrend', label: 'No counter-trend flag', check: (ctx) => !ctx.momentum.counterTrend },
        ],
        invalidationCondition: (ctx) => {
            const parts = ['momentum flips bearish'];
            if (ctx.volatility.classification !== 'high') {
                parts.push('volatility spikes to high');
            }
            return parts.join(' or ');
        },
    },
    {
        setupName: 'Bearish Momentum Continuation',
        direction: 'bearish',
        conditions: [
            { key: 'momentumStrongBearish', label: 'Momentum strong bearish', check: (ctx) => ctx.momentum.momentum === 'bearish' && ctx.momentum.strength === 'strong' },
            { key: 'trendAgrees', label: 'Trend direction matches setup', check: (ctx) => ctx.trend.trend === 'bearish' },
            { key: 'volatilityNotHigh', label: 'Volatility not high', check: (ctx) => ctx.volatility.classification !== 'high' },
            { key: 'noCounterTrend', label: 'No counter-trend flag', check: (ctx) => !ctx.momentum.counterTrend },
        ],
        invalidationCondition: (ctx) => {
            const parts = ['momentum flips bullish'];
            if (ctx.volatility.classification !== 'high') {
                parts.push('volatility spikes to high');
            }
            return parts.join(' or ');
        },
    },
];
const BANNED_WORDS = /\b(buy|sell|enter|exit|target|stop|guaranteed|profit|loss|long|short|call|put)\b/i;
function checkBannedWords(text) {
    return BANNED_WORDS.test(text);
}
/**
 * Objective bias from MTF + analysis TF only — used to rank, not invent direction.
 * When HTF is incomplete, fall back to analysis TF alone (weaker ranking signal).
 */
function consensusDirection(ctx) {
    const analysis = ctx.multiTimeframe.analysis.trend;
    if (!higherTfOk(ctx) || !ctx.multiTimeframe.higherTimeframe) {
        return analysis === 'bullish' || analysis === 'bearish' ? analysis : 'neutral';
    }
    const higher = ctx.multiTimeframe.higherTimeframe.trend;
    if (higher === analysis && (higher === 'bullish' || higher === 'bearish')) {
        return higher;
    }
    return 'neutral';
}
function setupPriorityScore(setup, consensus) {
    let score = setup.conditionsMetCount * 10 + setup.strength;
    if (consensus !== 'neutral' && setup.direction === consensus) {
        score += 25;
    }
    else if (consensus !== 'neutral' && setup.direction !== consensus) {
        score -= 20;
    }
    if (setup.mtfIncomplete) {
        score -= 40;
    }
    return score;
}
function detectSetups(ctx) {
    const results = [];
    const mtfIncomplete = ctx.multiTimeframe.higherTimeframeIncomplete;
    for (const rule of exports.SETUP_DEFINITIONS) {
        if (rule.requiresHigherTfData && mtfIncomplete) {
            continue;
        }
        const conditionsMet = [];
        const conditionsMissing = [];
        for (const condition of rule.conditions) {
            const passed = condition.check(ctx);
            if (passed) {
                conditionsMet.push(condition.label);
            }
            else {
                conditionsMissing.push(condition.requiresHigherTf && mtfIncomplete
                    ? `${condition.label} (higher timeframe data incomplete)`
                    : condition.label);
            }
        }
        if (conditionsMet.length < MIN_CONDITIONS_MET) {
            continue;
        }
        const strength = Math.round((conditionsMet.length / rule.conditions.length) * 100);
        const invalidation = rule.invalidationCondition(ctx);
        const explanation = `${rule.setupName}: ${conditionsMet.length} of ${rule.conditions.length} conditions met. Invalidation: ${invalidation}.`;
        if (checkBannedWords(explanation)) {
            logger.error('Banned word found in setup explanation', { explanation, setup: rule.setupName });
            continue;
        }
        results.push({
            setup: rule.setupName,
            direction: rule.direction,
            strength,
            conditionsMet,
            conditionsMissing,
            conditionsMetCount: conditionsMet.length,
            conditionsTotal: rule.conditions.length,
            invalidationCondition: invalidation,
            mtfIncomplete: false,
            conditionsComplete: conditionsMet.length >= rule.conditions.length,
            status: conditionsMet.length >= rule.conditions.length ? 'conditions_met' : 'candidate',
        });
    }
    return rankAndFilterSetups(results, ctx);
}
/**
 * Rank by condition coverage + MTF consensus alignment.
 * Suppress opposite-direction noise when consensus is clear and coverage is weaker.
 * Cap to top N so the panel describes conditions, not a pile of conflicting cards.
 */
function rankAndFilterSetups(setups, ctx) {
    let filtered = filterOppositeBreakouts(setups);
    const consensus = consensusDirection(ctx);
    const analysisDirection = ctx.multiTimeframe.analysis.trend;
    // Do not present an opposite continuation as a peer candidate when the
    // analysis timeframe has a directional trend. It is not confirmation; it
    // is an unresolved counter-signal and belongs in the missing-evidence text.
    if (analysisDirection === 'bullish' || analysisDirection === 'bearish') {
        filtered = filtered.filter((setup) => !setup.setup.includes('Trend Continuation') ||
            setup.direction === analysisDirection ||
            setup.conditionsMetCount === setup.conditionsTotal);
    }
    if (consensus !== 'neutral') {
        const aligned = filtered.filter((s) => s.direction === consensus);
        const opposed = filtered.filter((s) => s.direction !== consensus);
        const bestAlignedCoverage = aligned.reduce((max, s) => Math.max(max, s.conditionsMetCount / s.conditionsTotal), 0);
        // Keep opposite setups only if they are at least as complete as the best aligned one
        // and meet all-but-one conditions — otherwise they are noise.
        filtered = [
            ...aligned,
            ...opposed.filter((s) => {
                const coverage = s.conditionsMetCount / s.conditionsTotal;
                return coverage >= Math.max(bestAlignedCoverage, 0.75) && s.conditionsMissing.length <= 1;
            }),
        ];
    }
    const ranked = [...filtered].sort((a, b) => setupPriorityScore(b, consensus) - setupPriorityScore(a, consensus));
    return ranked.slice(0, MAX_SETUPS_RETURNED).map((setup, index) => ({
        ...setup,
        rank: index + 1,
    }));
}
function filterOppositeBreakouts(setups) {
    const bullishBreakout = setups.find((s) => s.setup === 'Bullish Breakout');
    const bearishBreakout = setups.find((s) => s.setup === 'Bearish Breakout');
    if (bullishBreakout && bearishBreakout) {
        const strengthDiff = Math.abs(bullishBreakout.strength - bearishBreakout.strength);
        if (strengthDiff <= 10) {
            const stronger = bullishBreakout.strength >= bearishBreakout.strength ? bullishBreakout : bearishBreakout;
            const weaker = stronger === bullishBreakout ? bearishBreakout : bullishBreakout;
            return setups.filter((s) => s.setup !== weaker.setup);
        }
    }
    return setups;
}
//# sourceMappingURL=setupDetectionEngine.js.map