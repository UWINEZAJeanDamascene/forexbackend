import { Candle, Quote } from '../../../../shared/types/market';
import {
  ALL_SYMBOLS,
  ALL_TIMEFRAMES,
  Symbol,
  Timeframe,
} from '../../../../shared/constants/instruments';
import { MarketDataError, MarketDataProvider } from '../MarketDataProvider';
import { toTwelveDataInterval } from './timeframeMap';
import {
  normalizeTwelveDataQuote,
  normalizeTwelveDataTimeSeries,
  RawTwelveDataQuoteResponse,
  RawTwelveDataTimeSeriesResponse,
} from './normalize';

const TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';
const DEFAULT_CANDLE_LIMIT = 200;

export interface TwelveDataProviderOptions {
  apiKey: string | undefined;
  baseUrl?: string;
  /** Injectable for testing - defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export class TwelveDataProvider implements MarketDataProvider {
  readonly name = 'twelvedata';

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TwelveDataProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || TWELVE_DATA_BASE_URL;
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

    const url = this.buildUrl('/price', { symbol });
    const response = await this.request<RawTwelveDataQuoteResponse>(url);
    return normalizeTwelveDataQuote(response, symbol);
  }

  async getCandles(
    symbol: Symbol,
    timeframe: Timeframe,
    limit: number = DEFAULT_CANDLE_LIMIT
  ): Promise<Candle[]> {
    this.assertSupportedSymbol(symbol);
    const interval = toTwelveDataInterval(timeframe);

    const url = this.buildUrl('/time_series', {
      symbol,
      interval,
      outputsize: String(limit),
    });

    const response = await this.request<RawTwelveDataTimeSeriesResponse>(url);
    return normalizeTwelveDataTimeSeries(response);
  }

  async getHistoricalData(
    symbol: Symbol,
    timeframe: Timeframe,
    from: Date,
    to: Date
  ): Promise<Candle[]> {
    this.assertSupportedSymbol(symbol);
    const interval = toTwelveDataInterval(timeframe);

    const url = this.buildUrl('/time_series', {
      symbol,
      interval,
      start_date: from.toISOString().slice(0, 19).replace('T', ' '),
      end_date: to.toISOString().slice(0, 19).replace('T', ' '),
    });

    const response = await this.request<RawTwelveDataTimeSeriesResponse>(url);
    return normalizeTwelveDataTimeSeries(response);
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

  private buildUrl(path: string, params: Record<string, string>): string {
    if (!this.apiKey) {
      throw new MarketDataError(
        'CONFIG_ERROR',
        this.name,
        'TWELVE_DATA_API_KEY is not set. Add it to your .env file before requesting market data.'
      );
    }

    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set('apikey', this.apiKey);
    return url.toString();
  }

  private async request<T>(url: string): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(url);
    } catch (err) {
      throw new MarketDataError(
        'NETWORK_ERROR',
        this.name,
        `Network request to Twelve Data failed: ${(err as Error).message}`
      );
    }

    if (response.status === 429) {
      throw new MarketDataError('RATE_LIMIT', this.name, 'Twelve Data rate limit exceeded.');
    }

    if (!response.ok) {
      throw new MarketDataError(
        'PROVIDER_ERROR',
        this.name,
        `Twelve Data responded with HTTP ${response.status}.`
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (err) {
      throw new MarketDataError(
        'INVALID_RESPONSE',
        this.name,
        `Twelve Data response was not valid JSON: ${(err as Error).message}`
      );
    }

    return body as T;
  }
}
