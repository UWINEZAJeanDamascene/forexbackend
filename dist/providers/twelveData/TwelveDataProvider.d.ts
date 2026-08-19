import { Candle, Quote } from '../../../../shared/types/market';
import { Symbol, Timeframe } from '../../../../shared/constants/instruments';
import { MarketDataProvider } from '../MarketDataProvider';
export interface TwelveDataProviderOptions {
    apiKey: string | undefined;
    baseUrl?: string;
    /** Injectable for testing - defaults to the global fetch. */
    fetchImpl?: typeof fetch;
}
export declare class TwelveDataProvider implements MarketDataProvider {
    readonly name = "twelvedata";
    private readonly apiKey;
    private readonly baseUrl;
    private readonly fetchImpl;
    constructor(options: TwelveDataProviderOptions);
    getSupportedSymbols(): Symbol[];
    getSupportedTimeframes(): Timeframe[];
    getQuote(symbol: Symbol): Promise<Quote>;
    getCandles(symbol: Symbol, timeframe: Timeframe, limit?: number): Promise<Candle[]>;
    getHistoricalData(symbol: Symbol, timeframe: Timeframe, from: Date, to: Date): Promise<Candle[]>;
    private assertSupportedSymbol;
    private buildUrl;
    private request;
}
