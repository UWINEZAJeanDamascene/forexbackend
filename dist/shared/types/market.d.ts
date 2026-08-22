/**
 * Normalized market-data shapes shared by the backend and frontend.
 */
export interface Candle {
    /** ISO-8601 UTC timestamp, e.g. "2024-01-01T10:00:00Z" */
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    /** Not all providers/instruments report volume. */
    volume: number | null;
}
export interface Quote {
    symbol: string;
    price: number;
    timestamp: string;
}
