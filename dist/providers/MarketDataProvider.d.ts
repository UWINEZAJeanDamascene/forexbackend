import { Candle, Quote } from '../../../shared/types/market';
import { Symbol, Timeframe } from '../../../shared/constants/instruments';
/**
 * Every market-data provider (Twelve Data today, others later) implements
 * this interface. Nothing outside the /providers directory should ever
 * import a concrete provider class directly - go through
 * getMarketDataProvider() in providers/index.ts instead, so the rest of the
 * app never depends on a specific vendor's request/response format.
 */
export interface MarketDataProvider {
    /** Human-readable name for logging/debugging, e.g. "twelvedata". */
    readonly name: string;
    getQuote(symbol: Symbol): Promise<Quote>;
    /**
     * Most recent `limit` candles for a symbol/timeframe, newest last.
     */
    getCandles(symbol: Symbol, timeframe: Timeframe, limit?: number): Promise<Candle[]>;
    /**
     * Candles between two dates (inclusive), newest last. Used for
     * backtesting (Phase 20) and deeper historical analysis.
     */
    getHistoricalData(symbol: Symbol, timeframe: Timeframe, from: Date, to: Date): Promise<Candle[]>;
    getSupportedSymbols(): Symbol[];
    getSupportedTimeframes(): Timeframe[];
}
/**
 * Normalized error type so callers never need to know whether a failure
 * came from a network error, an invalid API key, a rate limit, or a
 * malformed response - they just get a consistent shape with a `kind`
 * they can branch on.
 */
export type MarketDataErrorKind = 'CONFIG_ERROR' | 'NETWORK_ERROR' | 'RATE_LIMIT' | 'INVALID_RESPONSE' | 'UNSUPPORTED_SYMBOL' | 'UNSUPPORTED_TIMEFRAME' | 'PROVIDER_ERROR';
export declare class MarketDataError extends Error {
    readonly kind: MarketDataErrorKind;
    readonly provider: string;
    constructor(kind: MarketDataErrorKind, provider: string, message: string);
}
