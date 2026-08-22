/**
 * Our application's own normalized market-data shapes. Every market-data
 * provider (TwelveData, or any future provider) must convert its
 * provider-specific response into these shapes before returning data to the
 * rest of the app. Provider-specific field names/formats must never leak
 * past the provider layer.
 */
export interface Candle {
    /** ISO-8601 UTC timestamp, e.g. "2024-01-01T10:00:00Z" */
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    /** Not all providers/instruments report volume (e.g. spot forex). */
    volume: number | null;
}
export interface Quote {
    symbol: string;
    price: number;
    timestamp: string;
}
