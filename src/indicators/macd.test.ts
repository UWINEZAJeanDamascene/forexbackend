import { describe, it, expect } from 'vitest';
import { macd } from './macd';

describe('macd', () => {
  it('returns nulls when there are too few closes', () => {
    const result = macd([10, 20, 30], 12, 26, 9);
    expect(result.macdLine.every((v) => v === null)).toBe(true);
    expect(result.signalLine.every((v) => v === null)).toBe(true);
    expect(result.histogram.every((v) => v === null)).toBe(true);
  });

  it('computes non-null MACD after enough data', () => {
    // 50 constant closes => EMA(12) == EMA(26) => MACD == 0
    const closes = Array.from({ length: 50 }, () => 100);
    const result = macd(closes, 12, 26, 9);

    expect(result.macdLine.slice(0, 25).every((v) => v === null)).toBe(true);
    expect(result.signalLine.slice(0, 33).every((v) => v === null)).toBe(true);
    expect(result.histogram.slice(0, 33).every((v) => v === null)).toBe(true);

    const firstMacd = result.macdLine.findIndex((v) => v !== null);
    const firstSignal = result.signalLine.findIndex((v) => v !== null);
    const firstHist = result.histogram.findIndex((v) => v !== null);

    expect(firstMacd).toBe(25);
    expect(firstSignal).toBe(33);
    expect(firstHist).toBe(33);
    expect(result.macdLine[firstMacd]).toBeCloseTo(0, 5);
  });

  it('produces positive MACD for a rising series', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5);
    const result = macd(closes, 12, 26, 9);
    const firstMacd = result.macdLine.findIndex((v) => v !== null);
    expect(firstMacd).toBeGreaterThanOrEqual(0);
    expect(result.macdLine[firstMacd] as number).toBeGreaterThan(0);
  });

  it('throws when fastPeriod >= slowPeriod', () => {
    expect(() => macd([1, 2, 3], 26, 12, 9)).toThrow('fastPeriod');
  });

  it('throws for signalPeriod < 1', () => {
    expect(() => macd([1, 2, 3], 12, 26, 0)).toThrow('signalPeriod');
  });
});
