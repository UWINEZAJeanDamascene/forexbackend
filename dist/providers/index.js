"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketDataError = void 0;
exports.getMarketDataProvider = getMarketDataProvider;
exports._resetMarketDataProviderForTests = _resetMarketDataProviderForTests;
const env_1 = require("../config/env");
const TwelveDataProvider_1 = require("./twelveData/TwelveDataProvider");
let cachedProvider;
/**
 * The rest of the app should call this instead of importing a concrete
 * provider class. Swapping providers later means changing this function
 * only - no other file should import TwelveDataProvider directly.
 */
function getMarketDataProvider() {
    if (!cachedProvider) {
        cachedProvider = new TwelveDataProvider_1.TwelveDataProvider({ apiKey: env_1.env.twelveDataApiKey });
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