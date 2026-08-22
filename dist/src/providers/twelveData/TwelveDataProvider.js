"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwelveDataProvider = void 0;
const instruments_1 = require("../../../../shared/constants/instruments");
const MarketDataProvider_1 = require("../MarketDataProvider");
const timeframeMap_1 = require("./timeframeMap");
const normalize_1 = require("./normalize");
const TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';
const DEFAULT_CANDLE_LIMIT = 200;
class TwelveDataProvider {
    name = 'twelvedata';
    supportsForex = true;
    apiKey;
    baseUrl;
    fetchImpl;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.baseUrl = options.baseUrl || TWELVE_DATA_BASE_URL;
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
        const url = this.buildUrl('/price', { symbol });
        const response = await this.request(url);
        return (0, normalize_1.normalizeTwelveDataQuote)(response, symbol);
    }
    async getCandles(symbol, timeframe, limit = DEFAULT_CANDLE_LIMIT) {
        this.assertSupportedSymbol(symbol);
        const interval = (0, timeframeMap_1.toTwelveDataInterval)(timeframe);
        const url = this.buildUrl('/time_series', {
            symbol,
            interval,
            outputsize: String(limit),
        });
        const response = await this.request(url);
        return (0, normalize_1.normalizeTwelveDataTimeSeries)(response);
    }
    async getHistoricalData(symbol, timeframe, from, to) {
        this.assertSupportedSymbol(symbol);
        const interval = (0, timeframeMap_1.toTwelveDataInterval)(timeframe);
        const url = this.buildUrl('/time_series', {
            symbol,
            interval,
            start_date: from.toISOString().slice(0, 19).replace('T', ' '),
            end_date: to.toISOString().slice(0, 19).replace('T', ' '),
        });
        const response = await this.request(url);
        return (0, normalize_1.normalizeTwelveDataTimeSeries)(response);
    }
    assertSupportedSymbol(symbol) {
        if (!instruments_1.ALL_SYMBOLS.includes(symbol)) {
            throw new MarketDataProvider_1.MarketDataError('UNSUPPORTED_SYMBOL', this.name, `Symbol "${symbol}" is not in the supported symbol list.`);
        }
    }
    buildUrl(path, params) {
        if (!this.apiKey) {
            throw new MarketDataProvider_1.MarketDataError('CONFIG_ERROR', this.name, 'TWELVE_DATA_API_KEY is not set. Add it to your .env file before requesting market data.');
        }
        const url = new URL(path, this.baseUrl);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
        url.searchParams.set('apikey', this.apiKey);
        return url.toString();
    }
    async request(url) {
        let response;
        try {
            response = await this.fetchImpl(url);
        }
        catch (err) {
            throw new MarketDataProvider_1.MarketDataError('NETWORK_ERROR', this.name, `Network request to Twelve Data failed: ${err.message}`);
        }
        if (response.status === 429) {
            throw new MarketDataProvider_1.MarketDataError('RATE_LIMIT', this.name, 'Twelve Data rate limit exceeded.');
        }
        if (!response.ok) {
            throw new MarketDataProvider_1.MarketDataError('PROVIDER_ERROR', this.name, `Twelve Data responded with HTTP ${response.status}.`);
        }
        let body;
        try {
            body = await response.json();
        }
        catch (err) {
            throw new MarketDataProvider_1.MarketDataError('INVALID_RESPONSE', this.name, `Twelve Data response was not valid JSON: ${err.message}`);
        }
        return body;
    }
}
exports.TwelveDataProvider = TwelveDataProvider;
//# sourceMappingURL=TwelveDataProvider.js.map