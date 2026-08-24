import { Candle } from '../../../shared/types/market';
import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { MarketDataProvider } from '../providers/MarketDataProvider';
import { CandleSeriesValidationResult } from '../validation';
export interface LoadHistoricalCandlesOptions {
    provider?: MarketDataProvider;
    minCandles?: number;
}
export interface HistoricalCandleData {
    candles: Candle[];
    issues: CandleSeriesValidationResult<Candle>['issues'];
    symbol: Symbol;
    timeframe: Timeframe;
    startDate: string;
    endDate: string;
    provider: string;
    fetchedAt: string;
    fallbackUsed: boolean;
    fallbackFrom?: string;
    providerFailureKinds: string[];
}
export declare function loadHistoricalCandles(symbol: Symbol, timeframe: Timeframe, startDate: Date, endDate: Date, options?: LoadHistoricalCandlesOptions): Promise<HistoricalCandleData>;
