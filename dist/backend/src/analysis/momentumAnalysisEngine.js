"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeMomentum = analyzeMomentum;
const MIN_CANDLES = 60;
const RSI_LEVEL_WEIGHT = 0.6;
const RSI_SLOPE_WEIGHT = 0.4;
const MACD_WEIGHT = 0.35;
const PRICE_MOVEMENT_WEIGHT = 0.3;
const RSI_WEIGHT = 0.35;
const TREND_DAMPEN_MULTIPLIER = 0.5;
const OVERBOUGHT_THRESHOLD = 70;
const OVERSOLD_THRESHOLD = 30;
const RSI_MIDPOINT = 50;
const MACD_CROSS_LOOKBACK = 3;
const ROC_LOOKBACK = 10;
const MAX_STREAK_CAP = 5;
function analyzeMomentum(candles, indicators, structure) {
    if (candles.length < MIN_CANDLES) {
        return {
            momentum: 'neutral',
            strength: null,
            score: 0,
            counterTrend: false,
            counterTrendExplanation: '',
            trendContext: structure.trend,
            components: {
                rsi: { score: 0, explanation: 'Insufficient data.', raw: {} },
                macd: { score: 0, explanation: 'Insufficient data.', raw: {} },
                priceMovement: { score: 0, explanation: 'Insufficient data.', raw: {} },
            },
            dataQuality: {
                sufficient: false,
                candleCount: candles.length,
                minimumRequired: MIN_CANDLES,
            },
        };
    }
    // Momentum uses Market Structure's trend as its context input.
    // This is the same trend signal produced by Phase 9 (detectMarketStructure),
    // not EMA alignment or any other factor.
    const trendContext = normalizeTrend(structure.trend);
    const atrValue = lastNonNil(indicators.atr14);
    const currentAtr = atrValue !== null && atrValue > 0 ? atrValue : null;
    const rsiComponent = scoreRsi(indicators.rsi14, trendContext);
    const macdComponent = scoreMacd(indicators.macd, currentAtr, candles);
    const priceComponent = scorePriceMovement(candles, currentAtr);
    const rsiContribution = rsiComponent.score * RSI_WEIGHT;
    const macdContribution = macdComponent.score * MACD_WEIGHT;
    const priceContribution = priceComponent.score * PRICE_MOVEMENT_WEIGHT;
    const rawScore = rsiContribution + macdContribution + priceContribution;
    const rawDirection = rawScore > 5 ? 'bullish' : rawScore < -5 ? 'bearish' : 'neutral';
    const counterTrend = rawDirection !== 'neutral' && rawDirection !== trendContext && trendContext !== 'neutral';
    let adjustedScore = rawScore;
    let adjustmentFactor = 1;
    let adjustmentReason = '';
    if (counterTrend) {
        adjustedScore = rawScore * TREND_DAMPEN_MULTIPLIER;
        adjustmentFactor = TREND_DAMPEN_MULTIPLIER;
        adjustmentReason = 'counter-trend dampening';
    }
    else if (rawDirection === trendContext && trendContext !== 'neutral') {
        // Do not amplify a weak momentum reading merely because it agrees with
        // structure. Agreement is already visible in the component scores; an
        // extra multiplier manufactured bullish labels on marginal evidence.
        adjustmentReason = 'raw score retained; no directional reinforcement';
    }
    const clampedScore = Math.round(Math.max(Math.min(adjustedScore, 100), -100));
    const momentum = classifyMomentum(clampedScore);
    const momentumLean = classifyMomentumWithLean(clampedScore).lean;
    const strength = deriveStrength(clampedScore, momentum);
    const divergence = detectDivergence(candles, indicators.rsi14);
    const counterTrendExplanation = counterTrend
        ? `Counter-trend vs. ${trendContext} market structure`
        : '';
    return {
        momentum,
        momentumLean,
        strength,
        score: clampedScore,
        rawScore: Math.round(rawScore * 100) / 100,
        adjustmentFactor,
        adjustmentReason,
        counterTrend,
        counterTrendExplanation,
        trendContext,
        divergence,
        components: {
            rsi: rsiComponent,
            macd: macdComponent,
            priceMovement: priceComponent,
        },
        dataQuality: {
            sufficient: true,
            candleCount: candles.length,
            minimumRequired: MIN_CANDLES,
        },
    };
}
function scoreRsi(rsiSeries, trendContext) {
    const recent = rsiSeries.slice(-6);
    const currentRsi = lastNonNil(recent);
    const priorRsi = lastNonNil(recent.slice(0, -1));
    if (currentRsi === null) {
        return { score: 0, explanation: 'No RSI data available.', raw: { currentRsi: null } };
    }
    const levelScore = (currentRsi - RSI_MIDPOINT) / (RSI_MIDPOINT - 0);
    let slopeScore = 0;
    if (priorRsi !== null) {
        slopeScore = (currentRsi - priorRsi) / 20;
    }
    let componentScore = levelScore * RSI_LEVEL_WEIGHT + slopeScore * RSI_SLOPE_WEIGHT;
    componentScore = Math.max(Math.min(componentScore, 1), -1);
    if (currentRsi > OVERBOUGHT_THRESHOLD) {
        componentScore *= trendContext === 'bullish' ? 0.75 : 0.5;
    }
    else if (currentRsi < OVERSOLD_THRESHOLD) {
        componentScore *= trendContext === 'bearish' ? 0.75 : 0.5;
    }
    const scaledScore = Math.round(componentScore * 100);
    return {
        score: scaledScore,
        explanation: `RSI is ${currentRsi.toFixed(1)} (${currentRsi > OVERBOUGHT_THRESHOLD ? 'overbought' : currentRsi < OVERSOLD_THRESHOLD ? 'oversold' : 'neutral'})${priorRsi !== null ? `, ${currentRsi > priorRsi ? 'up' : currentRsi < priorRsi ? 'down' : 'unchanged'} from ${priorRsi.toFixed(1)}` : ''}.`,
        raw: {
            currentRsi,
            priorRsi,
            levelScore,
            slopeScore,
            trendDampened: (trendContext !== 'bullish' && currentRsi > OVERBOUGHT_THRESHOLD) || (trendContext !== 'bearish' && currentRsi < OVERSOLD_THRESHOLD),
        },
    };
}
function scoreMacd(macd, atr, candles) {
    const lineValues = macd.line.filter((value) => value !== null);
    const signalValues = macd.signal.filter((value) => value !== null);
    const histogramValues = macd.histogram.filter((value) => value !== null);
    const currentHistogram = histogramValues[histogramValues.length - 1] ?? null;
    const priorHistogram = histogramValues[histogramValues.length - 2] ?? null;
    const currentLine = lineValues[lineValues.length - 1] ?? null;
    const currentSignal = signalValues[signalValues.length - 1] ?? null;
    const priorLine = lineValues[lineValues.length - 2] ?? null;
    const priorSignal = signalValues[signalValues.length - 2] ?? null;
    if (currentHistogram === null || currentLine === null || currentSignal === null) {
        return { score: 0, explanation: 'No MACD data available.', raw: {} };
    }
    const normalizedHistogram = atr !== null && atr > 0 ? currentHistogram / atr : currentHistogram;
    const histogramScore = Math.max(Math.min(normalizedHistogram * 50, 1), -1);
    let slopeScore = 0;
    if (priorHistogram !== null) {
        const histogramSlope = currentHistogram - priorHistogram;
        const normalizedSlope = atr !== null && atr > 0 ? histogramSlope / atr : histogramSlope;
        slopeScore = Math.max(Math.min(normalizedSlope * 25, 1), -1);
    }
    let crossBonus = 0;
    if (priorLine !== null && priorSignal !== null) {
        const wasBullish = priorLine > priorSignal;
        const isBullish = currentLine > currentSignal;
        if (!wasBullish && isBullish) {
            crossBonus = 0.3;
        }
        else if (wasBullish && !isBullish) {
            crossBonus = -0.3;
        }
    }
    const componentScore = histogramScore * 0.6 + slopeScore * 0.4 + crossBonus;
    const scaledScore = Math.round(Math.max(Math.min(componentScore, 1), -1) * 100);
    const roundedHistogram = Number(currentHistogram.toFixed(4));
    const histogramText = Object.is(roundedHistogram, -0) ? '0.0000' : roundedHistogram.toFixed(4);
    return {
        score: scaledScore,
        explanation: `MACD histogram is ${histogramText} and ${priorHistogram !== null && currentHistogram > priorHistogram ? 'expanding' : priorHistogram !== null ? 'contracting' : 'flat'}. ${crossBonus !== 0 ? (crossBonus > 0 ? 'Fresh bullish cross detected.' : 'Fresh bearish cross detected.') : 'No recent crossover.'}`,
        raw: {
            currentHistogram,
            priorHistogram,
            normalizedHistogram,
            histogramScore,
            slopeScore,
            crossBonus,
            currentLine,
            currentSignal,
        },
    };
}
function scorePriceMovement(candles, atr) {
    if (candles.length < ROC_LOOKBACK + 1) {
        return { score: 0, explanation: 'Insufficient candles for price movement analysis.', raw: {} };
    }
    const recent = candles.slice(-ROC_LOOKBACK - 1);
    const oldestClose = recent[0].close;
    const currentClose = recent[recent.length - 1].close;
    const roc = (currentClose - oldestClose) / oldestClose;
    const normalizedRoc = atr !== null && atr > 0 ? roc / atr : roc;
    const rocScore = Math.max(Math.min(normalizedRoc * 100, 1), -1);
    let streak = 0;
    for (let i = recent.length - 1; i > 0; i--) {
        if (recent[i].close > recent[i - 1].close) {
            streak++;
        }
        else if (recent[i].close < recent[i - 1].close) {
            streak--;
        }
        else {
            break;
        }
        if (Math.abs(streak) >= MAX_STREAK_CAP)
            break;
    }
    const streakScore = Math.max(Math.min(streak / MAX_STREAK_CAP, 1), -1);
    const componentScore = rocScore * 0.7 + streakScore * 0.3;
    const scaledScore = Math.round(Math.max(Math.min(componentScore, 1), -1) * 100);
    return {
        score: scaledScore,
        explanation: `Price moved ${(roc * 100).toFixed(2)}% over the last ${ROC_LOOKBACK} candles (${currentClose.toFixed(4)} vs ${oldestClose.toFixed(4)}) with a ${Math.abs(streak)}-candle ${streak > 0 ? 'up' : streak < 0 ? 'down' : 'flat'} streak.`,
        raw: {
            roc,
            normalizedRoc,
            streak,
            oldestClose,
            currentClose,
            lookback: ROC_LOOKBACK,
        },
    };
}
function classifyMomentum(score) {
    if (score >= 30)
        return 'bullish';
    if (score <= -30)
        return 'bearish';
    return 'neutral';
}
function classifyMomentumWithLean(score) {
    if (score >= 30)
        return { direction: 'bullish', lean: null };
    if (score <= -30)
        return { direction: 'bearish', lean: null };
    if (score >= 10)
        return { direction: 'neutral', lean: 'mild bullish lean' };
    if (score <= -10)
        return { direction: 'neutral', lean: 'mild bearish lean' };
    return { direction: 'neutral', lean: null };
}
function deriveStrength(score, direction) {
    if (direction === 'neutral')
        return null;
    const abs = Math.abs(score);
    // Avoid labeling mid-range scores (e.g. 49) as "strong".
    if (abs >= 55)
        return 'strong';
    if (abs >= 30)
        return 'moderate';
    return null;
}
function normalizeTrend(trend) {
    switch (trend) {
        case 'bullish':
            return 'bullish';
        case 'bearish':
            return 'bearish';
        default:
            return 'neutral';
    }
}
function detectDivergence(candles, rsiSeries) {
    const swingWindow = 2;
    const highs = findSwingHighs(candles, swingWindow);
    const lows = findSwingLows(candles, swingWindow);
    if (highs.length >= 2) {
        const lastHigh = highs[highs.length - 1];
        const prevHigh = highs[highs.length - 2];
        const lastRsi = getRsiAtCandle(rsiSeries, lastHigh.index);
        const prevRsi = getRsiAtCandle(rsiSeries, prevHigh.index);
        if (lastRsi !== null && prevRsi !== null && lastHigh.price > prevHigh.price && lastRsi < prevRsi) {
            return 'bearish';
        }
    }
    if (lows.length >= 2) {
        const lastLow = lows[lows.length - 1];
        const prevLow = lows[lows.length - 2];
        const lastRsi = getRsiAtCandle(rsiSeries, lastLow.index);
        const prevRsi = getRsiAtCandle(rsiSeries, prevLow.index);
        if (lastRsi !== null && prevRsi !== null && lastLow.price < prevLow.price && lastRsi > prevRsi) {
            return 'bullish';
        }
    }
    return null;
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
            swings.push({ price: currentHigh, index: i });
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
            swings.push({ price: currentLow, index: i });
        }
    }
    return swings;
}
function getRsiAtCandle(rsiSeries, candleIndex) {
    if (candleIndex < 0 || candleIndex >= rsiSeries.length)
        return null;
    return rsiSeries[candleIndex] ?? null;
}
function lastNonNil(values) {
    for (let i = values.length - 1; i >= 0; i--) {
        if (values[i] !== null && values[i] !== undefined) {
            return values[i];
        }
    }
    return null;
}
//# sourceMappingURL=momentumAnalysisEngine.js.map