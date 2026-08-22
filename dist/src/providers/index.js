"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketDataError = void 0;
exports.getMarketDataProvider = getMarketDataProvider;
exports._resetMarketDataProviderForTests = _resetMarketDataProviderForTests;
const env_1 = require("../config/env");
const TwelveDataProvider_1 = require("./twelveData/TwelveDataProvider");
const FinnhubProvider_1 = require("./finnhub/FinnhubProvider");
const FallbackProvider_1 = require("./FallbackProvider");
let cachedProvider;
function buildProviders() {
    const providers = [];
    if (env_1.env.twelveDataApiKey) {
        providers.push(new TwelveDataProvider_1.TwelveDataProvider({ apiKey: env_1.env.twelveDataApiKey }));
    }
    if (env_1.env.finnhubApiKey) {
        providers.push(new FinnhubProvider_1.FinnhubProvider({ apiKey: env_1.env.finnhubApiKey }));
    }
    if (providers.length === 0) {
        providers.push(new TwelveDataProvider_1.TwelveDataProvider({ apiKey: undefined }));
    }
    if (providers.length === 1) {
        return providers;
    }
    return [new FallbackProvider_1.FallbackProvider(providers)];
}
function getMarketDataProvider() {
    if (!cachedProvider) {
        cachedProvider = buildProviders()[0];
    }
    return cachedProvider;
}
/** Test-only escape hatch to reset the cached singleton between tests. */
function _resetMarketDataProviderForTests() {
    cachedProvider = undefined;
}
var MarketDataProvider_1 = require("./MarketDataProvider");
Object.defineProperty(exports, "MarketDataError", { enumerable: true, get: function () { return MarketDataProvider_1.MarketDataError; } });
//# sourceMappingURL=index.js.map