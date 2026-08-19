import { describe, it, expect } from 'vitest';
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
    const candles = makeCandles([1, 2, 3, 4, 5]);
    const result = detectMarketStructure(candles, 1);
    expect(result.structure.trend).toBe('unclear');
    expect(result.structure.swingHighs).toHaveLength(0);
    expect(result.structure.swingLows).toHaveLength(0);
  });

  it('detects swing highs and swing lows', () => {
    const prices = [1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    expect(result.structure.swingHighs.length).toBeGreaterThan(0);
    expect(result.structure.swingLows.length).toBeGreaterThan(0);
  });

  it('classifies higher highs and higher lows as bullish', () => {
    const prices = [1, 3, 2, 4, 3, 5, 4, 6];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    expect(result.structure.trend).toBe('bullish');
  });

  it('classifies lower highs and lower lows as bearish', () => {
    const prices = [6, 4, 5, 3, 4, 2, 3, 1];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    expect(result.structure.trend).toBe('bearish');
  });

  it('returns range for mixed signals', () => {
    const prices = [1, 5, 2, 4, 3, 3, 4, 2, 5, 1];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    expect(result.structure.trend).toBe('range');
  });

  it('detects higher high events', () => {
    const prices = [1, 3, 2, 4, 3, 5];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    const hhEvents = result.structure.events.filter((e) => e.type === 'higher_high');
    expect(hhEvents.length).toBeGreaterThan(0);
  });

  it('detects lower low events', () => {
    const prices = [5, 3, 4, 2, 3, 1];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    const llEvents = result.structure.events.filter((e) => e.type === 'lower_low');
    expect(llEvents.length).toBeGreaterThan(0);
  });

  it('includes the last swing high and swing low', () => {
    const prices = [1, 3, 2, 4, 3, 5, 4];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    expect(result.structure.lastSwingHigh).not.toBeNull();
    expect(result.structure.lastSwingLow).not.toBeNull();
  });

  it('returns empty structure for insufficient candles', () => {
    const candles = makeCandles([1, 2, 3, 4, 5]);
    const result = detectMarketStructure(candles, 2);
    expect(result.structure.swingHighs).toHaveLength(0);
    expect(result.structure.swingLows).toHaveLength(0);
  });

  it('detects break of structure when price breaks recent swing high in bullish trend', () => {
    const prices = [1, 3, 2, 4, 3, 5, 4, 6.5];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    const bosEvents = result.structure.events.filter((e) => e.type === 'break_of_structure');
    expect(bosEvents.length).toBeGreaterThan(0);
  });

  it('detects change of character when price breaks against the trend', () => {
    const prices = [1, 3, 2, 4, 3, 5, 4, 0.5];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    const chochEvents = result.structure.events.filter((e) => e.type === 'change_of_character');
    expect(chochEvents.length).toBeGreaterThan(0);
  });
});

describe('detectStructureEvents', () => {
  it('returns only events from the structure', () => {
    const prices = [1, 3, 2, 4, 3, 5];
    const candles = makeCandles(prices);
    const result = detectMarketStructure(candles, 1);
    for (const event of result.structure.events) {
      expect(['higher_high', 'higher_low', 'lower_high', 'lower_low', 'break_of_structure', 'change_of_character']).toContain(event.type);
    }
  });
});
