import type { MarketDataProvider } from '../providers/MarketDataProvider';
import { Candle } from '../../../shared/types/market';
import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { CandleSeriesValidationResult } from '../validation';
export interface GetValidatedCandlesOptions {
    limit?: number;
    minCandles?: number;
    /**
     * Inject a provider for testing. Defaults to the real
     * getMarketDataProvider() singleton, imported lazily so this module can
     * be used/tested without pulling in env/dotenv unless it's actually
     * needed.
     */
    provider?: MarketDataProvider;
}
/**
 * The entry point the rest of the app (indicators, analysis, API routes)
 * should use to get candle data. Composes the provider layer (Phase 3) with
 * the validation layer (Phase 4): fetch -> validate -> return only clean,
 * usable candles. Nothing downstream of this should ever call a provider
 * directly.
 */
export declare function getValidatedCandles(symbol: Symbol, timeframe: Timeframe, options?: GetValidatedCandlesOptions): Promise<CandleSeriesValidationResult<Candle>>;
