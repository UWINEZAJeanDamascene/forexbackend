"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectSupportResistance = detectSupportResistance;
const atr_1 = require("../indicators/atr");
const DEFAULT_SWING_WINDOW = 2;
const ATR_MULTIPLIER = 0.5;
const ATR_PERIOD = 14;
const MIN_STRENGTH = 35;
const MAX_LEVELS = 3;
const PROXIMITY_ATR_MULTIPLE = 3.0;
function roundPrice(price, precision) {
    const factor = Math.pow(10, precision);
    return Math.round(price * factor) / factor;
}
function normalizeLevelPrice(level, symbol) {
    const precision = symbol.includes('JPY') ? 3 : symbol === 'XAU/USD' ? 2 : symbol ? 5 : 4;
    return {
        ...level,
        price: roundPrice(level.price, precision),
        zoneLow: roundPrice(level.zoneLow, precision),
        zoneHigh: roundPrice(level.zoneHigh, precision),
    };
}
const RELEVANCE_WINDOW = 100;
/** Cap zone width so clusters cannot span most of the visible range. */
const MAX_ZONE_WIDTH_ATR = 1.0;
/** Soft swing levels kept when hard clusters leave a side empty near price. */
const SOFT_LEVEL_STRENGTH = 48;
const SOFT_LEVEL_ZONE_ATR = 0.35;
function detectSupportResistance(candles, swingWindow = DEFAULT_SWING_WINDOW, options = {}) {
    if (candles.length < swingWindow * 2 + 1) {
        return {
            symbol: '',
            timeframe: '',
            supports: [],
            resistances: [],
            tested: [],
        };
    }
    const swingHighs = findSwingHighs(candles, swingWindow, options.confirmedSwingOnly ?? false);
    const swingLows = findSwingLows(candles, swingWindow, options.confirmedSwingOnly ?? false);
    const atrValues = (0, atr_1.atr)(candles, Math.min(ATR_PERIOD, Math.max(candles.length - 1, 1)));
    const currentAtr = lastNonNil(atrValues);
    const tolerance = currentAtr !== null
        ? currentAtr * ATR_MULTIPLIER
        : Math.max((Math.max(...candles.map((c) => c.high)) - Math.min(...candles.map((c) => c.low))) * 0.05, 0.0001);
    const resistanceZones = clusterAndScore(swingHighs, 'resistance', candles, tolerance);
    const supportZones = clusterAndScore(swingLows, 'support', candles, tolerance);
    const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : null;
    const allLevels = [...resistanceZones, ...supportZones];
    const maxTouches = allLevels.length > 0 ? Math.max(...allLevels.map((l) => l.touches)) : 1;
    const withStrength = allLevels.map((level) => ({
        ...level,
        strength: calculateStrength(level.touches, level.lastReactionTime, candles, maxTouches),
    }));
    const merged = mergeSupportResistanceLevels(withStrength);
    const { supports, resistances, tested } = classifyZones(merged, currentPrice, currentAtr, candles);
    ensureNearestSwingLevels(supports, resistances, tested, swingHighs, swingLows, currentPrice, currentAtr);
    // Clamp first, then merge again. Clamping can make two previously separate
    // zones touch on their final displayed boundaries, including across the
    // support/tested/resistance categories.
    const normalizedLevels = [...supports, ...resistances, ...tested]
        .filter((level) => level.strength >= MIN_STRENGTH)
        .map((level) => {
        const clamped = clampZoneWidth(level, currentAtr);
        return {
            ...level,
            zoneLow: clamped.zoneLow,
            zoneHigh: clamped.zoneHigh,
            price: Math.min(Math.max(clamped.price, clamped.zoneLow), clamped.zoneHigh),
        };
    });
    const finalClassified = classifyZones(mergeSupportResistanceLevels(normalizedLevels), currentPrice, currentAtr, candles);
    const finalResistances = finalClassified.resistances.sort((a, b) => b.strength - a.strength);
    const finalSupports = finalClassified.supports.sort((a, b) => b.strength - a.strength);
    const finalTested = finalClassified.tested.sort((a, b) => b.strength - a.strength);
    return {
        symbol: '',
        timeframe: '',
        supports: finalSupports.slice(0, MAX_LEVELS),
        resistances: finalResistances.slice(0, MAX_LEVELS),
        tested: finalTested.slice(0, MAX_LEVELS),
    };
}
function findSwingHighs(candles, window, confirmedSwingOnly) {
    const swings = [];
    const len = candles.length;
    for (let i = window; i < len; i++) {
        if (confirmedSwingOnly && i + window >= len)
            continue;
        const currentHigh = candles[i].high;
        let isSwingHigh = true;
        for (let j = i - window; j <= i + window; j++) {
            if (j === i)
                continue;
            if (j >= len)
                break;
            if (candles[j].high >= currentHigh) {
                isSwingHigh = false;
                break;
            }
        }
        if (isSwingHigh) {
            swings.push({
                price: currentHigh,
                timestamp: candles[i].timestamp,
                index: i,
            });
        }
    }
    return swings;
}
function findSwingLows(candles, window, confirmedSwingOnly) {
    const swings = [];
    const len = candles.length;
    for (let i = window; i < len; i++) {
        if (confirmedSwingOnly && i + window >= len)
            continue;
        const currentLow = candles[i].low;
        let isSwingLow = true;
        for (let j = i - window; j <= i + window; j++) {
            if (j === i)
                continue;
            if (j >= len)
                break;
            if (candles[j].low <= currentLow) {
                isSwingLow = false;
                break;
            }
        }
        if (isSwingLow) {
            swings.push({
                price: currentLow,
                timestamp: candles[i].timestamp,
                index: i,
            });
        }
    }
    return swings;
}
function clusterAndScore(swings, type, candles, tolerance) {
    if (swings.length === 0)
        return [];
    const sorted = [...swings].sort((a, b) => a.price - b.price);
    const zones = [];
    const effectiveTolerance = tolerance;
    for (const swing of sorted) {
        const cluster = zones.find((z) => Math.abs(swing.price - z.price) <= effectiveTolerance);
        if (cluster) {
            cluster.swings.push(swing);
            const totalTouches = cluster.swings.length;
            cluster.price = cluster.swings.reduce((sum, s) => sum + s.price, 0) / totalTouches;
            cluster.zoneLow = Math.min(...cluster.swings.map((s) => s.price));
            cluster.zoneHigh = Math.max(...cluster.swings.map((s) => s.price));
        }
        else {
            zones.push({
                price: swing.price,
                zoneLow: swing.price,
                zoneHigh: swing.price,
                swings: [swing],
            });
        }
    }
    for (const zone of zones) {
        const clusterRange = zone.zoneHigh - zone.zoneLow || effectiveTolerance;
        const padding = Math.max(clusterRange * 0.1, effectiveTolerance * 0.5);
        zone.zoneLow = zone.zoneLow - padding;
        zone.zoneHigh = zone.zoneHigh + padding;
    }
    const merged = mergeOverlappingZones(zones, effectiveTolerance * 2);
    return merged
        .map((zone) => {
        const touches = zone.swings.length;
        const lastReactionTime = zone.swings.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp;
        return {
            price: zone.price,
            zoneLow: zone.zoneLow,
            zoneHigh: zone.zoneHigh,
            type,
            strength: 0,
            touches,
            lastReactionTime,
        };
    })
        .filter((level) => level.touches >= 1);
}
function mergeOverlappingZones(zones, maxMergeWidth) {
    if (zones.length <= 1)
        return zones;
    const sorted = [...zones].sort((a, b) => a.zoneLow - b.zoneLow);
    const merged = [];
    let current = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        const wouldOverlap = current.zoneHigh >= next.zoneLow;
        const mergedWidth = Math.max(current.zoneHigh, next.zoneHigh) - Math.min(current.zoneLow, next.zoneLow);
        // Only merge when overlap is tight; never create a zone wider than maxMergeWidth.
        if (wouldOverlap && mergedWidth <= maxMergeWidth) {
            current = {
                price: (current.price * current.swings.length + next.price * next.swings.length) / (current.swings.length + next.swings.length),
                zoneLow: Math.min(current.zoneLow, next.zoneLow),
                zoneHigh: Math.max(current.zoneHigh, next.zoneHigh),
                swings: [...current.swings, ...next.swings],
            };
        }
        else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    return merged;
}
function mergeSupportResistanceLevels(levels) {
    if (levels.length <= 1)
        return levels;
    const sorted = [...levels].sort((a, b) => a.zoneLow - b.zoneLow);
    const merged = [];
    let current = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        const wouldOverlap = current.zoneHigh >= next.zoneLow;
        const mergedWidth = Math.max(current.zoneHigh, next.zoneHigh) - Math.min(current.zoneLow, next.zoneLow);
        const currentWidth = current.zoneHigh - current.zoneLow;
        // Overlapping zones represent one price area even when their preliminary
        // classifications differ. A cross-type merge becomes `tested` and is
        // classified again against the current price below.
        const maxAllowed = Math.max(currentWidth, next.zoneHigh - next.zoneLow) * 2;
        if (wouldOverlap && mergedWidth <= maxAllowed) {
            const totalTouches = current.touches + next.touches;
            current = {
                price: totalTouches > 0 ? (current.price * current.touches + next.price * next.touches) / totalTouches : current.price,
                zoneLow: Math.min(current.zoneLow, next.zoneLow),
                zoneHigh: Math.max(current.zoneHigh, next.zoneHigh),
                type: current.type === next.type ? current.type : 'tested',
                strength: Math.max(current.strength, next.strength),
                touches: totalTouches,
                lastReactionTime: new Date(current.lastReactionTime) > new Date(next.lastReactionTime) ? current.lastReactionTime : next.lastReactionTime,
            };
        }
        else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    return merged;
}
function clampZoneWidth(level, currentAtr) {
    const width = level.zoneHigh - level.zoneLow;
    const maxWidth = currentAtr !== null && currentAtr > 0 ? currentAtr * MAX_ZONE_WIDTH_ATR : width;
    if (width <= maxWidth || maxWidth <= 0) {
        return { zoneLow: level.zoneLow, zoneHigh: level.zoneHigh, price: level.price };
    }
    const half = maxWidth / 2;
    const center = level.price;
    return {
        price: center,
        zoneLow: center - half,
        zoneHigh: center + half,
    };
}
/**
 * If the nearest actionable side is missing, keep the most recent swing
 * high/low as a soft level so the chart is not support-only or resistance-only.
 */
