"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValidatedCandles = getValidatedCandles;
const validation_1 = require("../validation");
/**
 * The entry point the rest of the app (indicators, analysis, API routes)
 * should use to get candle data. Composes the provider layer (Phase 3) with
 * the validation layer (Phase 4): fetch -> validate -> return only clean,
 * usable candles. Nothing downstream of this should ever call a provider
 * directly.
 */
async function getValidatedCandles(symbol, timeframe, options = {}) {
    const provider = options.provider ?? (await loadDefaultProvider());
    const rawCandles = await provider.getCandles(symbol, timeframe, options.limit);
    return (0, validation_1.validateCandleSeries)(rawCandles, timeframe, {
        minCandles: options.minCandles,
        context: { symbol, timeframe },
    });
}
async function loadDefaultProvider() {
    const { getMarketDataProvider } = await Promise.resolve().then(() => __importStar(require('../providers')));
    return getMarketDataProvider();
}
//# sourceMappingURL=marketDataService.js.map