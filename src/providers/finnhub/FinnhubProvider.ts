import { Candle, Quote } from '../../../../shared/types/market';
import {
  ALL_SYMBOLS,
  ALL_TIMEFRAMES,
  Symbol,
  Timeframe,
  TIMEFRAME_MINUTES,
} from '../../../../shared/constants/instruments';
import { MarketDataError, MarketDataProvider } from '../MarketDataProvider';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const DEFAULT_CANDLE_LIMIT = 200;

export interface FinnhubProviderOptions {
  apiKey: string | undefined;
  baseUrl?: string;
  /** Injectable for testing - defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

const TIMEFRAME_TO_FINNHUB_RESOLUTION: Record<Timeframe, string> = {
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1H': '60',
  '4H': '240',
  '1D': 'D',
};

function toFinnhubResolution(timeframe: Timeframe): string {
  const resolution = TIMEFRAME_TO_FINNHUB_RESOLUTION[timeframe];
  if (!resolution) {
    throw new MarketDataError(
      'UNSUPPORTED_TIMEFRAME',
      'finnhub',
      `Timeframe "${timeframe}" has no Finnhub resolution mapping.`
    );
  }
  return resolution;
}

function toFinnhubSymbol(symbol: Symbol): string {
  return `OANDA:${symbol.replace('/', '_')}`;
}

function toFinnhubQuoteSymbol(symbol: Symbol): string {
  return `OANDA:${symbol.replace('/', '_')}`;
}

export class FinnhubProvider implements MarketDataProvider {
  readonly name = 'finnhub';
  readonly supportsForex = false;

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: FinnhubProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || FINNHUB_BASE_URL;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  getSupportedSymbols(): Symbol[] {
    return [...ALL_SYMBOLS];
  }

  getSupportedTimeframes(): Timeframe[] {
    return [...ALL_TIMEFRAMES];
  }

  async getQuote(symbol: Symbol): Promise<Quote> {
    this.assertSupportedSymbol(symbol);
    const finnhubSymbol = toFinnhubQuoteSymbol(symbol);

    const url = `${this.baseUrl}/quote?symbol=${encodeURIComponent(finnhubSymbol)}&token=${encodeURIComponent(this.assertApiKey())}`;

    const response = await this.request<FinnhubQuoteResponse>(url);

    return {
      symbol,
      price: response.c,
      timestamp: new Date(response.t * 1000).toISOString(),
    };
  }

  async getCandles(
    symbol: Symbol,
    timeframe: Timeframe,
    limit: number = DEFAULT_CANDLE_LIMIT
  ): Promise<Candle[]> {
    this.assertSupportedSymbol(symbol);
    this.assertSupportedTimeframe(timeframe);

    const finnhubSymbol = toFinnhubSymbol(symbol);
    const resolution = toFinnhubResolution(timeframe);

    const now = Math.floor(Date.now() / 1000);
    const timeframeMinutes = TIMEFRAME_MINUTES[timeframe];
    const from = now - limit * timeframeMinutes * 60;

    const url = `${this.baseUrl}/forex/candle?symbol=${encodeURIComponent(finnhubSymbol)}&resolution=${encodeURIComponent(resolution)}&from=${from}&to=${now}&token=${encodeURIComponent(this.assertApiKey())}`;

    const response = await this.request<FinnhubCandleResponse>(url);

    if (!response.o?.length || response.o.length === 0) {
      return [];
    }

    return normalizeFinnhubCandles(response, symbol);
  }

  async getHistoricalData(
    symbol: Symbol,
    timeframe: Timeframe,
    from: Date,
    to: Date
  ): Promise<Candle[]> {
    this.assertSupportedSymbol(symbol);
    this.assertSupportedTimeframe(timeframe);

    const finnhubSymbol = toFinnhubSymbol(symbol);
    const resolution = toFinnhubResolution(timeframe);

    const fromTimestamp = Math.floor(from.getTime() / 1000);
    const toTimestamp = Math.floor(to.getTime() / 1000);

    const url = `${this.baseUrl}/forex/candle?symbol=${encodeURIComponent(finnhubSymbol)}&resolution=${encodeURIComponent(resolution)}&from=${fromTimestamp}&to=${toTimestamp}&token=${encodeURIComponent(this.assertApiKey())}`;

    const response = await this.request<FinnhubCandleResponse>(url);

    if (!response.o?.length || response.o.length === 0) {
      return [];
    }

    return normalizeFinnhubCandles(response, symbol);
  }

  private assertSupportedSymbol(symbol: Symbol): void {
    if (!ALL_SYMBOLS.includes(symbol)) {
      throw new MarketDataError(
        'UNSUPPORTED_SYMBOL',
        this.name,
        `Symbol "${symbol}" is not in the supported symbol list.`
      );
    }
  }

  private assertSupportedTimeframe(timeframe: Timeframe): void {
    if (!ALL_TIMEFRAMES.includes(timeframe)) {
      throw new MarketDataError(
        'UNSUPPORTED_TIMEFRAME',
        this.name,
        `Timeframe "${timeframe}" is not supported by Finnhub.`
      );
    }
  }

  private assertApiKey(): string {
    if (!this.apiKey) {
      throw new MarketDataError(
        'CONFIG_ERROR',
        this.name,
        'FINNHUB_API_KEY is not set. Add it to your .env file before requesting market data.'
      );
    }
    return this.apiKey;
  }

  private async request<T>(url: string): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(url);
    } catch (err) {
      throw new MarketDataError(
        'NETWORK_ERROR',
        this.name,
        `Network request to Finnhub failed: ${(err as Error).message}`
      );
    }

    if (response.status === 429) {
      throw new MarketDataError('RATE_LIMIT', this.name, 'Finnhub rate limit exceeded.');
    }

    if (!response.ok) {
      throw new MarketDataError(
        'PROVIDER_ERROR',
        this.name,
        `Finnhub responded with HTTP ${response.status}.`
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (err) {
      throw new MarketDataError(
        'INVALID_RESPONSE',
        this.name,
        `Finnhub response was not valid JSON: ${(err as Error).message}`
      );
    }

    return body as T;
  }
}

interface FinnhubCandleResponse {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  t: number[];
  v: number[];
  s: string;
}

interface FinnhubQuoteResponse {
  c: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

function normalizeFinnhubCandles(
  response: FinnhubCandleResponse,
  symbol: Symbol
): Candle[] {
  const { o, h, l, c, t, v } = response;
  const candles: Candle[] = [];

  for (let i = 0; i < o.length; i++) {
    candles.push({
      timestamp: new Date(t[i] * 1000).toISOString(),
      open: o[i],
      high: h[i],
      low: l[i],
      close: c[i],
      volume: v?.[i] ?? null,
      symbol,
    });
  }

  return candles;
}
