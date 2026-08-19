import { describe, it, expect } from 'vitest';
import { atr } from './atr';
import { Candle } from '../../shared/types/market';

function makeCandle(high: number, low: number, close: number): Candle {
  return { timestamp: '2024-01-01T10:00:00.000Z', open: close, high, low, close, volume: null };
}

describe('atr', () => {
  it('returns nulls when there are fewer than 2 candles', () => {
    const result = atr([makeCandle(10, 5, 7)], 14);
    expect(result).toEqual([null]);
  });

  it('returns nulls when there are exactly 2 candles but period > 1', () => {
    const result = atr([makeCandle(10, 5, 7), makeCandle(12, 6, 8)], 14);
    expect(result).toEqual([null, null]);
  });

  it('computes ATR for a known simple series', () => {
    // Candle 0: TR = 10 - 5 = 5 (no prev close, so just high-low)
    // Candle 1: high=12, low=6, prevClose=7 => TR = max(6, 5, 1) = 6
    // Candle 2: high=14, low=8, prevClose=8 => TR = max(6, 6, 0) = 6
    // EMA(2) of [5, 6]: SMA = 5.5, k=2/3 => EMA=5.5 (only 2 values, so SMA is returned as first EMA)
    // Actually with period 2: first EMA = SMA(5,6) = 5.5
    // So result[2] = 5.5
    const candles = [
      makeCandle(10, 5, 7),
      makeCandle(12, 6, 8),
      makeCandle(14, 8, 8),
    ];
    const result = atr(candles, 2);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeCloseTo(5.5, 5);
    expect(result[2]).toBeCloseTo(35 / 6, 5); // EMA of 5.5 and 6 with k=2/3 => 5.833...
  });

  it('returns null for period < 1', () => {
    expect(() => atr([makeCandle(10, 5, 7)], 0)).toThrow('ATR period must be >= 1');
  });
});
