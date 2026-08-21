import { describe, it, expect, vi } from 'vitest';
import { FinnhubProvider } from './FinnhubProvider';

function createMockFetch(responses: Map<string, { ok: boolean; status: number; json: () => Promise<unknown> }>): typeof fetch {
  return vi.fn(async (url: string) => {
    const urlStr = typeof url === 'string' ? url : url.url;
    const urlObj = new URL(urlStr);

    for (const [key, response] of responses) {
      const keyObj = new URL(key, 'http://localhost');
      if (urlObj.pathname === keyObj.pathname && urlObj.searchParams.get('symbol') === keyObj.searchParams.get('symbol') && urlObj.searchParams.get('resolution') === keyObj.searchParams.get('resolution')) {
        return response;
      }
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({}),
    };
  }) as unknown as typeof fetch;
}

describe('FinnhubProvider', () => {
  it('returns empty arrays when there are no candles', async () => {
    const provider = new FinnhubProvider({
      apiKey: 'test-key',
      fetchImpl: createMockFetch(
        new Map([
          [
            '/api/v1/forex/candle?symbol=OANDA:EUR_USD&resolution=60',
            {
              ok: true,
              status: 200,
              json: async () => ({ s: 'no_data', o: [], h: [], l: [], c: [], t: [], v: [] }),
            },
          ],
        ])
      ),
    });

    const candles = await provider.getCandles('EUR/USD', '1H', 100);
    expect(candles).toHaveLength(0);
  });

  it('normalizes candle response', async () => {
    const now = Math.floor(Date.now() / 1000);
    const provider = new FinnhubProvider({
      apiKey: 'test-key',
      fetchImpl: createMockFetch(
        new Map([
          [
            '/api/v1/forex/candle?symbol=OANDA:EUR_USD&resolution=60',
            {
              ok: true,
              status: 200,
              json: async () => ({
                s: 'ok',
                o: [1.1, 1.2],
                h: [1.15, 1.25],
                l: [1.05, 1.15],
                c: [1.12, 1.22],
                t: [now - 3600, now],
                v: [1000, 2000],
              }),
            },
          ],
        ])
      ),
    });

    const candles = await provider.getCandles('EUR/USD', '1H', 100);
    expect(candles).toHaveLength(2);
    expect(candles[0].open).toBe(1.1);
    expect(candles[0].high).toBe(1.15);
    expect(candles[0].low).toBe(1.05);
    expect(candles[0].close).toBe(1.12);
    expect(candles[0].volume).toBe(1000);
    expect(candles[1].timestamp).toBeDefined();
  });

  it('throws CONFIG_ERROR when API key is missing', async () => {
    const provider = new FinnhubProvider({ apiKey: undefined });

    await expect(provider.getCandles('EUR/USD', '1H')).rejects.toMatchObject({
      kind: 'CONFIG_ERROR',
      provider: 'finnhub',
    });
  });

  it('throws RATE_LIMIT on 429', async () => {
    const provider = new FinnhubProvider({
      apiKey: 'test-key',
      fetchImpl: createMockFetch(
        new Map([
          [
            '/api/v1/forex/candle?symbol=OANDA:EUR_USD&resolution=60',
            {
              ok: false,
              status: 429,
              json: async () => ({}),
            },
          ],
        ])
      ),
    });

    await expect(provider.getCandles('EUR/USD', '1H')).rejects.toMatchObject({
      kind: 'RATE_LIMIT',
      provider: 'finnhub',
    });
  });

  it('normalizes quote response', async () => {
    const provider = new FinnhubProvider({
      apiKey: 'test-key',
      fetchImpl: createMockFetch(
        new Map([
          [
            '/api/v1/quote?symbol=OANDA:EUR_USD',
            {
              ok: true,
              status: 200,
              json: async () => ({
                c: 1.1234,
                h: 1.125,
                l: 1.12,
                o: 1.122,
                pc: 1.12,
                t: Math.floor(Date.now() / 1000),
              }),
            },
          ],
        ])
      ),
    });

    const quote = await provider.getQuote('EUR/USD');
    expect(quote.symbol).toBe('EUR/USD');
    expect(quote.price).toBe(1.1234);
    expect(quote.timestamp).toBeDefined();
  });

  it('declares no forex support', () => {
    const provider = new FinnhubProvider({ apiKey: 'test-key' });
    expect(provider.supportsForex).toBe(false);
  });
});