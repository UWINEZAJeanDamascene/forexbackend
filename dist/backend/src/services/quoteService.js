"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedQuote = getCachedQuote;
exports.clearQuoteCache = clearQuoteCache;
const providers_1 = require("../providers");
const QUOTE_CACHE_TTL_MS = 30_000;
const quoteCache = new Map();
async function getCachedQuote(symbol) {
    const cached = quoteCache.get(symbol);
    if (cached && cached.expiresAt > Date.now())
        return cached.quote;
    const quote = await (0, providers_1.getMarketDataProvider)().getQuote(symbol);
    quoteCache.set(symbol, { quote, expiresAt: Date.now() + QUOTE_CACHE_TTL_MS });
    return quote;
}
function clearQuoteCache() {
    quoteCache.clear();
}
//# sourceMappingURL=quoteService.js.map