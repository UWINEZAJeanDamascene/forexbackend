import { describe, it, expect } from 'vitest';
import { validateCandle, isCandleCorrupted } from './candleValidator';
import { Candle } from '../../../shared/types/market';

function makeCandle(overrides: Partial<Candle> = {}): Candle {
  return {
    timestamp: '2024-01-01T10:00:00.000Z',
    open: 1.1,
    high: 1.105,
    low: 1.095,
    close: 1.102,
    volume: null,
    ...overrides,
  };
}

describe('validateCandle', () => {
  it('returns no issues for a valid candle', () => {
    expect(validateCandle(makeCandle(), 0)).toEqual([]);
  });

  it('flags high < open', () => {
    const issues = validateCandle(makeCandle({ high: 1.05, open: 1.1 }), 0);
    expect(issues.some((i) => i.type === 'INVALID_OHLC_RELATIONSHIP')).toBe(true);
  });

  it('flags high < close', () => {
    const issues = validateCandle(makeCandle({ high: 1.05, close: 1.1 }), 0);
    expect(issues.some((i) => i.type === 'INVALID_OHLC_RELATIONSHIP')).toBe(true);
  });

  it('flags low > open', () => {
    const issues = validateCandle(makeCandle({ low: 1.15, open: 1.1 }), 0);
    expect(issues.some((i) => i.type === 'INVALID_OHLC_RELATIONSHIP')).toBe(true);
  });

  it('flags low > close', () => {
    const issues = validateCandle(makeCandle({ low: 1.15, close: 1.1 }), 0);
    expect(issues.some((i) => i.type === 'INVALID_OHLC_RELATIONSHIP')).toBe(true);
  });

  it('flags high < low', () => {
    const issues = validateCandle(makeCandle({ high: 1.0, low: 1.1 }), 0);
    expect(issues.some((i) => i.type === 'INVALID_OHLC_RELATIONSHIP')).toBe(true);
  });

  it('flags negative prices', () => {
    const issues = validateCandle(makeCandle({ open: -1.1 }), 0);
    expect(issues.some((i) => i.type === 'NEGATIVE_PRICE')).toBe(true);
  });

  it('flags zero prices as non-positive', () => {
    const issues = validateCandle(makeCandle({ close: 0 }), 0);
    expect(issues.some((i) => i.type === 'NEGATIVE_PRICE')).toBe(true);
  });

  it('flags NaN/Infinity prices as invalid', () => {
    const issues = validateCandle(makeCandle({ high: NaN }), 0);
    expect(issues.some((i) => i.type === 'INVALID_PRICE')).toBe(true);
  });

  it('does not double-check OHLC relationships when a price is already invalid', () => {
    const issues = validateCandle(makeCandle({ high: NaN }), 0);
    expect(issues.some((i) => i.type === 'INVALID_OHLC_RELATIONSHIP')).toBe(false);
  });

  it('flags a negative volume as a warning, not an error', () => {
    const issues = validateCandle(makeCandle({ volume: -5 }), 0);
    const volumeIssue = issues.find((i) => i.message.includes('volume'));
    expect(volumeIssue?.severity).toBe('warning');
  });

  it('allows null volume (typical for spot FX)', () => {
    expect(validateCandle(makeCandle({ volume: null }), 0)).toEqual([]);
  });
});

describe('isCandleCorrupted', () => {
  it('is false for a valid candle', () => {
    expect(isCandleCorrupted(makeCandle(), 0)).toBe(false);
  });

  it('is true when there is an error-severity issue', () => {
    expect(isCandleCorrupted(makeCandle({ open: -1 }), 0)).toBe(true);
  });

  it('is false when there is only a warning-severity issue', () => {
    expect(isCandleCorrupted(makeCandle({ volume: -5 }), 0)).toBe(false);
  });
});
