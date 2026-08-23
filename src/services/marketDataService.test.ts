import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getValidatedCandles, clearCandleCache } from './marketDataService';
import { DataValidationError } from '../validation';
import { Candle } from '../../../shared/types/market';
import { MarketDataProvider } from '../providers/MarketDataProvider';

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

function fakeProvider(candles: Candle[]): MarketDataProvider {
  return {
    name: 'fake',
    getQuote: vi.fn(),
    getCandles: vi.fn().mockResolvedValue(candles),
    getHistoricalData: vi.fn(),
    getSupportedSymbols: vi.fn().mockReturnValue(['EUR/USD']),
    getSupportedTimeframes: vi.fn().mockReturnValue(['1H']),
  };
}

describe('getValidatedCandles', () => {
  beforeEach(() => {
    clearCandleCache();
  });
  it('returns validated candles from the injected provider', async () => {
    const provider = fakeProvider([
      makeCandle('2024-01-01T10:00:00.000Z'),
      makeCandle('2024-01-01T11:00:00.000Z'),
    ]);

    const result = await getValidatedCandles('EUR/USD', '1H', { provider });

    expect(result.candles).toHaveLength(2);
    expect(provider.getCandles).toHaveBeenCalledWith('EUR/USD', '1H', undefined);
  });

  it('passes the limit through to the provider', async () => {
    const provider = fakeProvider([
      makeCandle('2024-01-01T10:00:00.000Z'),
      makeCandle('2024-01-01T11:00:00.000Z'),
    ]);

    await getValidatedCandles('EUR/USD', '1H', { provider, limit: 50 });

    expect(provider.getCandles).toHaveBeenCalledWith('EUR/USD', '1H', 50);
  });

  it('excludes an unfinished candle even when only two candles are available', async () => {
    const provider = fakeProvider([
      makeCandle(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()),
      makeCandle(new Date(Date.now() - 5 * 60 * 1000).toISOString()),
    ]);

    const result = await getValidatedCandles('EUR/USD', '1H', { provider });

    expect(result.candles).toHaveLength(2);
    expect(result.analysisCandles).toHaveLength(1);
    expect(result.analysisCandles[0].timestamp).not.toBe(result.candles[1].timestamp);
  });

  it('coalesces concurrent requests for the same daily snapshot', async () => {
    let resolveRequest!: (candles: Candle[]) => void;
    const provider = fakeProvider([]);
    vi.mocked(provider.getCandles).mockImplementation(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const first = getValidatedCandles('EUR/USD', '1D', { provider, limit: 500 });
    const second = getValidatedCandles('EUR/USD', '1D', { provider, limit: 500 });
    resolveRequest([
      makeCandle('2024-01-01T00:00:00.000Z'),
      makeCandle('2024-01-02T00:00:00.000Z'),
    ]);

    await Promise.all([first, second]);
    expect(provider.getCandles).toHaveBeenCalledTimes(1);
  });

  it('propagates DataValidationError when the provider returns unusable data', async () => {
    const provider = fakeProvider([]);

    await expect(getValidatedCandles('EUR/USD', '1H', { provider })).rejects.toThrow(
      DataValidationError
    );
  });

  it('drops corrupted candles from the provider before returning', async () => {
    const provider = fakeProvider([
      makeCandle('2024-01-01T10:00:00.000Z'),
      makeCandle('2024-01-01T11:00:00.000Z', { open: -1 }),
      makeCandle('2024-01-01T12:00:00.000Z'),
    ]);

    const result = await getValidatedCandles('EUR/USD', '1H', { provider, minCandles: 2 });

    expect(result.candles).toHaveLength(2);
    expect(result.issues.some((i) => i.type === 'NEGATIVE_PRICE')).toBe(true);
  });
});
