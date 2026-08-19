import { describe, it, expect } from 'vitest';
import { Candle } from '../../shared/types/market';
import { detectSupportResistance } from './supportResistanceEngine';

function makeCandle(close: number, high?: number, low?: number): Candle {
  const h = high ?? close + 0.001;
  const l = low ?? close - 0.001;
  return { timestamp: '2024-01-01T10:00:00.000Z', open: close, high: h, low: l, close, volume: null };
}

describe('detectSupportResistance', () => {
  it('returns empty arrays when there are too few candles', () => {
    const candles = [makeCandle(1), makeCandle(2), makeCandle(3)];
    const result = detectSupportResistance(candles, 2);
    expect(result.supports).toHaveLength(0);
    expect(result.resistances).toHaveLength(0);
  });

  it('returns empty arrays when there are no swing points', () => {
    const candles = [makeCandle(1), makeCandle(1), makeCandle(1), makeCandle(1), makeCandle(1)];
    const result = detectSupportResistance(candles, 1);
    expect(result.supports).toHaveLength(0);
    expect(result.resistances).toHaveLength(0);
  });

  it('detects resistance levels from swing highs', () => {
    const prices = [1, 2, 1, 3, 1, 4, 1, 3.5, 1];
    const candles = prices.map((p, i) => makeCandle(p, p + 0.01, p - 0.01));
    candles.forEach((c, i) => {
      c.timestamp = new Date(Date.now() + i * 3600000).toISOString();
    });

    const result = detectSupportResistance(candles, 1);
    expect(result.resistances.length).toBeGreaterThan(0);
    expect(result.resistances[0].type).toBe('resistance');
    expect(result.resistances[0].strength).toBeGreaterThan(0);
  });

  it('detects support levels from swing lows', () => {
    const prices = [5, 1, 5, 2, 5, 3, 5, 2.5, 5];
    const candles = prices.map((p, i) => makeCandle(p, p + 0.01, p - 0.01));
    candles.forEach((c, i) => {
      c.timestamp = new Date(Date.now() + i * 3600000).toISOString();
    });

    const result = detectSupportResistance(candles, 1);
    expect(result.supports.length).toBeGreaterThan(0);
    expect(result.supports[0].type).toBe('support');
    expect(result.supports[0].strength).toBeGreaterThan(0);
  });

  it('limits results to maximum levels', () => {
    const prices = [1, 5, 1, 6, 1, 7, 1, 8, 1, 9, 1];
    const candles = prices.map((p, i) => makeCandle(p, p + 0.01, p - 0.01));
    candles.forEach((c, i) => {
      c.timestamp = new Date(Date.now() + i * 3600000).toISOString();
    });

    const result = detectSupportResistance(candles, 1);
    expect(result.resistances.length).toBeLessThanOrEqual(3);
    expect(result.supports.length).toBeLessThanOrEqual(3);
  });

  it('includes zone bounds', () => {
    const prices = [1, 5, 1, 6, 1];
    const candles = prices.map((p, i) => makeCandle(p, p + 0.01, p - 0.01));
    candles.forEach((c, i) => {
      c.timestamp = new Date(Date.now() + i * 3600000).toISOString();
    });

    const result = detectSupportResistance(candles, 1);
    for (const level of [...result.supports, ...result.resistances]) {
      expect(level.zoneLow).toBeLessThan(level.zoneHigh);
      expect(level.zoneLow).toBeLessThanOrEqual(level.price);
      expect(level.zoneHigh).toBeGreaterThanOrEqual(level.price);
    }
  });

  it('returns levels sorted by strength descending', () => {
    const prices = [1, 5, 1, 5, 1, 5, 1];
    const candles = prices.map((p, i) => makeCandle(p, p + 0.01, p - 0.01));
    candles.forEach((c, i) => {
      c.timestamp = new Date(Date.now() + i * 3600000).toISOString();
    });

    const result = detectSupportResistance(candles, 1);
    for (let i = 1; i < result.resistances.length; i++) {
      expect(result.resistances[i - 1].strength).toBeGreaterThanOrEqual(result.resistances[i].strength);
    }
    for (let i = 1; i < result.supports.length; i++) {
      expect(result.supports[i - 1].strength).toBeGreaterThanOrEqual(result.supports[i].strength);
    }
  });
});