function ensureNearestSwingLevels(supports, resistances, tested, swingHighs, swingLows, currentPrice, currentAtr) {
    if (currentPrice === null)
        return;
    const atrPad = currentAtr !== null && currentAtr > 0 ? currentAtr * SOFT_LEVEL_ZONE_ATR : currentPrice * 0.0005;
    const proximity = currentAtr !== null && currentAtr > 0 ? currentAtr * PROXIMITY_ATR_MULTIPLE : currentPrice * 0.01;
    // When the book is empty on one side, allow a wider search for the nearest swing.
    const wideProximity = proximity * 2.5;
    const hasNearbyResistance = resistances.some((r) => r.zoneLow - currentPrice <= proximity && r.zoneLow > currentPrice) ||
        tested.some((t) => t.zoneHigh >= currentPrice && t.zoneLow <= currentPrice);
    if (!hasNearbyResistance) {
        const above = swingHighs
            .filter((s) => s.price > currentPrice)
            .sort((a, b) => a.price - b.price || b.index - a.index);
        const nearest = above.find((s) => s.price - currentPrice <= wideProximity) ?? above[0];
        if (nearest && nearest.price - currentPrice <= wideProximity) {
            resistances.push({
                price: nearest.price,
                zoneLow: nearest.price - atrPad,
                zoneHigh: nearest.price + atrPad,
                type: 'resistance',
                strength: SOFT_LEVEL_STRENGTH,
                touches: 1,
                lastReactionTime: nearest.timestamp,
            });
        }
    }
    const hasNearbySupport = supports.some((s) => currentPrice - s.zoneHigh <= proximity && s.zoneHigh < currentPrice) ||
        tested.some((t) => t.zoneHigh >= currentPrice && t.zoneLow <= currentPrice);
    if (!hasNearbySupport) {
        const below = swingLows
            .filter((s) => s.price < currentPrice)
            .sort((a, b) => b.price - a.price || b.index - a.index);
        const nearest = below.find((s) => currentPrice - s.price <= wideProximity) ?? below[0];
        if (nearest && currentPrice - nearest.price <= wideProximity) {
            supports.push({
                price: nearest.price,
                zoneLow: nearest.price - atrPad,
                zoneHigh: nearest.price + atrPad,
                type: 'support',
                strength: SOFT_LEVEL_STRENGTH,
                touches: 1,
                lastReactionTime: nearest.timestamp,
            });
        }
    }
}
function classifyZones(levels, currentPrice, currentAtr, candles) {
    if (currentPrice === null) {
        return {
            supports: levels.filter((l) => l.type === 'support'),
            resistances: levels.filter((l) => l.type === 'resistance'),
            tested: [],
        };
    }
    const supports = [];
    const resistances = [];
    const tested = [];
    for (const level of levels) {
        if (level.zoneHigh < currentPrice) {
            supports.push({ ...level, type: 'support' });
        }
        else if (level.zoneLow > currentPrice) {
            resistances.push({ ...level, type: 'resistance' });
        }
        else {
            tested.push({ ...level, type: 'tested' });
        }
    }
    return { supports, resistances, tested };
}
function isRelevant(level, currentPrice, currentAtr, relevanceThresholdTime) {
    const lastReactionDate = new Date(level.lastReactionTime).getTime();
    if (lastReactionDate >= relevanceThresholdTime) {
        return true;
    }
    if (currentAtr !== null) {
        const distance = currentAtr * PROXIMITY_ATR_MULTIPLE;
        const levelPrice = level.type === 'resistance' ? level.zoneHigh : level.zoneLow;
        return Math.abs(levelPrice - currentPrice) <= distance;
    }
    return false;
}
function lastNonNil(values) {
    for (let i = values.length - 1; i >= 0; i--) {
        if (values[i] !== null && values[i] !== undefined) {
            return values[i];
        }
    }
    return null;
}
function calculateStrength(touches, lastReactionTime, candles, maxTouches) {
    let score = 0;
    const touchRatio = maxTouches > 0 ? touches / maxTouches : 0;
    score += touchRatio * 45;
    const lastReactionDate = new Date(lastReactionTime).getTime();
    const lastCandleDate = new Date(candles[candles.length - 1].timestamp).getTime();
    const hoursSinceLastReaction = (lastCandleDate - lastReactionDate) / (1000 * 60 * 60);
    if (hoursSinceLastReaction < 24) {
        score += 25;
    }
    else if (hoursSinceLastReaction < 72) {
        score += 15;
    }
    else if (hoursSinceLastReaction < 168) {
        score += 5;
    }
    if (touches >= 3) {
        score += 15;
    }
    else if (touches === 2) {
        score += 10;
    }
    if (touches >= 2 && hoursSinceLastReaction < 72) {
        score += 15;
    }
    return Math.min(Math.max(Math.round(score), 1), 100);
}
/*
 * Strength formula (0-100):
 *
 *   score = touchRatio * 45
 *          + recencyBonus
 *          + touchCountBonus
 *          + recentTouchBonus
 *
 * Where:
 *   touchRatio = touches / maxTouches (across all levels in this scan)
 *   recencyBonus = 25 if <24h, 15 if <72h, 5 if <168h, else 0
 *   touchCountBonus = 15 if touches>=3, 10 if touches==2, else 0
 *   recentTouchBonus = 15 if touches>=2 AND <72h since last reaction
 *
 * Weighting logic (one-line summary):
 *   Touch dominance is intentionally reduced; a level with many old touches
 *   can score lower than a recently-tested level with fewer touches, because
 *   recency and recent-touch frequency are weighted more heavily than raw
 *   touch count. This matches the intuition that a recently-tested level is
 *   usually more actionable than an ancient one with a few extra touches.
 */
//# sourceMappingURL=supportResistanceEngine.js.map