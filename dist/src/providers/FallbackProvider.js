"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FallbackProvider = void 0;
const MarketDataProvider_1 = require("./MarketDataProvider");
function isForexSymbol(symbol) {
    return symbol !== 'XAU/USD';
}
class FallbackProvider {
    name = 'fallback';
    providers;
    constructor(providers) {
        if (providers.length === 0) {
            throw new Error('FallbackProvider requires at least one provider.');
        }
        this.providers = providers;
    }
    getSupportedSymbols() {
        const symbolSet = new Set();
        for (const provider of this.providers) {
            for (const symbol of provider.getSupportedSymbols()) {
                symbolSet.add(symbol);
            }
        }
        return Array.from(symbolSet);
    }
    getSupportedTimeframes() {
        const timeframeSet = new Set();
        for (const provider of this.providers) {
            for (const timeframe of provider.getSupportedTimeframes()) {
                timeframeSet.add(timeframe);
            }
        }
        return Array.from(timeframeSet);
    }
    supportsForex = true;
    async getQuote(symbol) {
        return this.executeWithFallback((provider) => provider.getQuote(symbol), symbol);
    }
    async getCandles(symbol, timeframe, limit) {
        return this.executeWithFallback((provider) => provider.getCandles(symbol, timeframe, limit), symbol);
    }
    async getHistoricalData(symbol, timeframe, from, to) {
        return this.executeWithFallback((provider) => provider.getHistoricalData(symbol, timeframe, from, to), symbol);
    }
    async executeWithFallback(operation, symbol) {
        const errors = [];
        for (const provider of this.providers) {
            if (isForexSymbol(symbol) && provider.supportsForex === false) {
                continue;
            }
            try {
                return await operation(provider);
            }
            catch (error) {
                if (error instanceof MarketDataProvider_1.MarketDataError && this.isRetryable(error)) {
                    errors.push(error);
                    continue;
                }
                throw error;
            }
        }
        const lastError = errors[errors.length - 1];
        if (lastError) {
            throw lastError;
        }
        throw new MarketDataProvider_1.MarketDataError('PROVIDER_ERROR', this.name, 'All providers failed and no errors were captured.');
    }
    isRetryable(error) {
        switch (error.kind) {
            case 'RATE_LIMIT':
            case 'NETWORK_ERROR':
            case 'PROVIDER_ERROR':
            case 'CONFIG_ERROR':
                return true;
            case 'INVALID_RESPONSE':
            case 'UNSUPPORTED_SYMBOL':
            case 'UNSUPPORTED_TIMEFRAME':
            default:
                return false;
        }
    }
}
exports.FallbackProvider = FallbackProvider;
//# sourceMappingURL=FallbackProvider.js.map