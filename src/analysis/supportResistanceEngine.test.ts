import { describe, it, expect } from 'vitest';
import { Candle } from '../../shared/types/market';
import { detectSupportResistance } from './supportResistanceEngine';

function makeCandle(close: number, high?: number, low?: number): Candle {
  const h = high ?? close + 0.01;
  const l = low ?? close - 0.01;
  return { timestamp: '2024-01-01T10:00:00.000Z', open: close, high: h, low: l, close, volume: null };
}

function makeCandlesWithTime(prices: number[]): Candle[] {
  return prices.map((p, i) => {
    const c = makeCandle(p, p + 0.01, p - 0.01);
    c.timestamp = new Date(Date.now() + i * 3600000).toISOString();
    return c;
  });
}

describe('detectSupportResistance', () => {
  it('does not change earlier support or resistance when future candles change', () => {
    const candles = makeCandlesWithTime([1, 5, 1, 5, 1, 6, 1, 6, 1]);
    const before = detectSupportResistance(candles.slice(0, 7), 1);
    candles[7].high = 100;
    candles[8].low = 0.1;
    const after = detectSupportResistance(candles.slice(0, 7), 1);
    expect(after).toEqual(before);
  });

  it('returns empty arrays when there are too few candles', () => {
    const candles = [makeCandle(1), makeCandle(2), makeCandle(3)];
    const result = detectSupportResistance(candles, 2);
    expect(result.supports).toHaveLength(0);
    expect(result.resistances).toHaveLength(0);
    expect(result.tested).toHaveLength(0);
  });

  it('returns empty arrays when there are no swing points', () => {
    const candles = [makeCandle(1), makeCandle(1), makeCandle(1), makeCandle(1), makeCandle(1)];
    const result = detectSupportResistance(candles, 1);
    expect(result.supports).toHaveLength(0);
    expect(result.resistances).toHaveLength(0);
    expect(result.tested).toHaveLength(0);
  });

  it('detects resistance levels from swing highs', () => {
    const candles = makeCandlesWithTime([1, 5, 1, 5, 1, 5, 1]);
    const result = detectSupportResistance(candles, 1);
    expect(result.resistances.length).toBeGreaterThan(0);
    expect(result.resistances[0].type).toBe('resistance');
    expect(result.resistances[0].strength).toBeGreaterThanOrEqual(60);
  });

  it('detects support levels from swing lows', () => {
    const candles = makeCandlesWithTime([5, 1, 5, 1, 5, 1, 5]);
    const result = detectSupportResistance(candles, 1);
    expect(result.supports.length).toBeGreaterThan(0);
    expect(result.supports[0].type).toBe('support');
    expect(result.supports[0].strength).toBeGreaterThanOrEqual(60);
  });

  it('limits results to maximum levels', () => {
    const candles = makeCandlesWithTime([1, 5, 1, 5, 1, 6, 1, 6, 1, 7, 1]);
    const result = detectSupportResistance(candles, 1);
    expect(result.resistances.length).toBeLessThanOrEqual(3);
    expect(result.supports.length).toBeLessThanOrEqual(3);
    expect(result.tested.length).toBeLessThanOrEqual(3);
  });

  it('includes zone bounds', () => {
    const candles = makeCandlesWithTime([1, 5, 1, 5, 1]);
    const result = detectSupportResistance(candles, 1);
    for (const level of [...result.supports, ...result.resistances, ...result.tested]) {
      expect(level.zoneLow).toBeLessThan(level.zoneHigh);
      expect(level.zoneLow).toBeLessThanOrEqual(level.price);
      expect(level.zoneHigh).toBeGreaterThanOrEqual(level.price);
    }
  });

  it('returns levels sorted by strength descending', () => {
    const candles = makeCandlesWithTime([1, 5, 1, 5, 1, 5, 1]);
    const result = detectSupportResistance(candles, 1);
    for (let i = 1; i < result.resistances.length; i++) {
      expect(result.resistances[i - 1].strength).toBeGreaterThanOrEqual(result.resistances[i].strength);
    }
    for (let i = 1; i < result.supports.length; i++) {
      expect(result.supports[i - 1].strength).toBeGreaterThanOrEqual(result.supports[i].strength);
    }
    for (let i = 1; i < result.tested.length; i++) {
      expect(result.tested[i - 1].strength).toBeGreaterThanOrEqual(result.tested[i].strength);
    }
  });

  it('clusters nearby levels within ATR tolerance', () => {
    const prices = [1, 5.005, 1, 5.01, 1, 5.015, 1];
    const candles = makeCandlesWithTime(prices);
    const result = detectSupportResistance(candles, 1);
    const totalResistances = result.resistances.length;
    expect(totalResistances).toBeLessThanOrEqual(1);
  });

  it('applies strength floor and filters weak levels', () => {
    const now = Date.now();
    const oldTimestamp = new Date(now - 200 * 24 * 60 * 60 * 1000).toISOString();
    const candles: Candle[] = [
      { timestamp: oldTimestamp, open: 1, high: 1.01, low: 0.99, close: 1, volume: null },
      { timestamp: new Date(now - 199 * 24 * 60 * 60 * 1000).toISOString(), open: 5, high: 5.01, low: 4.99, close: 5, volume: null },
      { timestamp: new Date(now - 198 * 24 * 60 * 60 * 1000).toISOString(), open: 1, high: 1.01, low: 0.99, close: 1, volume: null },
    ];
    const result = detectSupportResistance(candles, 1);
    for (const level of [...result.supports, ...result.resistances, ...result.tested]) {
      expect(level.strength).toBeGreaterThanOrEqual(35);
    }
  });

  it('merges overlapping zones so no two returned zones overlap', () => {
    const candles = makeCandlesWithTime([1, 5.005, 1, 5.01, 1, 5.015, 1]);
    const result = detectSupportResistance(candles, 1);
    const allLevels = [...result.supports, ...result.resistances, ...result.tested];
    for (let i = 0; i < allLevels.length; i++) {
      for (let j = i + 1; j < allLevels.length; j++) {
        const a = allLevels[i];
        const b = allLevels[j];
        const overlaps = a.zoneLow <= b.zoneHigh && b.zoneLow <= a.zoneHigh;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('classifies zones with price inside as tested', () => {
    const candles = makeCandlesWithTime([1, 5, 1, 5.005, 1, 5.01, 1]);
    const result = detectSupportResistance(candles, 1);
    const currentPrice = candles[candles.length - 1].close;
    const allLevels = [...result.supports, ...result.resistances, ...result.tested];
    for (const level of allLevels) {
      if (level.type === 'tested') {
        expect(level.zoneLow).toBeLessThanOrEqual(currentPrice);
        expect(level.zoneHigh).toBeGreaterThanOrEqual(currentPrice);
      }
    }
  });

  it('caps zone width relative to ATR so levels stay actionable', () => {
    // Distant swing lows that would previously merge into a huge support band.
    const prices = [10, 1, 10, 1.5, 10, 2, 10, 9.5, 10];
    const candles = makeCandlesWithTime(prices);
    const result = detectSupportResistance(candles, 1);
    const fullSpan = Math.max(...prices) - Math.min(...prices);
    for (const level of [...result.supports, ...result.resistances, ...result.tested]) {
      const width = level.zoneHigh - level.zoneLow;
      // Must be materially tighter than the full price span of the series.
      expect(width).toBeLessThan(fullSpan * 0.5);
      expect(width).toBeGreaterThan(0);
    }
  });

  it('adds a soft resistance near price when only supports would otherwise appear', () => {
    // Uptrend finishing near highs: many lows below, one clear recent high above.
    const prices = [1, 2, 1.2, 2.2, 1.4, 2.4, 1.6, 2.6, 2.3];
    const candles = makeCandlesWithTime(prices);
    const result = detectSupportResistance(candles, 1);
    const currentPrice = candles[candles.length - 1].close;
    const hasResistanceAbove = result.resistances.some((r) => r.price > currentPrice);
    const hasSupportBelow = result.supports.some((s) => s.price < currentPrice);
    expect(hasSupportBelow || result.tested.length > 0).toBe(true);
    expect(hasResistanceAbove || result.tested.length > 0).toBe(true);
  });
});
