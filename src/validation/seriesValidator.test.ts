import { describe, it, expect } from 'vitest';
import {
  validateCandleSeries,
  checkDuplicateTimestamps,
  sortAndDetectOutOfOrder,
  detectGaps,
} from './seriesValidator';
import { DataValidationError } from './types';
import { Candle } from '../../../shared/types/market';

function makeCandle(timestamp: string, overrides: Partial<Candle> = {}): Candle {
  return {
    timestamp,
    open: 1.1,
    high: 1.105,
    low: 1.095,
    close: 1.102,
    volume: null,
    ...overrides,
  };
}

describe('checkDuplicateTimestamps', () => {
  it('keeps the first occurrence and drops later duplicates', () => {
    const candles = [
      makeCandle('2024-01-01T10:00:00.000Z', { open: 1.1 }),
      makeCandle('2024-01-01T10:00:00.000Z', { open: 1.2 }), // duplicate
      makeCandle('2024-01-01T11:00:00.000Z'),
    ];

    const { deduped, issues } = checkDuplicateTimestamps(candles);

    expect(deduped).toHaveLength(2);
    expect(deduped[0].open).toBe(1.1);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('DUPLICATE_TIMESTAMP');
  });

  it('reports no issues when there are no duplicates', () => {
    const candles = [makeCandle('2024-01-01T10:00:00.000Z'), makeCandle('2024-01-01T11:00:00.000Z')];
    expect(checkDuplicateTimestamps(candles).issues).toEqual([]);
  });
});

describe('sortAndDetectOutOfOrder', () => {
  it('sorts out-of-order candles chronologically and reports it', () => {
    const candles = [makeCandle('2024-01-01T11:00:00.000Z'), makeCandle('2024-01-01T10:00:00.000Z')];

    const { sorted, issues } = sortAndDetectOutOfOrder(candles);

    expect(sorted[0].timestamp).toBe('2024-01-01T10:00:00.000Z');
    expect(sorted[1].timestamp).toBe('2024-01-01T11:00:00.000Z');
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('OUT_OF_ORDER_TIMESTAMP');
  });

  it('reports no issue when already sorted', () => {
    const candles = [makeCandle('2024-01-01T10:00:00.000Z'), makeCandle('2024-01-01T11:00:00.000Z')];
    expect(sortAndDetectOutOfOrder(candles).issues).toEqual([]);
  });
});

describe('detectGaps', () => {
  it('flags a gap much larger than the expected timeframe interval', () => {
    const candles = [
      makeCandle('2024-01-01T10:00:00.000Z'),
      makeCandle('2024-01-03T10:00:00.000Z'), // 2-day gap on a 1H timeframe
    ];

    const issues = detectGaps(candles, '1H');
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('MISSING_CANDLE_GAP');
    expect(issues[0].severity).toBe('warning');
  });

  it('does not flag normal consecutive candles', () => {
    const candles = [makeCandle('2024-01-01T10:00:00.000Z'), makeCandle('2024-01-01T11:00:00.000Z')];
    expect(detectGaps(candles, '1H')).toEqual([]);
  });
});

describe('validateCandleSeries', () => {
  it('returns cleaned, sorted candles for good data', () => {
    const candles = [makeCandle('2024-01-01T10:00:00.000Z'), makeCandle('2024-01-01T11:00:00.000Z')];

    const result = validateCandleSeries(candles, '1H');

    expect(result.candles).toHaveLength(2);
    expect(result.issues).toEqual([]);
  });

  it('drops corrupted candles and keeps the rest when enough remain', () => {
    const candles = [
      makeCandle('2024-01-01T10:00:00.000Z'),
      makeCandle('2024-01-01T11:00:00.000Z', { open: -1 }), // corrupted
      makeCandle('2024-01-01T12:00:00.000Z'),
    ];

    const result = validateCandleSeries(candles, '1H', { minCandles: 2 });

    expect(result.candles).toHaveLength(2);
    expect(result.issues.some((i) => i.type === 'NEGATIVE_PRICE')).toBe(true);
  });

  it('throws DataValidationError when zero candles are provided', () => {
    expect(() => validateCandleSeries([], '1H')).toThrow(DataValidationError);
  });

  it('throws DataValidationError when too few valid candles remain after cleaning', () => {
    const candles = [
      makeCandle('2024-01-01T10:00:00.000Z', { open: -1 }), // corrupted
      makeCandle('2024-01-01T11:00:00.000Z', { high: NaN }), // corrupted
    ];

    expect(() => validateCandleSeries(candles, '1H', { minCandles: 1 })).toThrow(DataValidationError);
  });

  it('includes all collected issues on the thrown error', () => {
    try {
      validateCandleSeries([], '1H');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DataValidationError);
      expect((err as InstanceType<typeof DataValidationError>).issues.length).toBeGreaterThan(0);
    }
  });

  it('deduplicates, sorts, and flags gaps together in one pass', () => {
    const candles = [
      makeCandle('2024-01-01T12:00:00.000Z'), // out of order
      makeCandle('2024-01-01T10:00:00.000Z'),
      makeCandle('2024-01-01T10:00:00.000Z'), // duplicate of previous
      makeCandle('2024-01-05T10:00:00.000Z'), // big gap
    ];

    const result = validateCandleSeries(candles, '1H', { minCandles: 2 });

    expect(result.candles).toHaveLength(3); // duplicate removed
    expect(result.issues.some((i) => i.type === 'DUPLICATE_TIMESTAMP')).toBe(true);
    expect(result.issues.some((i) => i.type === 'OUT_OF_ORDER_TIMESTAMP')).toBe(true);
    expect(result.issues.some((i) => i.type === 'MISSING_CANDLE_GAP')).toBe(true);
    // chronological order after cleaning
    expect(result.candles[0].timestamp < result.candles[1].timestamp).toBe(true);
    expect(result.candles[1].timestamp < result.candles[2].timestamp).toBe(true);
  });
});
