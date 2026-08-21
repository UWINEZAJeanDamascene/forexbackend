import { describe, it, expect } from 'vitest';
import { Candle } from '../../shared/types/market';
import { IndicatorValues } from '../../shared/types/indicators';
import { analyzeVolatility } from './volatilityAnalysisEngine';

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

function makeIndicators(atrValues: (number | null)[], bbOverrides?: { upper?: (number | null)[]; lower?: (number | null)[] }): IndicatorValues {
  return {
    ema20: [1.16],
    ema50: [1.15],
    ema200: [1.14],
    rsi14: [50],
    macd: { line: [0], signal: [0], histogram: [0] },
    atr14: atrValues,
    bollingerBands: {
      upper: bbOverrides?.upper ?? atrValues.map(() => 1.17),
      middle: atrValues.map(() => 1.16),
      lower: bbOverrides?.lower ?? atrValues.map(() => 1.15),
    },
  };
}

describe('analyzeVolatility', () => {
  it('returns low classification when ATR is below 70% of rolling average', () => {
    const candles = makeCandles(Array.from({ length: 120 }, () => 1.16));
    const atrValues = Array.from({ length: 120 }, (_, i) => (i === 119 ? 0.01 : 0.02));
    const indicators = makeIndicators(atrValues);
    const result = analyzeVolatility(candles, indicators);

    expect(result.classification).toBe('low');
    expect(result.score).toBe(0);
    expect(result.currentAtr).toBeCloseTo(0.01, 4);
    expect(result.averageAtr).toBeCloseTo(0.02, 4);
    expect(result.atrPercentile).toBe(0);
  });

  it('returns high classification when ATR is above 130% of rolling average', () => {
    const candles = makeCandles(Array.from({ length: 120 }, () => 1.16));
    const atrValues = Array.from({ length: 120 }, (_, i) => (i === 119 ? 0.02 : 0.01));
    const indicators = makeIndicators(atrValues);
    const result = analyzeVolatility(candles, indicators);

    expect(result.classification).toBe('high');
    expect(result.score).toBe(100);
    expect(result.currentAtr).toBeCloseTo(0.02, 4);
    expect(result.averageAtr).toBeCloseTo(0.01, 4);
    expect(result.atrPercentile).toBe(100);
  });

  it('returns normal classification when ATR is in the middle percentile range', () => {
    const candles = makeCandles(Array.from({ length: 120 }, () => 1.16));
    const atrValues = Array.from({ length: 120 }, (_, i) => {
      if (i < 60) return 0.01;
      if (i === 119) return 0.015;
      return 0.02;
    });
    const indicators = makeIndicators(atrValues);
    const result = analyzeVolatility(candles, indicators);

    expect(result.classification).toBe('normal');
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.score).toBeLessThanOrEqual(70);
  });

  it('excludes current bar from rolling baseline', () => {
    const candles = makeCandles(Array.from({ length: 120 }, () => 1.16));
    const atrValues = Array.from({ length: 120 }, (_, i) => (i === 119 ? 0.03 : 0.01));
    const indicators = makeIndicators(atrValues);
    const result = analyzeVolatility(candles, indicators);

    expect(result.averageAtr).toBeCloseTo(0.01, 4);
    expect(result.classification).toBe('high');
    expect(result.score).toBe(100);
  });

  it('narrative never contains bullish or bearish language', () => {
    const candles = makeCandles(Array.from({ length: 120 }, () => 1.16));
    const atrValues = Array.from({ length: 120 }, (_, i) => (i < 100 ? 0.01 : 0.02));
    const indicators = makeIndicators(atrValues);
    const result = analyzeVolatility(candles, indicators);

    const bannedWords = /\b(bullish|bearish|buy|sell|upward|downward|long|short)\b/i;
    expect(bannedWords.test(result.explanation)).toBe(false);
  });

  it('returns insufficient data result when fewer than 60 candles', () => {
    const candles = makeCandles([1.16, 1.17, 1.18]);
    const indicators = makeIndicators([0.01]);
    const result = analyzeVolatility(candles, indicators);

    expect(result.dataQuality.sufficient).toBe(false);
    expect(result.dataQuality.candleCount).toBe(3);
    expect(result.dataQuality.minimumRequired).toBe(60);
    expect(result.classification).toBe('normal');
    expect(result.score).toBe(0);
    expect(result.atrPercentile).toBe(0);
    expect(result.bandDisagreement).toBe(false);
  });

  it('returns normal when ATR is zero or negative', () => {
    const candles = makeCandles(Array.from({ length: 120 }, () => 1.16));
    const indicators = makeIndicators(Array.from({ length: 120 }, () => 0));
    const result = analyzeVolatility(candles, indicators);

    expect(result.classification).toBe('normal');
    expect(result.currentAtr).toBe(0);
    expect(result.atrPercentile).toBe(0);
    expect(result.bandDisagreement).toBe(false);
  });

  it('handles missing Bollinger Band data gracefully', () => {
    const candles = makeCandles(Array.from({ length: 120 }, () => 1.16));
    const atrValues = Array.from({ length: 120 }, (_, i) => (i < 100 ? 0.01 : 0.02));
    const indicators = makeIndicators(atrValues, {
      upper: Array.from({ length: 120 }, () => null),
      lower: Array.from({ length: 120 }, () => null),
    });
    const result = analyzeVolatility(candles, indicators);

    expect(result.classification).toBe('high');
    expect(result.bandWidth).toBe(0);
    expect(result.bandWidthPercentile).toBe(0);
    expect(result.bandDisagreement).toBe(false);
    expect(result.score).toBe(100);
    expect(result.explanation).toContain('volatility is high');
  });

  it('detects disagreement between ATR and Bollinger Band width', () => {
    const candles = makeCandles(Array.from({ length: 120 }, () => 1.16));
    const atrValues = Array.from({ length: 120 }, (_, i) => (i === 119 ? 0.015 : 0.01));
    const bbUpper = Array.from({ length: 120 }, (_, i) => {
      if (i === 119) return 1.06;
      const group = Math.floor(i / 20);
      return 1.00 + group * 0.02;
    });
    const bbLower = Array.from({ length: 120 }, (_, i) => {
      if (i === 119) return 1.03;
      const group = Math.floor(i / 20);
      return 0.99 + group * 0.01;
    });
    const indicators = makeIndicators(atrValues, { upper: bbUpper, lower: bbLower });
    const result = analyzeVolatility(candles, indicators);

    expect(result.atrPercentile).toBeGreaterThanOrEqual(70);
    expect(result.bandWidthPercentile).toBeGreaterThanOrEqual(30);
    expect(result.bandWidthPercentile).toBeLessThan(70);
    expect(result.bandDisagreement).toBe(true);
    expect(result.explanation).toContain('mixed signals');
  });

  it('detects disagreement when ATR is low and BB width is high', () => {
    const candles = makeCandles(Array.from({ length: 120 }, () => 1.16));
    const atrValues = Array.from({ length: 120 }, (_, i) => (i === 119 ? 0.005 : 0.02));
    const bbUpper = Array.from({ length: 120 }, (_, i) => i === 119 ? 1.165 : 1.1605);
    const bbLower = Array.from({ length: 120 }, (_, i) => i === 119 ? 1.1595 : 1.1595);
    const indicators = makeIndicators(atrValues, { upper: bbUpper, lower: bbLower });
    const result = analyzeVolatility(candles, indicators);

    expect(result.atrPercentile).toBeLessThanOrEqual(30);
    expect(result.bandWidthPercentile).toBeGreaterThanOrEqual(70);
    expect(result.bandDisagreement).toBe(true);
    expect(result.explanation).toContain('mixed signals');
  });

  it('detects disagreement when ATR is high and BB width is low', () => {
    const candles = makeCandles(Array.from({ length: 120 }, () => 1.16));
    const atrValues = Array.from({ length: 120 }, (_, i) => (i === 119 ? 0.03 : 0.01));
    const bbUpper = Array.from({ length: 120 }, (_, i) => i === 119 ? 1.1605 : 1.161);
    const bbLower = Array.from({ length: 120 }, (_, i) => i === 119 ? 1.1600 : 1.1595);
    const indicators = makeIndicators(atrValues, { upper: bbUpper, lower: bbLower });
    const result = analyzeVolatility(candles, indicators);

    expect(result.atrPercentile).toBeGreaterThanOrEqual(70);
    expect(result.bandWidthPercentile).toBeLessThanOrEqual(30);
    expect(result.bandDisagreement).toBe(true);
    expect(result.explanation).toContain('mixed signals');
  });
});
