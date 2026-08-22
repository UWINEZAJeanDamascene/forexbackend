import type { MarketDataProvider } from '../providers/MarketDataProvider';
import { Candle } from '../../../shared/types/market';
import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { CandleSeriesValidationResult } from '../validation';
export declare const DEFAULT_ANALYSIS_CANDLE_LIMIT = 500;
export declare function clearCandleCache(): void;
export interface GetValidatedCandlesOptions {
    limit?: number;
    minCandles?: number;
    provider?: MarketDataProvider;
}
export interface ValidatedMarketData {
    candles: Candle[];
    analysisCandles: Candle[];
    issues: CandleSeriesValidationResult<Candle>['issues'];
    source: string;
    fetchedAt: string;
    provider: string;
    fallbackUsed: boolean;
    fallbackFrom?: string;
    providerFailureKinds: string[];
}
export declare function getValidatedCandles(symbol: Symbol, timeframe: Timeframe, options?: GetValidatedCandlesOptions): Promise<ValidatedMarketData>;
