import { describe, it, expect } from 'vitest';
import { Candle } from '../../shared/types/market';
import { IndicatorValues } from '../../shared/types/indicators';
import { MarketStructureResult, MarketStructureTrend } from '../../shared/types/marketStructure';
import { analyzeTrend } from './trendAnalysisEngine';

function makeCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: new Date(Date.now() + i * 3600000).toISOString(),
    open: close,
    high: close + 0.001,
    low: close - 0.001,
    close,
    volume: null,
  }));
}

function makeIndicators(overrides: Partial<IndicatorValues> = {}): IndicatorValues {
  return {
    ema20: [1.16],
    ema50: [1.15],
    ema200: [1.14],
    rsi14: [50],
    macd: { line: [0], signal: [0], histogram: [0] },
    atr14: [0.001],
    bollingerBands: { upper: [1.17], middle: [1.16], lower: [1.15] },
    ...overrides,
  };
}

function makeStructure(trend: MarketStructureTrend, hh = 0, hl = 0, lh = 0, ll = 0): MarketStructureResult {
  return {
    trend,
    swingHighs: [],
    swingLows: [],
    events: [],
    lastSwingHigh: null,
    lastSwingLow: null,
    higherHighsCount: hh,
    higherLowsCount: hl,
    lowerHighsCount: lh,
    lowerLowsCount: ll,
  };
}

