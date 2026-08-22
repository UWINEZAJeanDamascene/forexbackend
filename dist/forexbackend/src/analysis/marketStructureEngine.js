"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectMarketStructure = detectMarketStructure;
exports.detectStructureEvents = detectStructureEvents;
const atr_1 = require("../indicators/atr");
const candlestickPatternEngine_1 = require("./candlestickPatternEngine");
const DEFAULT_SWING_WINDOW = 2;
const MIN_SWING_BARS = 3;
const ATR_MULTIPLIER = 1.0;
const ATR_PERIOD = 14;
function detectMarketStructure(candles, swingWindow = DEFAULT_SWING_WINDOW) {
    if (candles.length < swingWindow * 2 + 1) {
        return {
            symbol: '',
            timeframe: '',
            structure: {
                trend: 'unclear',
                swingHighs: [],
                swingLows: [],
                events: [],
                lastSwingHigh: null,
                lastSwingLow: null,
                higherHighsCount: 0,
                higherLowsCount: 0,
                lowerHighsCount: 0,
                lowerLowsCount: 0,
                candlestickPatterns: [],
            },
        };
    }
    const rawHighs = findSwingHighs(candles, swingWindow);
    const rawLows = findSwingLows(candles, swingWindow);
    const atrValues = (0, atr_1.atr)(candles, ATR_PERIOD);
    const currentAtr = lastNonNil(atrValues);
    const filtered = filterSwingsBySize(rawHighs, rawLows, currentAtr, candles.length);
    const swingHighs = filtered.highs;
    const swingLows = filtered.lows;
    const maxCandleRange = Math.max(...candles.map((c) => c.high - c.low));
    const maxSwingMove = swingHighs.length > 0 || swingLows.length > 0
        ? Math.max(...swingHighs.map((s) => s.price - candles[s.index].low), ...swingLows.map((s) => candles[s.index].high - s.price))
        : 0;
    if (maxCandleRange > maxSwingMove * 2 && maxCandleRange > 0) {
        console.warn(`[structure] Large unclassified candle range detected: max range=${maxCandleRange.toFixed(5)} ` +
            `but max swing move=${maxSwingMove.toFixed(5)}. ` +
            `Check for extreme wicks, bad ticks, or ATR filter dropping valid swings.`);
    }
    const classifiedHighs = classifySwingHighs(swingHighs);
    const classifiedLows = classifySwingLows(swingLows);
    const trend = determineTrend(classifiedHighs, classifiedLows);
    const recentCounts = computeRecentSwingCounts(swingHighs, swingLows, 4);
    const latestSwingEvent = getLatestSwingEvent(classifiedHighs.events, classifiedLows.events);
    const trendQualifier = determineTrendQualifier(trend, recentCounts, latestSwingEvent?.type);
    const bosChochEvents = detectBosAndChoch(candles, swingHighs, swingLows, trend);
    const allEvents = [...classifiedHighs.events, ...classifiedLows.events, ...bosChochEvents];
    allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const candlestickPatterns = (0, candlestickPatternEngine_1.detectCandlestickPatterns)(candles);
    return {
        symbol: '',
        timeframe: '',
        structure: {
            trend,
            trendQualifier,
            swingHighs,
            swingLows,
            events: allEvents,
            lastSwingHigh: swingHighs.length > 0 ? swingHighs[swingHighs.length - 1] : null,
            lastSwingLow: swingLows.length > 0 ? swingLows[swingLows.length - 1] : null,
            higherHighsCount: classifiedHighs.higherHighsCount,
            higherLowsCount: classifiedLows.higherLowsCount,
            lowerHighsCount: classifiedHighs.lowerHighsCount,
            lowerLowsCount: classifiedLows.lowerLowsCount,
            recentHigherHighs: recentCounts.recentHigherHighs,
            recentHigherLows: recentCounts.recentHigherLows,
            recentLowerHighs: recentCounts.recentLowerHighs,
            recentLowerLows: recentCounts.recentLowerLows,
            candlestickPatterns,
        },
    };
}
function detectStructureEvents(candles, swingWindow = DEFAULT_SWING_WINDOW) {
    const result = detectMarketStructure(candles, swingWindow);
    return result.structure.events;
}
function findSwingHighs(candles, window) {
    const swings = [];
    const len = candles.length;
    for (let i = window; i < len; i++) {
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
                type: 'high',
                timestamp: candles[i].timestamp,
                price: currentHigh,
                index: i,
            });
        }
    }
    return swings;
}
function findSwingLows(candles, window) {
    const swings = [];
    const len = candles.length;
    for (let i = window; i < len; i++) {
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
                type: 'low',
                timestamp: candles[i].timestamp,
                price: currentLow,
                index: i,
            });
        }
    }
    return swings;
}
function classifySwingHighs(swingHighs) {
    const events = [];
    let higherHighsCount = 0;
    let lowerHighsCount = 0;
    if (swingHighs.length < 2) {
        return { events, higherHighsCount, lowerHighsCount };
    }
    for (let i = 1; i < swingHighs.length; i++) {
        const prev = swingHighs[i - 1];
        const curr = swingHighs[i];
        if (curr.price > prev.price) {
            higherHighsCount++;
            events.push({
                type: 'higher_high',
                timestamp: curr.timestamp,
                price: curr.price,
                description: `Higher High at ${curr.price} (previous: ${prev.price})`,
            });
        }
        else if (curr.price < prev.price) {
            lowerHighsCount++;
            events.push({
                type: 'lower_high',
                timestamp: curr.timestamp,
                price: curr.price,
                description: `Lower High at ${curr.price} (previous: ${prev.price})`,
            });
        }
    }
    return { events, higherHighsCount, lowerHighsCount };
}
function classifySwingLows(swingLows) {
    const events = [];
    let higherLowsCount = 0;
    let lowerLowsCount = 0;
    if (swingLows.length < 2) {
        return { events, higherLowsCount, lowerLowsCount };
    }
    for (let i = 1; i < swingLows.length; i++) {
        const prev = swingLows[i - 1];
        const curr = swingLows[i];
        if (curr.price > prev.price) {
            higherLowsCount++;
            events.push({
                type: 'higher_low',
                timestamp: curr.timestamp,
                price: curr.price,
                description: `Higher Low at ${curr.price} (previous: ${prev.price})`,
            });
        }
        else if (curr.price < prev.price) {
            lowerLowsCount++;
            events.push({
                type: 'lower_low',
                timestamp: curr.timestamp,
                price: curr.price,
                description: `Lower Low at ${curr.price} (previous: ${prev.price})`,
            });
        }
    }
    return { events, higherLowsCount, lowerLowsCount };
}
function determineTrend(classifiedHighs, classifiedLows) {
    const bullish = classifiedHighs.higherHighsCount > classifiedHighs.lowerHighsCount &&
        classifiedLows.higherLowsCount > classifiedLows.lowerLowsCount;
    const bearish = classifiedHighs.lowerHighsCount > classifiedHighs.higherHighsCount &&
        classifiedLows.lowerLowsCount > classifiedLows.higherLowsCount;
    if (bullish)
        return 'bullish';
    if (bearish)
        return 'bearish';
    if (classifiedHighs.higherHighsCount > 0 ||
        classifiedHighs.lowerHighsCount > 0 ||
        classifiedLows.higherLowsCount > 0 ||
        classifiedLows.lowerLowsCount > 0) {
        return 'range';
    }
    return 'unclear';
}
function computeRecentSwingCounts(swingHighs, swingLows, recentWindow) {
    let recentHigherHighs = 0;
    let recentLowerHighs = 0;
    let recentHigherLows = 0;
    let recentLowerLows = 0;
    if (swingHighs.length >= 2) {
        const startIdx = Math.max(1, swingHighs.length - recentWindow);
        for (let i = startIdx; i < swingHighs.length; i++) {
            if (swingHighs[i].price > swingHighs[i - 1].price)
                recentHigherHighs++;
            else if (swingHighs[i].price < swingHighs[i - 1].price)
                recentLowerHighs++;
        }
    }
    if (swingLows.length >= 2) {
        const startIdx = Math.max(1, swingLows.length - recentWindow);
        for (let i = startIdx; i < swingLows.length; i++) {
            if (swingLows[i].price > swingLows[i - 1].price)
                recentHigherLows++;
            else if (swingLows[i].price < swingLows[i - 1].price)
                recentLowerLows++;
        }
    }
    return { recentHigherHighs, recentHigherLows, recentLowerHighs, recentLowerLows };
}
function determineTrendQualifier(trend, recent, latestEventType) {
    const recentBullish = recent.recentHigherHighs + recent.recentHigherLows;
    const recentBearish = recent.recentLowerHighs + recent.recentLowerLows;
    const recentTotal = recentBullish + recentBearish;
    if (recentTotal === 0)
        return null;
    const latestContradicts = trend === 'bullish'
        ? latestEventType === 'lower_high' || latestEventType === 'lower_low'
        : trend === 'bearish'
            ? latestEventType === 'higher_high' || latestEventType === 'higher_low'
            : false;
    if (latestContradicts || (trend === 'bullish' && recentBearish > recentBullish)) {
        return 'weakening';
    }
    if (trend === 'bearish' && (latestContradicts || recentBullish > recentBearish)) {
        return 'weakening';
    }
    if (trend === 'range' && recentBullish > recentBearish * 2 && recentBullish >= 2) {
        return 'leaning bullish';
    }
    if (trend === 'range' && recentBearish > recentBullish * 2 && recentBearish >= 2) {
        return 'leaning bearish';
    }
    return null;
}
function getLatestSwingEvent(highEvents, lowEvents) {
    return [...highEvents, ...lowEvents]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .at(-1) ?? null;
}
function detectBosAndChoch(candles, swingHighs, swingLows, trend) {
    const events = [];
    const lastCandle = candles[candles.length - 1];
    const lastClose = lastCandle.close;
    if (trend === 'unclear' || trend === 'range') {
        return events;
    }
    const lastHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1] : null;
    const lastLow = swingLows.length > 0 ? swingLows[swingLows.length - 1] : null;
    if (trend === 'bullish') {
        if (lastHigh && lastClose > lastHigh.price) {
            events.push({
                type: 'break_of_structure',
                timestamp: lastHigh.timestamp,
                price: lastHigh.price,
                description: `Bullish Break of Structure: close ${lastClose} above recent swing high ${lastHigh.price}`,
            });
        }
        if (lastLow && lastClose < lastLow.price) {
            events.push({
                type: 'change_of_character',
                timestamp: lastLow.timestamp,
                price: lastLow.price,
                description: `Bullish Change of Character: close ${lastClose} below recent swing low ${lastLow.price}`,
            });
        }
    }
    if (trend === 'bearish') {
        if (lastLow && lastClose < lastLow.price) {
            events.push({
                type: 'break_of_structure',
                timestamp: lastLow.timestamp,
                price: lastLow.price,
                description: `Bearish Break of Structure: close ${lastClose} below recent swing low ${lastLow.price}`,
            });
        }
        if (lastHigh && lastClose > lastHigh.price) {
            events.push({
                type: 'change_of_character',
                timestamp: lastHigh.timestamp,
                price: lastHigh.price,
                description: `Bearish Change of Character: close ${lastClose} above recent swing high ${lastHigh.price}`,
            });
        }
    }
    return events;
}
function lastNonNil(values) {
    for (let i = values.length - 1; i >= 0; i--) {
        if (values[i] !== null && values[i] !== undefined) {
            return values[i];
        }
    }
    return null;
}
function filterSwingsBySize(highs, lows, atrValue, candleCount) {
    const atrThreshold = atrValue !== null ? atrValue * ATR_MULTIPLIER : null;
    const filteredHighs = filterByType(highs, atrThreshold);
    const filteredLows = filterByType(lows, atrThreshold);
    return {
        highs: filteredHighs,
        lows: filteredLows,
    };
}
function filterByType(swings, atrThreshold) {
    if (swings.length === 0)
        return [];
    const kept = [];
    let lastKeptIndex = -Infinity;
    let lastKeptPrice = null;
    for (const swing of swings) {
        const barsSinceLast = swing.index - lastKeptIndex;
        if (barsSinceLast < MIN_SWING_BARS) {
            continue;
        }
        if (atrThreshold !== null && lastKeptPrice !== null) {
            const priceMove = Math.abs(swing.price - lastKeptPrice);
            if (priceMove < atrThreshold) {
                continue;
            }
        }
        kept.push(swing);
        lastKeptIndex = swing.index;
        lastKeptPrice = swing.price;
    }
    return kept;
}
//# sourceMappingURL=marketStructureEngine.js.map