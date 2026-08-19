import { describe, it, expect } from 'vitest';
import { ema } from './ema';

describe('ema', () => {
  it('returns nulls when there are fewer closes than the period', () => {
    const result = ema([10, 20, 30], 5);
    expect(result).toEqual([null, null, null]);
  });

  it('computes EMA correctly for a known simple series', () => {
    // Series: [10, 20, 30, 40, 50], period 3
    // SMA of first 3: (10+20+30)/3 = 20
    // k = 2/(3+1) = 0.5
    // EMA[3] = 40*0.5 + 20*0.5 = 30
    // EMA[4] = 50*0.5 + 30*0.5 = 40
    const result = ema([10, 20, 30, 40, 50], 3);
    expect(result).toEqual([null, null, 20, 30, 40]);
  });

  it('matches a pre-computed EMA for a longer series', () => {
    // Period 3, series: [2, 4, 6, 8, 10, 12, 14]
    // SMA first 3: (2+4+6)/3 = 4
    // k = 0.5
    // i=3: 8*0.5 + 4*0.5 = 6
    // i=4: 10*0.5 + 6*0.5 = 8
    // i=5: 12*0.5 + 8*0.5 = 10
    // i=6: 14*0.5 + 10*0.5 = 12
    const result = ema([2, 4, 6, 8, 10, 12, 14], 3);
    expect(result).toEqual([null, null, 4, 6, 8, 10, 12]);
  });

  it('throws for period < 1', () => {
    expect(() => ema([1, 2, 3], 0)).toThrow('EMA period must be >= 1');
  });
});
