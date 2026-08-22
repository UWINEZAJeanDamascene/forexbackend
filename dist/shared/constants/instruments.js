"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIMEFRAME_MINUTES = exports.ENABLED_TIMEFRAMES = exports.ALL_TIMEFRAMES = exports.ENABLED_SYMBOLS = exports.ALL_SYMBOLS = void 0;
exports.timeframeToMs = timeframeToMs;
exports.isForexSymbol = isForexSymbol;
/**
 * Full instrument universe from the project spec. Not all are enabled yet —
 * see ENABLED_SYMBOLS for what Phase 3 onward will actually wire up.
 */
exports.ALL_SYMBOLS = [
    'EUR/USD',
    'GBP/USD',
    'USD/JPY',
    'GBP/JPY',
    'EUR/JPY',
    'USD/CHF',
    'AUD/USD',
    'USD/CAD',
    'NZD/USD',
    'XAU/USD',
];
/** All spec instruments are enabled. */
exports.ENABLED_SYMBOLS = [...exports.ALL_SYMBOLS];
exports.ALL_TIMEFRAMES = ['5m', '15m', '30m', '1H', '4H', '1D'];
/** Spec says: start with 1H and 4H only. Now extended to include 5m, 15m, 30m. */
exports.ENABLED_TIMEFRAMES = ['5m', '15m', '30m', '1H', '4H', '1D'];
/** Duration of one candle for each timeframe, in minutes. */
exports.TIMEFRAME_MINUTES = {
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1H': 60,
    '4H': 240,
    '1D': 1440,
};
function timeframeToMs(timeframe) {
    return exports.TIMEFRAME_MINUTES[timeframe] * 60 * 1000;
}
function isForexSymbol(symbol) {
    return symbol !== 'XAU/USD';
}
//# sourceMappingURL=instruments.js.map