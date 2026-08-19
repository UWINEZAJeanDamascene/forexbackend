import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../services/marketDataService', () => ({
  getValidatedCandles: vi.fn(),
}));

import { createApp } from '../app';
import { getValidatedCandles } from '../services/marketDataService';

const mockedGetValidatedCandles = vi.mocked(getValidatedCandles);

describe('GET /api/market/indicators', () => {
  beforeEach(() => {
    mockedGetValidatedCandles.mockReset();
  });

  it('returns 400 for an unsupported symbol', async () => {
    const app = createApp();
    const res = await request(app).get('/api/market/indicators').query({ symbol: 'DOGE/USD', timeframe: '1H' });

    expect(res.status).toBe(400);
    expect(mockedGetValidatedCandles).not.toHaveBeenCalled();
  });

  it('returns 400 for an unsupported timeframe', async () => {
    const app = createApp();
    const res = await request(app).get('/api/market/indicators').query({ symbol: 'EUR/USD', timeframe: '1m' });

    expect(res.status).toBe(400);
    expect(mockedGetValidatedCandles).not.toHaveBeenCalled();
  });

  it('returns 200 with computed indicators on success', async () => {
    mockedGetValidatedCandles.mockResolvedValue({
      candles: Array.from({ length: 50 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 3600000).toISOString(),
        open: 1.1,
        high: 1.105,
        low: 1.095,
        close: 1.102,
        volume: null,
      })),
      issues: [],
    });

    const app = createApp();
    const res = await request(app).get('/api/market/indicators').query({ symbol: 'EUR/USD', timeframe: '1H' });

    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe('EUR/USD');
    expect(res.body.timeframe).toBe('1H');
    expect(res.body.indicators).toBeDefined();
    expect(res.body.indicators.ema20).toHaveLength(50);
    expect(res.body.indicators.rsi14).toHaveLength(50);
    expect(res.body.indicators.macd.line).toHaveLength(50);
    expect(res.body.indicators.atr14).toHaveLength(50);
    expect(res.body.indicators.bollingerBands.upper).toHaveLength(50);
  });
});
