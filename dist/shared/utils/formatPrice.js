"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPrice = formatPrice;
exports.getPrecision = getPrecision;
exports.lastValue = lastValue;
exports.fmt = fmt;
/**
 * Format a price for display according to instrument conventions.
 *
 * - Standard FX pairs: 5 decimal places
 * - JPY pairs: 3 decimal places
 * - XAU/USD (gold): 2 decimal places
 * - Unknown symbols: 4 decimal places as a safe default
 */
const STANDARD_FX_PRECISION = 5;
const JPY_PRECISION = 3;
const XAU_PRECISION = 2;
const DEFAULT_PRECISION = 4;
const STANDARD_FX_PAIRS = new Set([
    'EUR/USD',
    'GBP/USD',
    'USD/CHF',
    'AUD/USD',
    'USD/CAD',
    'NZD/USD',
]);
const JPY_PAIRS = new Set([
    'USD/JPY',
    'EUR/JPY',
    'GBP/JPY',
    'AUD/JPY',
    'NZD/JPY',
    'CAD/JPY',
    'CHF/JPY',
]);
function formatPrice(price, symbol) {
    if (price === null || price === undefined || Number.isNaN(price)) {
        return '—';
    }
    return price.toFixed(getPrecision(symbol));
}
function getPrecision(symbol) {
    if (symbol === 'XAU/USD') {
        return XAU_PRECISION;
    }
    if (JPY_PAIRS.has(symbol)) {
        return JPY_PRECISION;
    }
    if (STANDARD_FX_PAIRS.has(symbol)) {
        return STANDARD_FX_PRECISION;
    }
    return DEFAULT_PRECISION;
}
function lastValue(values) {
    if (!values) {
        return null;
    }
    for (let index = values.length - 1; index >= 0; index -= 1) {
        const value = values[index];
        if (value !== null && value !== undefined) {
            return value;
        }
    }
    return null;
}
function fmt(value, digits = 4) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return '—';
    }
    return value.toFixed(digits);
}
//# sourceMappingURL=formatPrice.js.map