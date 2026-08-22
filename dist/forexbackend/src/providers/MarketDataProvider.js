"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketDataError = void 0;
class MarketDataError extends Error {
    kind;
    provider;
    constructor(kind, provider, message) {
        super(message);
        this.name = 'MarketDataError';
        this.kind = kind;
        this.provider = provider;
    }
}
exports.MarketDataError = MarketDataError;
//# sourceMappingURL=MarketDataProvider.js.map