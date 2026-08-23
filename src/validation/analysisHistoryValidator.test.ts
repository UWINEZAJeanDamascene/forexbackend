import { describe, expect, it } from 'vitest';
import { validateSaveAnalysisRequest } from './analysisHistoryValidator';

const validRequest = {
  symbol: 'EUR/USD', timeframe: '1H', analysisTimestamp: '2026-08-23T10:00:00.000Z', currentPrice: 1.12,
  dataProvider: 'test', trend: 'bullish', momentum: 'bullish', volatility: 'normal', structureTrend: 'bullish',
  higherHighsCount: 1, higherLowsCount: 1, lowerHighsCount: 0, lowerLowsCount: 0, confidenceScore: 70,
};

describe('validateSaveAnalysisRequest', () => {
  it('accepts a valid snapshot', () => {
    expect(validateSaveAnalysisRequest(validRequest)).toEqual([]);
  });

  it('rejects invalid identity, timestamp, and numeric values', () => {
    const errors = validateSaveAnalysisRequest({ ...validRequest, symbol: 'INVALID', timeframe: '2H', analysisTimestamp: 'bad', currentPrice: 0, confidenceScore: 101 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ')).toContain('symbol');
    expect(errors.join(' ')).toContain('timestamp');
  });

  it('rejects malformed nested snapshots', () => {
    const errors = validateSaveAnalysisRequest({
      ...validRequest,
      historicalCandles: [{ timestamp: 'bad', open: 1, high: 0.9, low: 1, close: 1 }],
      indicators: [{ type: '', period: 0, value: Number.NaN }],
      srLevels: [{ type: 'other', price: 1, strength: 120 }],
    });
    expect(errors.some((error) => error.includes('historicalCandles'))).toBe(true);
    expect(errors.some((error) => error.includes('indicators'))).toBe(true);
    expect(errors.some((error) => error.includes('srLevels'))).toBe(true);
  });
});