import { describe, it, expect, vi } from 'vitest';
import { Candle } from '../../shared/types/market';
import { detectMarketStructure, detectStructureEvents } from './marketStructureEngine';

function makeCandles(prices: number[], startTimestamp = '2024-01-01T00:00:00.000Z'): Candle[] {
  return prices.map((close, i) => {
    const ts = new Date(new Date(startTimestamp).getTime() + i * 3600000).toISOString();
    return {
      timestamp: ts,
      open: close,
      high: close + 0.001,
      low: close - 0.001,
      close,
      volume: null,
    };
  });
}

describe('detectMarketStructure', () => {
  it('returns unclear when there are too few candles', () => {
    const candles = makeCandles([5, 4, 3, 2, 1]);
    const result = detectMarketStructure(candles, 1);
    expect(result.structure.trend).toBe('unclear');
    expect(result.structure.candlestickPatterns).toEqual([]);
  });

  it('detects swing highs and swing lows', () => {
    const prices = [1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    expect(result.structure.swingHighs.length).toBeGreaterThan(0);
    expect(result.structure.swingLows.length).toBeGreaterThan(0);
  });

  it('classifies higher highs and higher lows as bullish', () => {
    const prices = [1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 9];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    expect(result.structure.trend).toBe('bullish');
  });

  it('classifies lower highs and lower lows as bearish', () => {
    const prices = [9, 7, 8, 6, 7, 5, 6, 4, 5, 3, 4, 2, 3, 1];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    expect(result.structure.trend).toBe('bearish');
  });

  it('returns range for mixed signals', () => {
    const prices = [1, 5, 2, 4, 3, 6, 4, 3, 5, 2, 6, 3];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    expect(result.structure.trend).toBe('range');
  });

  it('detects higher high events', () => {
    const prices = [1, 3, 2, 4, 3, 5, 4, 6, 5, 7];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    const hhEvents = result.structure.events.filter((e) => e.type === 'higher_high');
    expect(hhEvents.length).toBeGreaterThan(0);
  });

  it('detects lower low events', () => {
    const prices = [7, 5, 6, 4, 5, 3, 4, 2, 3, 1];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    const llEvents = result.structure.events.filter((e) => e.type === 'lower_low');
    expect(llEvents.length).toBeGreaterThan(0);
  });

  it('includes the last swing high and swing low', () => {
    const prices = [1, 3, 2, 4, 3, 5, 4, 6, 5, 7];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    expect(result.structure.lastSwingHigh).not.toBeNull();
    expect(result.structure.lastSwingLow).not.toBeNull();
  });

  it('can exclude swings without a complete confirmation window', () => {
    const candles = makeCandles([1, 3, 2, 4, 3, 5]);
    const result = detectMarketStructure(candles, 1, { confirmedSwingOnly: true });
    expect(result.structure.swingHighs.every((swing) => swing.index + 1 < candles.length)).toBe(true);
    expect(result.structure.swingLows.every((swing) => swing.index + 1 < candles.length)).toBe(true);
  });

  it('returns empty structure for insufficient candles', () => {
    const candles = makeCandles([5, 4, 3, 2, 2]);
    const result = detectMarketStructure(candles, 2);
    expect(result.structure.swingHighs).toHaveLength(0);
    expect(result.structure.swingLows).toHaveLength(0);
    expect(result.structure.candlestickPatterns).toEqual([]);
  });

  it('detects break of structure when price breaks recent swing high in bullish trend', () => {
    const prices = [1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8, 10.5];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    const bosEvents = result.structure.events.filter((e) => e.type === 'break_of_structure');
    expect(bosEvents.length).toBeGreaterThan(0);
  });

  it('detects change of character when price breaks against the trend', () => {
    const candles: Candle[] = [
      { timestamp: '2024-01-01T00:00:00.000Z', open: 1, high: 1.001, low: 0.999, close: 1, volume: null },
      { timestamp: '2024-01-01T01:00:00.000Z', open: 3, high: 3.001, low: 2.999, close: 3, volume: null },
      { timestamp: '2024-01-01T02:00:00.000Z', open: 2, high: 2.001, low: 1.999, close: 2, volume: null },
      { timestamp: '2024-01-01T03:00:00.000Z', open: 4, high: 4.001, low: 3.999, close: 4, volume: null },
      { timestamp: '2024-01-01T04:00:00.000Z', open: 3, high: 3.001, low: 2.999, close: 3, volume: null },
      { timestamp: '2024-01-01T05:00:00.000Z', open: 5, high: 5.001, low: 4.999, close: 5, volume: null },
      { timestamp: '2024-01-01T06:00:00.000Z', open: 4, high: 4.001, low: 3.999, close: 4, volume: null },
      { timestamp: '2024-01-01T07:00:00.000Z', open: 6, high: 6.001, low: 5.999, close: 6, volume: null },
      { timestamp: '2024-01-01T08:00:00.000Z', open: 5, high: 5.001, low: 4.999, close: 5, volume: null },
      { timestamp: '2024-01-01T09:00:00.000Z', open: 7, high: 7.001, low: 6.999, close: 7, volume: null },
      { timestamp: '2024-01-01T10:00:00.000Z', open: 6, high: 6.001, low: 5.999, close: 6, volume: null },
      { timestamp: '2024-01-01T11:00:00.000Z', open: 5.5, high: 5.501, low: 5.499, close: 4.5, volume: null },
    ];
    const result = detectMarketStructure(candles, 1);
    const chochEvents = result.structure.events.filter((e) => e.type === 'change_of_character');
    expect(chochEvents.length).toBeGreaterThan(0);
  });
});

describe('detectStructureEvents', () => {
  it('returns only events from the structure', () => {
    const prices = [1, 3, 2, 4, 3, 5, 4, 6, 5, 7];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    for (const event of result.structure.events) {
      expect(['higher_high', 'higher_low', 'lower_high', 'lower_low', 'break_of_structure', 'change_of_character']).toContain(event.type);
    }
  });
});

describe('swing size filtering', () => {
  it('does not change earlier structure when future candles are modified', () => {
    const candles = makeCandles([1, 3, 2, 4, 3, 5, 4, 6, 5]);
    const before = detectMarketStructure(candles.slice(0, 6), 1, { confirmedSwingOnly: true }).structure;
    candles[7].high = 99;
    candles[8].low = 0.1;
    const after = detectMarketStructure(candles.slice(0, 6), 1, { confirmedSwingOnly: true }).structure;
    expect(after).toEqual(before);
  });

  it('rejects swings that are too close in bar count', () => {
    const prices = [1, 3, 2, 3.5, 2.5, 4, 3.5, 5];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    const totalSwings = result.structure.swingHighs.length + result.structure.swingLows.length;
    expect(totalSwings).toBeLessThan(6);
  });

  it('rejects swings that do not move enough relative to ATR', () => {
    const prices = [1, 1.01, 1.005, 1.015, 1.01, 1.02];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    const totalSwings = result.structure.swingHighs.length + result.structure.swingLows.length;
    expect(totalSwings).toBeLessThanOrEqual(3);
  });

  it('preserves swings when ATR is unavailable', () => {
    const prices = [1, 3, 2, 4, 3, 5];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    expect(result.structure.swingHighs.length + result.structure.swingLows.length).toBeGreaterThan(0);
  });

  it('logs a warning when a large candle range is not reflected in swing moves', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const candles: Candle[] = [
      { timestamp: '2024-01-01T00:00:00.000Z', open: 1, high: 1000, low: 0, close: 1, volume: null },
      { timestamp: '2024-01-01T01:00:00.000Z', open: 1, high: 1.001, low: 0.999, close: 1, volume: null },
      { timestamp: '2024-01-01T02:00:00.000Z', open: 1, high: 1.001, low: 0.999, close: 1, volume: null },
      { timestamp: '2024-01-01T03:00:00.000Z', open: 1, high: 1.001, low: 0.999, close: 1, volume: null },
      { timestamp: '2024-01-01T04:00:00.000Z', open: 1, high: 1.001, low: 0.999, close: 1, volume: null },
    ];
    detectMarketStructure(candles, 1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Large unclassified candle range detected'));
    consoleWarnSpy.mockRestore();
  });
});
