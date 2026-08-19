import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../services/marketDataService', () => ({
  getValidatedCandles: vi.fn(),
}));

import { createApp } from '../app';
import { getValidatedCandles } from '../services/marketDataService';
import { DataValidationError } from '../validation';
import { MarketDataError } from '../providers/MarketDataProvider';

const mockedGetValidatedCandles = vi.mocked(getValidatedCandles);

describe('GET /api/market/candles', () => {
  beforeEach(() => {
    mockedGetValidatedCandles.mockReset();
  });

  it('returns 400 for an unsupported symbol', async () => {
    const app = createApp();
    const res = await request(app).get('/api/market/candles').query({ symbol: 'DOGE/USD', timeframe: '1H' });

    expect(res.status).toBe(400);
    expect(mockedGetValidatedCandles).not.toHaveBeenCalled();
  });

  it('returns 400 for an unsupported timeframe', async () => {
    const app = createApp();
    const res = await request(app).get('/api/market/candles').query({ symbol: 'EUR/USD', timeframe: '1m' });

    expect(res.status).toBe(400);
    expect(mockedGetValidatedCandles).not.toHaveBeenCalled();
  });

  it('returns 400 for an out-of-range limit', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/market/candles')
      .query({ symbol: 'EUR/USD', timeframe: '1H', limit: '9999' });

    expect(res.status).toBe(400);
  });

  it('returns 200 with candles and warnings on success', async () => {
    mockedGetValidatedCandles.mockResolvedValue({
      candles: [
        { timestamp: '2024-01-01T10:00:00.000Z', open: 1.1, high: 1.105, low: 1.095, close: 1.102, volume: null },
      ],
      issues: [
        { type: 'MISSING_CANDLE_GAP', severity: 'warning', message: 'gap warning' },
      ] as any,
    });

    const app = createApp();
    const res = await request(app).get('/api/market/candles').query({ symbol: 'EUR/USD', timeframe: '1H' });

    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe('EUR/USD');
    expect(res.body.candles).toHaveLength(1);
    expect(res.body.warnings).toEqual(['gap warning']);
  });

  it('returns 422 when the service throws DataValidationError', async () => {
    mockedGetValidatedCandles.mockRejectedValue(
      new DataValidationError('rejected', [{ type: 'INSUFFICIENT_CANDLE_COUNT', severity: 'error', message: 'too few' }])
    );

    const app = createApp();
    const res = await request(app).get('/api/market/candles').query({ symbol: 'EUR/USD', timeframe: '1H' });

    expect(res.status).toBe(422);
    expect(res.body.issues).toHaveLength(1);
  });

  it('returns 500 without leaking details when the provider is misconfigured', async () => {
    mockedGetValidatedCandles.mockRejectedValue(
      new MarketDataError('CONFIG_ERROR', 'twelvedata', 'TWELVE_DATA_API_KEY is not set')
    );

    const app = createApp();
    const res = await request(app).get('/api/market/candles').query({ symbol: 'EUR/USD', timeframe: '1H' });

    expect(res.status).toBe(500);
    expect(res.body.error).not.toContain('TWELVE_DATA_API_KEY');
  });

  it('returns 429 on rate limit', async () => {
    mockedGetValidatedCandles.mockRejectedValue(
      new MarketDataError('RATE_LIMIT', 'twelvedata', 'rate limited')
    );

    const app = createApp();
    const res = await request(app).get('/api/market/candles').query({ symbol: 'EUR/USD', timeframe: '1H' });

    expect(res.status).toBe(429);
  });

  it('returns 502 on a network/provider error', async () => {
    mockedGetValidatedCandles.mockRejectedValue(
      new MarketDataError('NETWORK_ERROR', 'twelvedata', 'ECONNRESET')
    );

    const app = createApp();
    const res = await request(app).get('/api/market/candles').query({ symbol: 'EUR/USD', timeframe: '1H' });

    expect(res.status).toBe(502);
  });
});

describe('GET /api/market/symbols and /api/market/timeframes', () => {
  it('returns the enabled symbol list', async () => {
    const app = createApp();
    const res = await request(app).get('/api/market/symbols');
    expect(res.status).toBe(200);
    expect(res.body.symbols).toContain('EUR/USD');
  });

  it('returns the enabled timeframe list', async () => {
    const app = createApp();
    const res = await request(app).get('/api/market/timeframes');
    expect(res.status).toBe(200);
    expect(res.body.timeframes).toContain('1H');
  });
});
