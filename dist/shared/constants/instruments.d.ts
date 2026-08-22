/**
 * Full instrument universe from the project spec. Not all are enabled yet —
 * see ENABLED_SYMBOLS for what Phase 3 onward will actually wire up.
 */
export declare const ALL_SYMBOLS: readonly ["EUR/USD", "GBP/USD", "USD/JPY", "GBP/JPY", "EUR/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD", "XAU/USD"];
export type Symbol = (typeof ALL_SYMBOLS)[number];
/** All spec instruments are enabled. */
export declare const ENABLED_SYMBOLS: Symbol[];
export declare const ALL_TIMEFRAMES: readonly ["5m", "15m", "30m", "1H", "4H", "1D"];
export type Timeframe = (typeof ALL_TIMEFRAMES)[number];
/** Spec says: start with 1H and 4H only. Now extended to include 5m, 15m, 30m. */
export declare const ENABLED_TIMEFRAMES: Timeframe[];
/** Duration of one candle for each timeframe, in minutes. */
export declare const TIMEFRAME_MINUTES: Record<Timeframe, number>;
export declare function timeframeToMs(timeframe: Timeframe): number;
export declare function isForexSymbol(symbol: Symbol): boolean;
