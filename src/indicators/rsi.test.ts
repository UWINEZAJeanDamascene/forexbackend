import { describe, it, expect } from 'vitest';
import { rsi } from './rsi';

describe('rsi', () => {
  it('returns nulls when there are too few closes', () => {
    const result = rsi([10, 20, 30, 40], 14);
    expect(result).toEqual([null, null, null, null]);
  });

  it('returns exactly period nulls before the first RSI value', () => {
    // 15 closes, period 14 => first RSI at index 14
    const closes = Array.from({ length: 15 }, (_, i) => i + 1);
    const result = rsi(closes, 14);
    expect(result.slice(0, 14)).toEqual(new Array(14).fill(null));
    expect(result[14]).not.toBeNull();
  });

  it('computes a high RSI for a strictly rising series', () => {
    const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const result = rsi(closes, 14);
    expect(result[14]).toBeGreaterThan(90);
    expect(result[14]).toBeLessThan(100);
  });

  it('computes a low RSI for a strictly falling series', () => {
    const closes = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const result = rsi(closes, 14);
    expect(result[14]).toBeGreaterThanOrEqual(0);
    expect(result[14]).toBeLessThan(10);
  });

  it('computes a bullish RSI for net positive momentum', () => {
    const closes = [10, 12, 14, 12, 14, 16, 18, 16, 18, 20, 22, 20, 22, 24, 26];
    const result = rsi(closes, 14);
    expect(result[14]).toBeGreaterThan(50);
    expect(result[14]).toBeLessThan(100);
  });

  it('throws for period < 1', () => {
    expect(() => rsi([1, 2, 3], 0)).toThrow('RSI period must be >= 1');
  });
});
