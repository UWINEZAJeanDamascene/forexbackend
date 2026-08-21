import { describe, it, expect } from 'vitest';
import { Candle } from '../../shared/types/market';
import { detectCandlestickPatterns, CandlestickPattern } from './candlestickPatternEngine';

function makeCandle(open: number, high: number, low: number, close: number, timestamp?: string): Candle {
  return {
    timestamp: timestamp ?? new Date(Date.now()).toISOString(),
    open,
    high,
    low,
    close,
    volume: null,
  };
}

describe('detectCandlestickPatterns', () => {
  it('returns empty array for insufficient candles', () => {
    const candles = [makeCandle(1.16, 1.161, 1.159, 1.16)];
    expect(detectCandlestickPatterns(candles)).toEqual([]);
  });

  it('detects rejection wick at top', () => {
    const candles = Array.from({ length: 20 }, (_, i) => makeCandle(1.16, 1.16, 1.159, 1.159));
    candles[19] = makeCandle(1.159, 1.17, 1.158, 1.1585);
    const result = detectCandlestickPatterns(candles);
    expect(result.some((p) => p.type === 'rejection_wick_top')).toBe(true);
  });

  it('detects rejection wick at bottom', () => {
    const candles = Array.from({ length: 20 }, (_, i) => makeCandle(1.16, 1.161, 1.159, 1.16));
    candles[19] = makeCandle(1.1605, 1.161, 1.15, 1.1608);
    const result = detectCandlestickPatterns(candles);
    expect(result.some((p) => p.type === 'rejection_wick_bottom')).toBe(true);
  });

  it('detects bullish engulfing', () => {
    const candles = Array.from({ length: 20 }, (_, i) => makeCandle(1.16, 1.161, 1.159, 1.16));
    candles[18] = makeCandle(1.161, 1.162, 1.159, 1.1595);
    candles[19] = makeCandle(1.159, 1.1625, 1.159, 1.1625);
    const result = detectCandlestickPatterns(candles);
    expect(result.some((p) => p.type === 'bullish_engulfing')).toBe(true);
  });

  it('detects bearish engulfing', () => {
    const candles = Array.from({ length: 20 }, (_, i) => makeCandle(1.16, 1.161, 1.159, 1.16));
    candles[18] = makeCandle(1.159, 1.1605, 1.158, 1.1602);
    candles[19] = makeCandle(1.1605, 1.161, 1.158, 1.1585);
    const result = detectCandlestickPatterns(candles);
    expect(result.some((p) => p.type === 'bearish_engulfing')).toBe(true);
  });

  it('ignores candles with zero range', () => {
    const candles = Array.from({ length: 20 }, (_, i) => makeCandle(1.16, 1.16, 1.16, 1.16));
    expect(detectCandlestickPatterns(candles)).toEqual([]);
  });
});
