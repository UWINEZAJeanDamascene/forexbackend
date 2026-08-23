"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INSTRUMENT_CONFIG = void 0;
exports.getInstrumentConfig = getInstrumentConfig;
/**
 * Instrument-specific trading conventions.
 * Used by risk analysis for position sizing calculations.
 */
exports.INSTRUMENT_CONFIG = {
    'EUR/USD': { pipValue: 0.0001, lotSize: 100000, minStopDistancePips: 2, name: 'EUR/USD' },
    'GBP/USD': { pipValue: 0.0001, lotSize: 100000, minStopDistancePips: 2, name: 'GBP/USD' },
    'USD/JPY': { pipValue: 0.01, lotSize: 100000, minStopDistancePips: 1, name: 'USD/JPY' },
    'GBP/JPY': { pipValue: 0.01, lotSize: 100000, minStopDistancePips: 1, name: 'GBP/JPY' },
    'EUR/JPY': { pipValue: 0.01, lotSize: 100000, minStopDistancePips: 1, name: 'EUR/JPY' },
    'USD/CHF': { pipValue: 0.0001, lotSize: 100000, minStopDistancePips: 2, name: 'USD/CHF' },
    'AUD/USD': { pipValue: 0.0001, lotSize: 100000, minStopDistancePips: 2, name: 'AUD/USD' },
    'USD/CAD': { pipValue: 0.0001, lotSize: 100000, minStopDistancePips: 2, name: 'USD/CAD' },
    'NZD/USD': { pipValue: 0.0001, lotSize: 100000, minStopDistancePips: 2, name: 'NZD/USD' },
    'XAU/USD': { pipValue: 0.01, lotSize: 100, minStopDistancePips: 10, name: 'XAU/USD' },
};
function getInstrumentConfig(symbol) {
    return exports.INSTRUMENT_CONFIG[symbol] ?? { pipValue: 0.0001, lotSize: 100000, minStopDistancePips: 2, name: symbol };
}
//# sourceMappingURL=instrumentConfig.js.map