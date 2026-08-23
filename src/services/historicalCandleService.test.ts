import { describe, expect, it, vi } from 'vitest';
import { Candle } from '../../../shared/types/market';
import { MarketDataProvider } from '../providers/MarketDataProvider';
import { loadHistoricalCandles } from './historicalCandleService';

function makeCandle(timestamp: string, close: number): Candle {
  return { timestamp, open: close, high: close + 0.01, low: close - 0.01, close, volume: null };
}

function providerWith(candles: Candle[]): MarketDataProvider {
  return {
    name: 'test-provider',
    getQuote: vi.fn(),
    getCandles: vi.fn(),
    getHistoricalData: vi.fn().mockResolvedValue(candles),
    getSupportedSymbols: () => ['EUR/USD'],
    getSupportedTimeframes: () => ['1H'],
  };
}

describe('loadHistoricalCandles', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const end = new Date('2026-01-01T03:00:00.000Z');

  it('loads the requested range through the configured provider and sorts candles', async () => {
    const provider = providerWith([
      makeCandle('2026-01-01T02:00:00.000Z', 2),
      makeCandle('2026-01-01T01:00:00.000Z', 1),
    ]);

    const result = await loadHistoricalCandles('EUR/USD', '1H', start, end, { provider });

    expect(provider.getHistoricalData).toHaveBeenCalledWith('EUR/USD', '1H', start, end);
    expect(result.provider).toBe('test-provider');
    expect(result.candles.map((candle) => candle.timestamp)).toEqual([
      '2026-01-01T01:00:00.000Z',
      '2026-01-01T02:00:00.000Z',
    ]);
  });

  it('rejects an invalid date range before calling the provider', async () => {
    const provider = providerWith([]);

    await expect(loadHistoricalCandles('EUR/USD', '1H', end, start, { provider }))
      .rejects.toThrow('startDate before endDate');
    expect(provider.getHistoricalData).not.toHaveBeenCalled();
  });

  it('rejects candles outside the requested range', async () => {
    const provider = providerWith([makeCandle('2025-12-31T23:00:00.000Z', 1)]);

    await expect(loadHistoricalCandles('EUR/USD', '1H', start, end, { provider }))
      .rejects.toThrow('outside the requested date range');
  });

  it('rejects a historical series that is too short for the requested warmup', async () => {
    const provider = providerWith([makeCandle('2026-01-01T01:00:00.000Z', 1)]);

    await expect(loadHistoricalCandles('EUR/USD', '1H', start, end, { provider, minCandles: 200 }))
      .rejects.toThrow('insufficient usable data');
  });
});
