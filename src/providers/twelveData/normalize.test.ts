import { describe, it, expect } from 'vitest';
import {
  normalizeTwelveDataCandle,
  normalizeTwelveDataTimeSeries,
  normalizeTwelveDataQuote,
  toIsoTimestamp,
} from './normalize';
import { MarketDataError } from '../MarketDataProvider';

describe('toIsoTimestamp', () => {
  it('converts a Twelve Data "YYYY-MM-DD HH:mm:ss" string to ISO-8601 UTC', () => {
    expect(toIsoTimestamp('2024-01-01 10:00:00')).toBe('2024-01-01T10:00:00.000Z');
  });

  it('throws MarketDataError on an unparseable timestamp', () => {
    expect(() => toIsoTimestamp('not-a-date')).toThrow(MarketDataError);
  });
});

describe('normalizeTwelveDataCandle', () => {
  it('converts a raw candle into our Candle shape with numeric fields', () => {
    const candle = normalizeTwelveDataCandle({
      datetime: '2024-01-01 10:00:00',
      open: '1.1000',
      high: '1.1050',
      low: '1.0950',
      close: '1.1020',
      volume: '1500',
    });

    expect(candle).toEqual({
      timestamp: '2024-01-01T10:00:00.000Z',
      open: 1.1,
      high: 1.105,
      low: 1.095,
      close: 1.102,
      volume: 1500,
    });
  });

  it('sets volume to null when the provider omits it (typical for spot FX)', () => {
    const candle = normalizeTwelveDataCandle({
      datetime: '2024-01-01 10:00:00',
      open: '1.1000',
      high: '1.1050',
      low: '1.0950',
      close: '1.1020',
    });

    expect(candle.volume).toBeNull();
  });

  it('throws MarketDataError when a required price field is missing', () => {
    expect(() =>
      normalizeTwelveDataCandle({
        datetime: '2024-01-01 10:00:00',
        open: '1.1000',
        high: '1.1050',
        low: '1.0950',
        close: undefined as unknown as string,
      })
    ).toThrow(MarketDataError);
  });
});

describe('normalizeTwelveDataTimeSeries', () => {
  it('reverses Twelve Data newest-first order to our oldest-first contract', () => {
    const candles = normalizeTwelveDataTimeSeries({
      status: 'ok',
      values: [
        { datetime: '2024-01-01 11:00:00', open: '1.10', high: '1.11', low: '1.09', close: '1.105' },
        { datetime: '2024-01-01 10:00:00', open: '1.09', high: '1.10', low: '1.08', close: '1.095' },
      ],
    });

    expect(candles[0].timestamp).toBe('2024-01-01T10:00:00.000Z');
    expect(candles[1].timestamp).toBe('2024-01-01T11:00:00.000Z');
  });

  it('throws MarketDataError when Twelve Data reports an error status', () => {
    expect(() =>
      normalizeTwelveDataTimeSeries({
        status: 'error',
        code: 400,
        message: 'Invalid API key',
      })
    ).toThrow('Invalid API key');
  });

  it('throws MarketDataError when the "values" array is missing', () => {
    expect(() => normalizeTwelveDataTimeSeries({ status: 'ok' })).toThrow(MarketDataError);
  });
});

describe('normalizeTwelveDataQuote', () => {
  it('normalizes a quote response using the "price" field', () => {
    const quote = normalizeTwelveDataQuote(
      { symbol: 'EUR/USD', price: '1.1050', datetime: '2024-01-01 10:00:00' },
      'EUR/USD'
    );

    expect(quote).toEqual({
      symbol: 'EUR/USD',
      price: 1.105,
      timestamp: '2024-01-01T10:00:00.000Z',
    });
  });

  it('falls back to the requested symbol if the response omits it', () => {
    const quote = normalizeTwelveDataQuote({ price: '1.1050' }, 'EUR/USD');
    expect(quote.symbol).toBe('EUR/USD');
  });
});
