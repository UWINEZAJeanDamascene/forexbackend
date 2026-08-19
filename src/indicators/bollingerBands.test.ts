import { describe, it, expect } from 'vitest';
import { bollingerBands } from './bollingerBands';
import { Candle } from '../../shared/types/market';

function makeCandle(close: number): Candle {
  return { timestamp: '2024-01-01T10:00:00.000Z', open: close, high: close, low: close, close, volume: null };
}

describe('bollingerBands', () => {
  it('returns nulls when there are fewer than period closes', () => {
    const candles = [makeCandle(10), makeCandle(11), makeCandle(12)];
    const result = bollingerBands(candles, 5, 2);
    expect(result.upper).toEqual([null, null, null, null]);
    expect(result.middle).toEqual([null, null, null, null]);
    expect(result.lower).toEqual([null, null, null, null]);
  });

  it('computes flat bands for a constant price series', () => {
    const candles = Array.from({ length: 25 }, (_, i) => makeCandle(100));
    const result = bollingerBands(candles, 20, 2);

    expect(result.middle.slice(0, 19).every((v) => v === null)).toBe(true);
    expect(result.upper[19]).toBeCloseTo(100, 5);
    expect(result.middle[19]).toBeCloseTo(100, 5);
    expect(result.lower[19]).toBeCloseTo(100, 5);
  });

  it('upper band is above middle and lower is below middle', () => {
    const candles = Array.from({ length: 25 }, (_, i) => makeCandle(100 + (i % 2 === 0 ? 2 : -2)));
    const result = bollingerBands(candles, 20, 2);

    for (let i = 19; i < 25; i++) {
      expect(result.upper[i]).toBeGreaterThan(result.middle[i] as number);
      expect(result.lower[i]).toBeLessThan(result.middle[i] as number);
    }
  });

  it('throws for period < 1', () => {
    expect(() => bollingerBands([makeCandle(10)], 0, 2)).toThrow('Bollinger Bands period must be >= 1');
  });

  it('throws for stdDevMultiplier <= 0', () => {
    expect(() => bollingerBands([makeCandle(10)], 20, 0)).toThrow('stdDevMultiplier must be > 0');
  });
});
