"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTwelveDataInterval = toTwelveDataInterval;
const MarketDataProvider_1 = require("../MarketDataProvider");
/**
 * Maps our internal Timeframe values to Twelve Data's `interval` query
 * parameter values. Keeping this mapping in one place means the rest of
 * the app never has to know Twelve Data's naming conventions.
 * Reference: https://twelvedata.com/docs#time-series
 */
const TIMEFRAME_TO_TWELVE_DATA_INTERVAL = {
    '5m': '5min',
    '15m': '15min',
    '30m': '30min',
    '1H': '1h',
    '4H': '4h',
    '1D': '1day',
};
function toTwelveDataInterval(timeframe) {
    const interval = TIMEFRAME_TO_TWELVE_DATA_INTERVAL[timeframe];
    if (!interval) {
        throw new MarketDataProvider_1.MarketDataError('UNSUPPORTED_TIMEFRAME', 'twelvedata', `Timeframe "${timeframe}" has no Twelve Data interval mapping.`);
    }
    return interval;
}
//# sourceMappingURL=timeframeMap.js.map