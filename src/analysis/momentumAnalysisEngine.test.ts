import { describe, it, expect } from 'vitest';
import { Candle } from '../../shared/types/market';
import { IndicatorValues } from '../../shared/types/indicators';
import { MarketStructureResult } from '../../shared/types/marketStructure';
import { analyzeMomentum } from './momentumAnalysisEngine';

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

function makeStructure(trend: MarketStructureResult['trend']): MarketStructureResult {
  return {
    trend,
    swingHighs: [],
    swingLows: [],
    events: [],
    lastSwingHigh: null,
    lastSwingLow: null,
    higherHighsCount: 0,
    higherLowsCount: 0,
    lowerHighsCount: 0,
    lowerLowsCount: 0,
  };
}

describe('analyzeMomentum', () => {
  it('returns bullish for clear uptrend with rising RSI', () => {
    const closes = Array.from({ length: 70 }, (_, i) => 1.10 + i * 0.001);
    const candles = makeCandles(closes);
    const indicators = makeIndicators({
      rsi14: [55, 58, 60, 62, 65],
      macd: { line: [0.001, 0.002, 0.003], signal: [0, 0.001, 0.002], histogram: [0.001, 0.001, 0.001] },
      atr14: [0.01],
    });
    const structure = makeStructure('bullish');
    const result = analyzeMomentum(candles, indicators, structure);

    expect(result.momentum).toBe('bullish');
    expect(result.strength).toBe('strong');
    expect(result.counterTrend).toBe(false);
    expect(result.counterTrendExplanation).toBe('');
    expect(result.trendContext).toBe('bullish');
    expect(result.divergence).toBeNull();
  });

  it('detects fresh MACD bullish crossover', () => {
    const closes = Array.from({ length: 70 }, (_, i) => 1.10 + i * 0.001);
    const candles = makeCandles(closes);
    const indicators = makeIndicators({
      rsi14: [55, 55, 55, 55, 55],
      macd: {
        line: [-0.001, 0, 0.001],
        signal: [0, 0, 0],
        histogram: [-0.001, 0, 0.001],
      },
      atr14: [0.01],
    });
    const structure = makeStructure('bullish');
    const result = analyzeMomentum(candles, indicators, structure);

    expect(result.momentum).toBe('bullish');
    expect(result.components.macd.raw.crossBonus).toBeGreaterThan(0);
  });

  it('reduces RSI contribution when overbought but trend context is neutral', () => {
    const closes = Array.from({ length: 70 }, (_, i) => 1.15 + Math.sin(i * 0.5) * 0.002);
    const candles = makeCandles(closes);
    const indicators = makeIndicators({
      rsi14: [72, 73, 74, 75, 76],
      macd: { line: [0.001], signal: [0.001], histogram: [0] },
      atr14: [0.01],
    });
    const structure = makeStructure('range');
    const result = analyzeMomentum(candles, indicators, structure);

    expect(result.components.rsi.raw.trendDampened).toBe(true);
  });

  it('marks counter-trend flag when raw momentum opposes trend context', () => {
    const closes = Array.from({ length: 70 }, (_, i) => 1.15 + Math.sin(i * 0.5) * 0.002);
    const candles = makeCandles(closes);
    const indicators = makeIndicators({
      rsi14: [55, 58, 60, 62, 65],
      macd: {
        line: [-0.001, 0, 0.001],
        signal: [0, 0, 0],
        histogram: [-0.001, 0, 0.001],
      },
      atr14: [0.01],
    });
    const structure = makeStructure('bearish');
    const result = analyzeMomentum(candles, indicators, structure);

    expect(result.counterTrend).toBe(true);
    expect(result.counterTrendExplanation).toBe('Counter-trend vs. bearish market structure');
  });

  it('returns insufficient data result when fewer than 60 candles', () => {
    const candles = makeCandles([1.10, 1.11, 1.12]);
    const indicators = makeIndicators();
    const structure = makeStructure('bullish');
    const result = analyzeMomentum(candles, indicators, structure);

    expect(result.dataQuality.sufficient).toBe(false);
    expect(result.dataQuality.candleCount).toBe(3);
    expect(result.dataQuality.minimumRequired).toBe(60);
    expect(result.momentum).toBe('neutral');
    expect(result.strength).toBeNull();
    expect(result.score).toBe(0);
  });

  it('returns null strength for neutral-band scores', () => {
    const closes = Array.from({ length: 70 }, () => 1.15);
    const candles = makeCandles(closes);
    const indicators = makeIndicators({
      rsi14: [50, 50, 50, 50, 50],
      macd: { line: [0], signal: [0], histogram: [0] },
      atr14: [0.01],
    });
    const structure = makeStructure('neutral');
    const result = analyzeMomentum(candles, indicators, structure);

    expect(result.momentum).toBe('neutral');
    expect(result.strength).toBeNull();
  });

  it('handles null ATR gracefully', () => {
    const closes = Array.from({ length: 70 }, (_, i) => 1.10 + i * 0.001);
    const candles = makeCandles(closes);
    const indicators = makeIndicators({
      rsi14: [55, 58, 60, 62, 65],
      macd: { line: [0.001, 0.002, 0.003], signal: [0, 0.001, 0.002], histogram: [0.001, 0.001, 0.001] },
      atr14: [null],
    });
    const structure = makeStructure('bullish');
    const result = analyzeMomentum(candles, indicators, structure);

    expect(result.momentum).toBe('bullish');
    expect(result.components.macd.raw.normalizedHistogram).toBeDefined();
    expect(result.divergence).toBeNull();
  });

  it('detects bearish divergence when price makes higher high but RSI makes lower high', () => {
    const closes: number[] = [];
    const rsiValues: (number | null)[] = [];
    for (let i = 0; i < 70; i++) {
      if (i < 20) {
        closes.push(1.10 + i * 0.001);
        rsiValues.push(50 + i * 0.5);
      } else if (i < 35) {
        closes.push(1.12 - (i - 20) * 0.0005);
        rsiValues.push(60 - (i - 20) * 0.3);
      } else if (i < 50) {
        closes.push(1.115 + (i - 35) * 0.001);
        rsiValues.push(55.5 + (i - 35) * 0.1);
      } else {
        closes.push(1.13 + (i - 50) * 0.0005);
        rsiValues.push(57 - (i - 50) * 0.2);
      }
    }

    const candles = closes.map((close, i) => ({
      timestamp: new Date(Date.now() + i * 3600000).toISOString(),
      open: close,
      high: close + 0.001,
      low: close - 0.001,
      close,
      volume: null,
    }));

    const indicators = makeIndicators({
      rsi14: rsiValues,
      macd: { line: [0.001], signal: [0.001], histogram: [0] },
      atr14: [0.01],
    });
    const structure = makeStructure('bullish');
    const result = analyzeMomentum(candles, indicators, structure);

    expect(result.divergence).toBe('bearish');
  });
});
