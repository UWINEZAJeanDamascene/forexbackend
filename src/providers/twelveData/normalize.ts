import { Candle, Quote } from '../../../../shared/types/market';
import { MarketDataError } from '../MarketDataProvider';

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
export function toIsoTimestamp(rawDatetime: string): string {
  // Twelve Data returns times in the exchange's local time without a zone
  // suffix, but for FX/spot instruments this is effectively UTC. We treat
  // it as UTC by appending "Z" once normalized to the "T" separator form.
  const normalized = rawDatetime.includes('T') ? rawDatetime : rawDatetime.replace(' ', 'T');
  const withZone = normalized.endsWith('Z') ? normalized : `${normalized}Z`;
  const date = new Date(withZone);

  if (Number.isNaN(date.getTime())) {
    throw new MarketDataError(
      'INVALID_RESPONSE',
      'twelvedata',
      `Could not parse timestamp "${rawDatetime}" from Twelve Data response.`
    );
  }

  return date.toISOString();
}

function toFiniteNumber(value: string | undefined, field: string): number {
  if (value === undefined) {
    throw new MarketDataError(
      'INVALID_RESPONSE',
      'twelvedata',
      `Missing required field "${field}" in Twelve Data candle.`
    );
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new MarketDataError(
      'INVALID_RESPONSE',
      'twelvedata',
      `Field "${field}" was not a finite number: "${value}".`
    );
  }
  return num;
}

/**
 * Normalizes a single raw Twelve Data candle into our Candle shape.
 * Does NOT validate OHLC relationships (high >= low, etc.) - that's the
 * job of the data-validation layer in Phase 4, which runs after
 * normalization so it works the same regardless of provider.
 */
export function normalizeTwelveDataCandle(raw: RawTwelveDataCandle): Candle {
  return {
    timestamp: toIsoTimestamp(raw.datetime),
    open: toFiniteNumber(raw.open, 'open'),
    high: toFiniteNumber(raw.high, 'high'),
    low: toFiniteNumber(raw.low, 'low'),
    close: toFiniteNumber(raw.close, 'close'),
    volume: raw.volume !== undefined && raw.volume !== '' ? Number(raw.volume) || null : null,
  };
}

/**
 * Normalizes a full Twelve Data time_series response into an array of our
 * Candle shape, oldest-to-newest (Twelve Data returns newest-first, so we
 * reverse it to match our documented "newest last" contract).
 */
export function normalizeTwelveDataTimeSeries(response: RawTwelveDataTimeSeriesResponse): Candle[] {
  if (response.status === 'error') {
    throw new MarketDataError(
      'PROVIDER_ERROR',
      'twelvedata',
      response.message || `Twelve Data returned an error (code ${response.code ?? 'unknown'}).`
    );
  }

  if (!response.values || !Array.isArray(response.values)) {
    throw new MarketDataError(
      'INVALID_RESPONSE',
      'twelvedata',
      'Twelve Data response did not contain a "values" array.'
    );
  }

  const candles = response.values.map(normalizeTwelveDataCandle);
  // Twelve Data returns newest-first; reverse to oldest-first (newest last).
  return candles.reverse();
}

/** Normalizes a Twelve Data quote/price response into our Quote shape. */
export function normalizeTwelveDataQuote(
  response: RawTwelveDataQuoteResponse,
  requestedSymbol: string
): Quote {
  if (response.status === 'error') {
    throw new MarketDataError(
      'PROVIDER_ERROR',
      'twelvedata',
      response.message || `Twelve Data returned an error (code ${response.code ?? 'unknown'}).`
    );
  }

  const priceRaw = response.close ?? response.price;
  const price = toFiniteNumber(priceRaw, 'price');

  const timestamp = response.datetime
    ? toIsoTimestamp(response.datetime)
    : response.timestamp
      ? new Date(response.timestamp * 1000).toISOString()
      : new Date().toISOString();

  return {
    symbol: response.symbol || requestedSymbol,
    price,
    timestamp,
  };
}

export type {
  RawTwelveDataCandle,
  RawTwelveDataTimeSeriesResponse,
  RawTwelveDataQuoteResponse,
};
