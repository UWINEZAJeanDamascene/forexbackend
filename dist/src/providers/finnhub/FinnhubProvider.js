"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinnhubProvider = void 0;
const instruments_1 = require("../../../../shared/constants/instruments");
const MarketDataProvider_1 = require("../MarketDataProvider");
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const DEFAULT_CANDLE_LIMIT = 200;
const TIMEFRAME_TO_FINNHUB_RESOLUTION = {
    '5m': '5',
    '15m': '15',
    '30m': '30',
    '1H': '60',
    '4H': '240',
    '1D': 'D',
};
function toFinnhubResolution(timeframe) {
    const resolution = TIMEFRAME_TO_FINNHUB_RESOLUTION[timeframe];
    if (!resolution) {
        throw new MarketDataProvider_1.MarketDataError('UNSUPPORTED_TIMEFRAME', 'finnhub', `Timeframe "${timeframe}" has no Finnhub resolution mapping.`);
    }
    return resolution;
}
function toFinnhubSymbol(symbol) {
    return `OANDA:${symbol.replace('/', '_')}`;
}
function toFinnhubQuoteSymbol(symbol) {
    return `OANDA:${symbol.replace('/', '_')}`;
}
class FinnhubProvider {
    name = 'finnhub';
    supportsForex = false;
    apiKey;
    baseUrl;
    fetchImpl;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.baseUrl = options.baseUrl || FINNHUB_BASE_URL;
        this.fetchImpl = options.fetchImpl || fetch;
    }
    getSupportedSymbols() {
        return [...instruments_1.ALL_SYMBOLS];
    }
    getSupportedTimeframes() {
        return [...instruments_1.ALL_TIMEFRAMES];
    }
    async getQuote(symbol) {
        this.assertSupportedSymbol(symbol);
        const finnhubSymbol = toFinnhubQuoteSymbol(symbol);
        const url = `${this.baseUrl}/quote?symbol=${encodeURIComponent(finnhubSymbol)}&token=${encodeURIComponent(this.assertApiKey())}`;
        const response = await this.request(url);
        return {
            symbol,
            price: response.c,
            timestamp: new Date(response.t * 1000).toISOString(),
        };
    }
    async getCandles(symbol, timeframe, limit = DEFAULT_CANDLE_LIMIT) {
        this.assertSupportedSymbol(symbol);
        this.assertSupportedTimeframe(timeframe);
        const finnhubSymbol = toFinnhubSymbol(symbol);
        const resolution = toFinnhubResolution(timeframe);
        const now = Math.floor(Date.now() / 1000);
        const timeframeMinutes = instruments_1.TIMEFRAME_MINUTES[timeframe];
        const from = now - limit * timeframeMinutes * 60;
        const url = `${this.baseUrl}/forex/candle?symbol=${encodeURIComponent(finnhubSymbol)}&resolution=${encodeURIComponent(resolution)}&from=${from}&to=${now}&token=${encodeURIComponent(this.assertApiKey())}`;
        const response = await this.request(url);
        if (!response.o?.length || response.o.length === 0) {
            return [];
        }
        return normalizeFinnhubCandles(response, symbol);
    }
    async getHistoricalData(symbol, timeframe, from, to) {
        this.assertSupportedSymbol(symbol);
        this.assertSupportedTimeframe(timeframe);
        const finnhubSymbol = toFinnhubSymbol(symbol);
        const resolution = toFinnhubResolution(timeframe);
        const fromTimestamp = Math.floor(from.getTime() / 1000);
        const toTimestamp = Math.floor(to.getTime() / 1000);
        const url = `${this.baseUrl}/forex/candle?symbol=${encodeURIComponent(finnhubSymbol)}&resolution=${encodeURIComponent(resolution)}&from=${fromTimestamp}&to=${toTimestamp}&token=${encodeURIComponent(this.assertApiKey())}`;
        const response = await this.request(url);
        if (!response.o?.length || response.o.length === 0) {
            return [];
        }
        return normalizeFinnhubCandles(response, symbol);
    }
    assertSupportedSymbol(symbol) {
        if (!instruments_1.ALL_SYMBOLS.includes(symbol)) {
            throw new MarketDataProvider_1.MarketDataError('UNSUPPORTED_SYMBOL', this.name, `Symbol "${symbol}" is not in the supported symbol list.`);
        }
    }
    assertSupportedTimeframe(timeframe) {
        if (!instruments_1.ALL_TIMEFRAMES.includes(timeframe)) {
            throw new MarketDataProvider_1.MarketDataError('UNSUPPORTED_TIMEFRAME', this.name, `Timeframe "${timeframe}" is not supported by Finnhub.`);
        }
    }
    assertApiKey() {
        if (!this.apiKey) {
            throw new MarketDataProvider_1.MarketDataError('CONFIG_ERROR', this.name, 'FINNHUB_API_KEY is not set. Add it to your .env file before requesting market data.');
        }
        return this.apiKey;
    }
    async request(url) {
        let response;
        try {
            response = await this.fetchImpl(url);
        }
        catch (err) {
            throw new MarketDataProvider_1.MarketDataError('NETWORK_ERROR', this.name, `Network request to Finnhub failed: ${err.message}`);
        }
        if (response.status === 429) {
            throw new MarketDataProvider_1.MarketDataError('RATE_LIMIT', this.name, 'Finnhub rate limit exceeded.');
        }
        if (!response.ok) {
            throw new MarketDataProvider_1.MarketDataError('PROVIDER_ERROR', this.name, `Finnhub responded with HTTP ${response.status}.`);
        }
        let body;
        try {
            body = await response.json();
        }
        catch (err) {
            throw new MarketDataProvider_1.MarketDataError('INVALID_RESPONSE', this.name, `Finnhub response was not valid JSON: ${err.message}`);
        }
        return body;
    }
}
exports.FinnhubProvider = FinnhubProvider;
function normalizeFinnhubCandles(response, symbol) {
    const { o, h, l, c, t, v } = response;
    const candles = [];
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
//# sourceMappingURL=FinnhubProvider.js.map