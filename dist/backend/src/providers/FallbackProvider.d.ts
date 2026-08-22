import { Candle, Quote } from '../../../shared/types/market';
import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { MarketDataProvider } from './MarketDataProvider';
export declare class FallbackProvider implements MarketDataProvider {
    readonly name = "fallback";
    private readonly providers;
    constructor(providers: MarketDataProvider[]);
    getSupportedSymbols(): Symbol[];
    getSupportedTimeframes(): Timeframe[];
    readonly supportsForex = true;
    getQuote(symbol: Symbol): Promise<Quote>;
    getCandles(symbol: Symbol, timeframe: Timeframe, limit?: number): Promise<Candle[]>;
    getHistoricalData(symbol: Symbol, timeframe: Timeframe, from: Date, to: Date): Promise<Candle[]>;
    private executeWithFallback;
    private isRetryable;
}
