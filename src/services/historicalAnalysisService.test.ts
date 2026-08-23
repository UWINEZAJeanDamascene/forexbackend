import { describe, expect, it } from 'vitest';
import { Candle } from '../../../shared/types/market';
import { analyzeHistoricalDecision } from './historicalAnalysisService';

function makeCandles(count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 1 + index * 0.001;
    return {
      timestamp: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
      open: close,
      high: close + 0.0005,
      low: close - 0.0005,
      close,
      volume: null,
    };
  });
}

describe('analyzeHistoricalDecision', () => {
  it('calculates indicators, trend, and structure from the candle prefix only', () => {
    const candles = makeCandles(80);
    const result = analyzeHistoricalDecision(candles, 59, 'EUR/USD', '1H', { swingWindow: 2 });

    expect(result.candlesThroughDecision).toHaveLength(60);
    expect(result.decisionTimestamp).toBe(candles[59].timestamp);
    expect(result.indicators.ema20).toHaveLength(60);
    expect(result.indicators.rsi14).toHaveLength(60);
    expect(result.indicators.macd.line).toHaveLength(60);
    expect(result.indicators.atr14).toHaveLength(60);
    expect(result.indicators.bollingerBands.upper).toHaveLength(60);
    expect(result.trend.analyzedAt).toBeTruthy();
  });

  it('does not allow future candle changes to alter an earlier decision', () => {
    const candles = makeCandles(80);
    const before = analyzeHistoricalDecision(candles, 59, 'EUR/USD', '1H', { swingWindow: 2 });
    candles[70].high = 99;
    candles[70].low = 0.1;
    candles[79].close = 50;
    const after = analyzeHistoricalDecision(candles, 59, 'EUR/USD', '1H', { swingWindow: 2 });

    expect(after.indicators).toEqual(before.indicators);
    expect({ ...after.trend, analyzedAt: undefined }).toEqual({ ...before.trend, analyzedAt: undefined });
    expect(after.structure).toEqual(before.structure);
  });

  it('records the later candle that confirms each historical swing', () => {
    const candles = makeCandles(9);
    candles[2].high = 2;
    candles[3].high = 1.5;
    candles[4].high = 1.4;
    const result = analyzeHistoricalDecision(candles, 5, 'EUR/USD', '1H', { swingWindow: 2 });
    const swing = result.structure.swingHighs.find((item) => item.index === 2);

    expect(swing?.confirmationTimestamp).toBe(candles[4].timestamp);
    expect(result.structure.swingHighs.every((item) => (item.confirmationTimestamp ?? '') <= result.decisionTimestamp)).toBe(true);
  });
});