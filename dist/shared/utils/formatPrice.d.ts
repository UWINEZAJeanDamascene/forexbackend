/**
 * Format a price for display according to instrument conventions.
 *
 * - Standard FX pairs (EUR/USD, GBP/USD, USD/CHF, AUD/USD, USD/CAD, NZD/USD): 5 decimal places
 * - JPY pairs (USD/JPY, EUR/JPY, GBP/JPY, etc.): 3 decimal places
 * - XAU/USD (gold): 2 decimal places
 * - Unknown symbols: 4 decimal places as a safe default
 */
export declare function formatPrice(price: number | null | undefined, symbol: string): string;
export declare function getPrecision(symbol: string): number;
export declare function lastValue(values: (number | null)[] | undefined | null): number | null;
export declare function fmt(value: number | null | undefined, digits?: number): string;
