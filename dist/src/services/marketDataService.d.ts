import type { MarketDataProvider } from '../providers/MarketDataProvider';
import { Candle } from '../../../shared/types/market';
import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { CandleSeriesValidationResult } from '../validation';
export declare function clearCandleCache(): void;
export interface GetValidatedCandlesOptions {
    limit?: number;
    minCandles?: number;
    provider?: MarketDataProvider;
}
export declare function getValidatedCandles(symbol: Symbol, timeframe: Timeframe, options?: GetValidatedCandlesOptions): Promise<CandleSeriesValidationResult<Candle>>;
