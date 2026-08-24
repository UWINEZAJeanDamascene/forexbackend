"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadHistoricalCandles = loadHistoricalCandles;
const providers_1 = require("../providers");
const validation_1 = require("../validation");
async function loadHistoricalCandles(symbol, timeframe, startDate, endDate, options = {}) {
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate >= endDate) {
        throw new Error('Historical candle range must contain valid dates with startDate before endDate.');
    }
    const provider = options.provider ?? (0, providers_1.getMarketDataProvider)();
    const rawCandles = await provider.getHistoricalData(symbol, timeframe, startDate, endDate);
    const invalidTimestamp = rawCandles.find((candle) => {
        const timestamp = new Date(candle.timestamp).getTime();
        return !Number.isFinite(timestamp) || timestamp < startDate.getTime() || timestamp > endDate.getTime();
    });
    if (invalidTimestamp) {
        throw new Error(`Historical provider returned candle ${invalidTimestamp.timestamp} outside the requested date range.`);
    }
    const validated = (0, validation_1.validateCandleSeries)(rawCandles, timeframe, {
        minCandles: options.minCandles,
        context: { symbol, timeframe },
    });
    const providerMetadata = provider.getLastFetchMetadata?.() ?? { provider: provider.name, fallbackUsed: false, failureKinds: [] };
    return {
        candles: validated.candles,
        issues: validated.issues,
        symbol,
        timeframe,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        provider: provider.name,
        fetchedAt: new Date().toISOString(),
        fallbackUsed: providerMetadata.fallbackUsed,
        fallbackFrom: providerMetadata.fallbackFrom,
        providerFailureKinds: providerMetadata.failureKinds ?? [],
    };
}
//# sourceMappingURL=historicalCandleService.js.map