"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toIsoTimestamp = toIsoTimestamp;
exports.normalizeTwelveDataCandle = normalizeTwelveDataCandle;
exports.normalizeTwelveDataTimeSeries = normalizeTwelveDataTimeSeries;
exports.normalizeTwelveDataQuote = normalizeTwelveDataQuote;
const MarketDataProvider_1 = require("../MarketDataProvider");
/** Converts a Twelve Data "YYYY-MM-DD HH:mm:ss" (or date-only) string to ISO-8601 UTC. */
function toIsoTimestamp(rawDatetime) {
    // Twelve Data returns times in the exchange's local time without a zone
    // suffix, but for FX/spot instruments this is effectively UTC. We treat
    // it as UTC by appending "Z" once normalized to the "T" separator form.
    const normalized = rawDatetime.includes('T') ? rawDatetime : rawDatetime.replace(' ', 'T');
    const withZone = normalized.endsWith('Z') ? normalized : `${normalized}Z`;
    const date = new Date(withZone);
    if (Number.isNaN(date.getTime())) {
        throw new MarketDataProvider_1.MarketDataError('INVALID_RESPONSE', 'twelvedata', `Could not parse timestamp "${rawDatetime}" from Twelve Data response.`);
    }
    return date.toISOString();
}
function toFiniteNumber(value, field) {
    if (value === undefined) {
        throw new MarketDataProvider_1.MarketDataError('INVALID_RESPONSE', 'twelvedata', `Missing required field "${field}" in Twelve Data candle.`);
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
        throw new MarketDataProvider_1.MarketDataError('INVALID_RESPONSE', 'twelvedata', `Field "${field}" was not a finite number: "${value}".`);
    }
    return num;
}
/**
 * Normalizes a single raw Twelve Data candle into our Candle shape.
 * Does NOT validate OHLC relationships (high >= low, etc.) - that's the
 * job of the data-validation layer in Phase 4, which runs after
 * normalization so it works the same regardless of provider.
 */
function normalizeTwelveDataCandle(raw) {
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
function normalizeTwelveDataTimeSeries(response) {
    if (response.status === 'error') {
        throw new MarketDataProvider_1.MarketDataError('PROVIDER_ERROR', 'twelvedata', response.message || `Twelve Data returned an error (code ${response.code ?? 'unknown'}).`);
    }
    if (!response.values || !Array.isArray(response.values)) {
        throw new MarketDataProvider_1.MarketDataError('INVALID_RESPONSE', 'twelvedata', 'Twelve Data response did not contain a "values" array.');
    }
    const candles = response.values.map(normalizeTwelveDataCandle);
    // Twelve Data returns newest-first; reverse to oldest-first (newest last).
    return candles.reverse();
}
/** Normalizes a Twelve Data quote/price response into our Quote shape. */
function normalizeTwelveDataQuote(response, requestedSymbol) {
    if (response.status === 'error') {
        throw new MarketDataProvider_1.MarketDataError('PROVIDER_ERROR', 'twelvedata', response.message || `Twelve Data returned an error (code ${response.code ?? 'unknown'}).`);
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
//# sourceMappingURL=normalize.js.map