describe('analyzeTrend', () => {
  it('returns bullish for strong bullish alignment, bullish structure, price above EMAs, and rising highs/lows', () => {
    const candles = makeCandles([1.17, 1.18, 1.19]);
    const indicators = makeIndicators();
    const structure = makeStructure('bullish', 3, 2, 0, 0);
    const result = analyzeTrend(candles, indicators, structure);

    expect(result.trend).toBe('bullish');
    expect(result.strength).toBe('strong');
    expect(result.score).toBeGreaterThan(0);
  });

  it('returns bearish for strong bearish alignment, bearish structure, price below EMAs, and falling highs/lows', () => {
    const candles = makeCandles([1.13, 1.12, 1.11]);
    const indicators = makeIndicators({
      ema20: [1.12],
      ema50: [1.13],
      ema200: [1.14],
    });
    const structure = makeStructure('bearish', 0, 0, 3, 2);
    const result = analyzeTrend(candles, indicators, structure);

    expect(result.trend).toBe('bearish');
    expect(result.strength).toBe('strong');
    expect(result.score).toBeLessThan(0);
  });

  it('returns neutral for mixed evidence', () => {
    const candles = makeCandles([1.16, 1.15, 1.17]);
    const indicators = makeIndicators({
      ema20: [1.16],
      ema50: [1.17],
      ema200: [1.18],
    });
    const structure = makeStructure('range', 1, 1, 1, 1);
    const result = analyzeTrend(candles, indicators, structure);

    expect(result.trend).toBe('neutral');
  });

  it('does not let EMA alignment alone force bullish when structure and highs/lows are bearish', () => {
    const candles = makeCandles([1.13, 1.12, 1.11]);
    const indicators = makeIndicators({
      ema20: [1.12],
      ema50: [1.13],
      ema200: [1.14],
    });
    const structure = makeStructure('bearish', 0, 0, 3, 2);
    const result = analyzeTrend(candles, indicators, structure);

    expect(result.trend).toBe('bearish');
  });

  it('handles null EMA200 without crashing', () => {
    const candles = makeCandles([1.16, 1.17, 1.18]);
    const indicators = makeIndicators({
      ema200: [null, null, null],
    });
    const structure = makeStructure('bullish', 2, 1, 0, 0);
    const result = analyzeTrend(candles, indicators, structure);

    expect(result.trend).toBe('bullish');
    expect(result.ema.ema200).toBeNull();
  });

  it('handles insufficient structure without crashing', () => {
    const candles = makeCandles([1.16, 1.16, 1.16]);
    const indicators = makeIndicators({
      ema20: [1.16],
      ema50: [1.16],
      ema200: [1.16],
      atr14: [0.001],
    });
    const structure = makeStructure('unclear');
    const result = analyzeTrend(candles, indicators, structure);

    expect(result.trend).toBe('neutral');
  });

  it('returns neutral for flat market with no directional evidence', () => {
    const candles = makeCandles([1.16, 1.16, 1.16]);
    const indicators = makeIndicators({
      ema20: [1.16],
      ema50: [1.16],
      ema200: [1.16],
    });
    const structure = makeStructure('unclear');
    const result = analyzeTrend(candles, indicators, structure);

    expect(result.trend).toBe('neutral');
  });

  it('returns consistent data for the same input candles', () => {
    const candles = makeCandles([1.16, 1.17, 1.18, 1.19, 1.20]);
    const indicators = makeIndicators();
    const structure = makeStructure('bullish', 2, 2, 0, 0);
    const result = analyzeTrend(candles, indicators, structure);

    expect(result.factors.emaAlignment.direction).toBe('bullish');
    expect(result.factors.marketStructure.direction).toBe('bullish');
    expect(result.factors.priceVsEma.direction).toBe('bullish');
    expect(result.factors.recentHighsLows.direction).toBe('bullish');
  });

  it('produces granular scores for strong bullish conditions', () => {
    const candles = makeCandles([1.20, 1.21, 1.22]);
    const indicators = makeIndicators({
      ema20: [1.22],
      ema50: [1.20],
      ema200: [1.18],
      atr14: [0.01],
    });
    const structure = makeStructure('bullish', 4, 3, 0, 0);
    const result = analyzeTrend(candles, indicators, structure);

    expect(result.trend).toBe('bullish');
    expect(result.score).toBeGreaterThan(70);
    expect(result.strength).toBe('strong');
  });

  it('produces granular scores for strong bearish conditions', () => {
    const candles = makeCandles([1.14, 1.13, 1.12]);
    const indicators = makeIndicators({
      ema20: [1.12],
      ema50: [1.14],
      ema200: [1.16],
      atr14: [0.01],
    });
    const structure = makeStructure('bearish', 0, 0, 4, 3);
    const result = analyzeTrend(candles, indicators, structure);

    expect(result.trend).toBe('bearish');
    expect(result.score).toBeLessThan(-70);
    expect(result.strength).toBe('strong');
  });

  it('produces mid-range scores for weak or choppy conditions', () => {
    const candles = makeCandles([1.16, 1.15, 1.17]);
    const indicators = makeIndicators({
      ema20: [1.16],
      ema50: [1.16],
      ema200: [1.16],
      atr14: [0.01],
    });
    const structure = makeStructure('range', 1, 0, 1, 0);
    const result = analyzeTrend(candles, indicators, structure);

    expect(result.trend).toBe('neutral');
    expect(Math.abs(result.score)).toBeLessThan(40);
    expect(result.strength).toBe('weak');
  });

  it('keeps the weighted factor sum in the headline score for range structure', () => {
    const candles = makeCandles([1.16, 1.16, 1.16]);
    const result = analyzeTrend(candles, makeIndicators(), makeStructure('range', 3, 2, 0, 0));
    const factorSum = Object.values(result.factors).reduce((sum, factor) => sum + factor.score, 0);

    expect(result.trend).toBe('neutral');
    expect(result.score).toBe(factorSum);
    expect(result.score).not.toBe(0);
  });

  it('does not let aggregate count majority override strict structure trend', () => {
    const candles = makeCandles([1.16, 1.15, 1.17]);
    const indicators = makeIndicators({
      ema20: [1.16],
      ema50: [1.16],
      ema200: [1.16],
      atr14: [0.01],
    });
    const structure = makeStructure('range', 11, 18, 11, 14);
    const result = analyzeTrend(candles, indicators, structure);

    expect(result.factors.marketStructure.direction).toBe('neutral');
    expect(result.factors.marketStructure.score).toBe(0);
  });

  it('labels price vs EMA bearish when price is below EMA20 even if above EMA50/200', () => {
    const candles = makeCandles([1.163, 1.162, 1.161]);
    const indicators = makeIndicators({
      ema20: [1.164],
      ema50: [1.160],
      ema200: [1.150],
      atr14: [0.001],
    });
    const structure = makeStructure('bullish', 2, 2, 0, 0);
    const result = analyzeTrend(candles, indicators, structure);

    expect(result.factors.priceVsEma.direction).toBe('bearish');
    expect(result.priceVsEmaBreakdown.vsEma20).toBe('bearish');
    expect(result.priceVsEmaBreakdown.vsEma50).toBe('bullish');
    expect(result.priceVsEmaBreakdown.vsEma200).toBe('bullish');
  });

  it('labels price vs EMA bullish when price is above EMA20', () => {
    const candles = makeCandles([1.165, 1.166, 1.167]);
    const indicators = makeIndicators({
      ema20: [1.164],
      ema50: [1.162],
      ema200: [1.158],
      atr14: [0.001],
    });
    const structure = makeStructure('bullish', 2, 2, 0, 0);
    const result = analyzeTrend(candles, indicators, structure);

    expect(result.factors.priceVsEma.direction).toBe('bullish');
    expect(result.priceVsEmaBreakdown.vsEma20).toBe('bullish');
  });
});
