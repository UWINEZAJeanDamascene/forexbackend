import { describe, it, expect, vi } from 'vitest';
import { TwelveDataProvider } from './TwelveDataProvider';
import { MarketDataError } from '../MarketDataProvider';

function fakeFetchReturning(body: unknown, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('TwelveDataProvider', () => {
  it('throws CONFIG_ERROR when no API key is configured', async () => {
    const provider = new TwelveDataProvider({ apiKey: undefined });

    await expect(provider.getCandles('EUR/USD', '1H')).rejects.toMatchObject({
      kind: 'CONFIG_ERROR',
    });
  });

  it('builds the request URL with symbol, interval, and apikey', async () => {
    const fetchImpl = fakeFetchReturning({
      status: 'ok',
      values: [
        { datetime: '2024-01-01 10:00:00', open: '1.10', high: '1.11', low: '1.09', close: '1.105' },
      ],
    });
    const provider = new TwelveDataProvider({ apiKey: 'test-key', fetchImpl });

    await provider.getCandles('EUR/USD', '1H');

    const calledUrl = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/time_series');
    expect(calledUrl).toContain('symbol=EUR%2FUSD');
    expect(calledUrl).toContain('interval=1h');
    expect(calledUrl).toContain('apikey=test-key');
  });

  it('returns normalized candles, oldest first', async () => {
    const fetchImpl = fakeFetchReturning({
      status: 'ok',
      values: [
        { datetime: '2024-01-01 11:00:00', open: '1.10', high: '1.11', low: '1.09', close: '1.105' },
        { datetime: '2024-01-01 10:00:00', open: '1.09', high: '1.10', low: '1.08', close: '1.095' },
      ],
    });
    const provider = new TwelveDataProvider({ apiKey: 'test-key', fetchImpl });

    const candles = await provider.getCandles('EUR/USD', '1H');

    expect(candles).toHaveLength(2);
    expect(candles[0].timestamp < candles[1].timestamp).toBe(true);
  });

  it('throws RATE_LIMIT on HTTP 429', async () => {
    const fetchImpl = fakeFetchReturning({}, 429);
    const provider = new TwelveDataProvider({ apiKey: 'test-key', fetchImpl });

    await expect(provider.getCandles('EUR/USD', '1H')).rejects.toMatchObject({
      kind: 'RATE_LIMIT',
    });
  });

  it('throws PROVIDER_ERROR on a non-2xx, non-429 response', async () => {
    const fetchImpl = fakeFetchReturning({}, 500);
    const provider = new TwelveDataProvider({ apiKey: 'test-key', fetchImpl });

    await expect(provider.getCandles('EUR/USD', '1H')).rejects.toMatchObject({
      kind: 'PROVIDER_ERROR',
    });
  });

  it('throws NETWORK_ERROR when fetch itself rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;
    const provider = new TwelveDataProvider({ apiKey: 'test-key', fetchImpl });

    await expect(provider.getCandles('EUR/USD', '1H')).rejects.toMatchObject({
      kind: 'NETWORK_ERROR',
    });
  });

  it('rejects unsupported symbols before making a request', async () => {
    const fetchImpl = vi.fn();
    const provider = new TwelveDataProvider({ apiKey: 'test-key', fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(
      provider.getCandles('DOGE/USD' as unknown as Parameters<typeof provider.getCandles>[0], '1H')
    ).rejects.toMatchObject({ kind: 'UNSUPPORTED_SYMBOL' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('getSupportedSymbols/getSupportedTimeframes return the full provider capability lists', () => {
    const provider = new TwelveDataProvider({ apiKey: 'test-key' });
    expect(provider.getSupportedSymbols()).toContain('EUR/USD');
    expect(provider.getSupportedTimeframes()).toContain('4H');
  });

  it('getQuote normalizes a price response', async () => {
    const fetchImpl = fakeFetchReturning({ symbol: 'EUR/USD', price: '1.1050' });
    const provider = new TwelveDataProvider({ apiKey: 'test-key', fetchImpl });

    const quote = await provider.getQuote('EUR/USD');
    expect(quote.symbol).toBe('EUR/USD');
    expect(quote.price).toBe(1.105);
  });
});
