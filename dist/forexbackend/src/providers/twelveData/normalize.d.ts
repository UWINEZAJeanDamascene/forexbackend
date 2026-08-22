import { Candle, Quote } from '../../../../shared/types/market';
/**
 * Shapes of the raw Twelve Data API responses we care about. These types
 * exist ONLY in this file (the provider boundary) - nothing outside
 * /providers/twelveData should ever see raw Twelve Data field names like
 * `datetime` or string-typed prices.
 */
interface RawTwelveDataCandle {
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
}
interface RawTwelveDataTimeSeriesResponse {
    meta?: {
        symbol: string;
        interval: string;
    };
    values?: RawTwelveDataCandle[];
    status?: 'ok' | 'error';
    code?: number;
    message?: string;
}
interface RawTwelveDataQuoteResponse {
    symbol?: string;
    close?: string;
    price?: string;
    datetime?: string;
    timestamp?: number;
    status?: 'ok' | 'error';
    code?: number;
    message?: string;
}
/** Converts a Twelve Data "YYYY-MM-DD HH:mm:ss" (or date-only) string to ISO-8601 UTC. */
export declare function toIsoTimestamp(rawDatetime: string): string;
/**
 * Normalizes a single raw Twelve Data candle into our Candle shape.
 * Does NOT validate OHLC relationships (high >= low, etc.) - that's the
 * job of the data-validation layer in Phase 4, which runs after
 * normalization so it works the same regardless of provider.
 */
export declare function normalizeTwelveDataCandle(raw: RawTwelveDataCandle): Candle;
/**
 * Normalizes a full Twelve Data time_series response into an array of our
 * Candle shape, oldest-to-newest (Twelve Data returns newest-first, so we
 * reverse it to match our documented "newest last" contract).
 */
export declare function normalizeTwelveDataTimeSeries(response: RawTwelveDataTimeSeriesResponse): Candle[];
/** Normalizes a Twelve Data quote/price response into our Quote shape. */
export declare function normalizeTwelveDataQuote(response: RawTwelveDataQuoteResponse, requestedSymbol: string): Quote;
export type { RawTwelveDataCandle, RawTwelveDataTimeSeriesResponse, RawTwelveDataQuoteResponse, };
