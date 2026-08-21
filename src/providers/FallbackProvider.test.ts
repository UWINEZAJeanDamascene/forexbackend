import { describe, it, expect, vi } from 'vitest';
import { MarketDataError, MarketDataErrorKind } from './MarketDataProvider';
import { FallbackProvider } from './FallbackProvider';

function createMockProvider(name: string, behavior: {
  getCandles?: () => Promise<{ length: number }>;
  getQuote?: () => Promise<{ price: number }>;
  getHistoricalData?: () => Promise<{ length: number }>;
  getSupportedSymbols?: () => string[];
  getSupportedTimeframes?: () => string[];
  supportsForex?: boolean;
}): MarketDataProvider {
  return {
    name,
    supportsForex: behavior.supportsForex ?? true,
    getCandles: vi.fn(behavior.getCandles || (() => Promise.resolve([]))),
    getQuote: vi.fn(behavior.getQuote || (() => Promise.resolve({ price: 0 }))),
    getHistoricalData: vi.fn(behavior.getHistoricalData || (() => Promise.resolve([]))),
    getSupportedSymbols: vi.fn(behavior.getSupportedSymbols || (() => [])),
    getSupportedTimeframes: vi.fn(behavior.getSupportedTimeframes || (() => [])),
  } as unknown as MarketDataProvider;
}

describe('FallbackProvider', () => {
  it('returns result from first provider on success', async () => {
    const primary = createMockProvider('primary', {
      getCandles: () => Promise.resolve([{ timestamp: '', open: 1, high: 1, low: 1, close: 1, volume: null }]),
    });
    const fallback = createMockProvider('fallback', {
      getCandles: () => Promise.resolve([]),
    });

    const provider = new FallbackProvider([primary, fallback]);
    const candles = await provider.getCandles('EUR/USD', '1H');

    expect(candles).toHaveLength(1);
    expect(primary.getCandles).toHaveBeenCalledTimes(1);
    expect(fallback.getCandles).not.toHaveBeenCalled();
  });

  it('falls back to second provider when first fails with retryable error', async () => {
    const primary = createMockProvider('primary', {
      getCandles: () => Promise.reject(new MarketDataError('RATE_LIMIT', 'primary', 'rate limited')),
    });
    const fallback = createMockProvider('fallback', {
      getCandles: () => Promise.resolve([{ timestamp: '', open: 2, high: 2, low: 2, close: 2, volume: null }]),
    });

    const provider = new FallbackProvider([primary, fallback]);
    const candles = await provider.getCandles('EUR/USD', '1H');

    expect(candles).toHaveLength(1);
    expect(candles[0].open).toBe(2);
    expect(primary.getCandles).toHaveBeenCalledTimes(1);
    expect(fallback.getCandles).toHaveBeenCalledTimes(1);
  });

  it('does not retry on non-retryable errors', async () => {
    const primary = createMockProvider('primary', {
      getCandles: () => Promise.reject(new MarketDataError('UNSUPPORTED_SYMBOL', 'primary', 'nope')),
    });
    const fallback = createMockProvider('fallback', {
      getCandles: () => Promise.resolve([{ timestamp: '', open: 3, high: 3, low: 3, close: 3, volume: null }]),
    });

    const provider = new FallbackProvider([primary, fallback]);

    await expect(provider.getCandles('EUR/USD', '1H')).rejects.toMatchObject({
      kind: 'UNSUPPORTED_SYMBOL',
    });
    expect(fallback.getCandles).not.toHaveBeenCalled();
  });

  it('throws when all providers fail', async () => {
    const primary = createMockProvider('primary', {
      getCandles: () => Promise.reject(new MarketDataError('NETWORK_ERROR', 'primary', 'network down')),
    });
    const fallback = createMockProvider('fallback', {
      getCandles: () => Promise.reject(new MarketDataError('RATE_LIMIT', 'fallback', 'also rate limited')),
    });

    const provider = new FallbackProvider([primary, fallback]);

    await expect(provider.getCandles('EUR/USD', '1H')).rejects.toMatchObject({
      kind: 'RATE_LIMIT',
    });
  });

  it('returns union of supported symbols and timeframes', () => {
    const primary = createMockProvider('primary', {
      getSupportedSymbols: () => ['EUR/USD', 'GBP/USD'],
      getSupportedTimeframes: () => ['1H', '4H'],
    });
    const fallback = createMockProvider('fallback', {
      getSupportedSymbols: () => ['EUR/USD', 'USD/JPY'],
      getSupportedTimeframes: () => ['1H', '1D'],
    });

    const provider = new FallbackProvider([primary, fallback]);

    expect(provider.getSupportedSymbols()).toEqual(['EUR/USD', 'GBP/USD', 'USD/JPY']);
    expect(provider.getSupportedTimeframes()).toEqual(['1H', '4H', '1D']);
  });

  it('skips providers that do not support forex for forex symbols', async () => {
    const primary = createMockProvider('primary', {
      supportsForex: false,
      getCandles: () => Promise.resolve([{ timestamp: '', open: 1, high: 1, low: 1, close: 1, volume: null }]),
    });
    const fallback = createMockProvider('fallback', {
      getCandles: () => Promise.resolve([{ timestamp: '', open: 2, high: 2, low: 2, close: 2, volume: null }]),
    });

    const provider = new FallbackProvider([primary, fallback]);
    const candles = await provider.getCandles('EUR/USD', '1H');

    expect(candles).toHaveLength(1);
    expect(candles[0].open).toBe(2);
    expect(primary.getCandles).not.toHaveBeenCalled();
    expect(fallback.getCandles).toHaveBeenCalledTimes(1);
  });

  it('uses non-forex provider for non-forex symbols', async () => {
    const primary = createMockProvider('primary', {
      supportsForex: false,
      getCandles: () => Promise.resolve([{ timestamp: '', open: 1, high: 1, low: 1, close: 1, volume: null }]),
    });
    const fallback = createMockProvider('fallback', {
      getCandles: () => Promise.resolve([{ timestamp: '', open: 2, high: 2, low: 2, close: 2, volume: null }]),
    });

    const provider = new FallbackProvider([primary, fallback]);
    const candles = await provider.getCandles('XAU/USD', '1H');

    expect(candles).toHaveLength(1);
    expect(candles[0].open).toBe(1);
    expect(primary.getCandles).toHaveBeenCalledTimes(1);
    expect(fallback.getCandles).not.toHaveBeenCalled();
  });
});
