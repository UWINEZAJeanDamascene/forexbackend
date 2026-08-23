import { Candle } from '../../../shared/types/market';
import { Timeframe } from '../../../shared/constants/instruments';
export interface SynchronizedCandleContext {
    decisionCandle: Candle;
    completedHigherTimeframeCandles: Candle[];
    latestCompletedHigherTimeframeCandle: Candle | null;
}
/**
 * Provider timestamps represent candle starts. A candle is usable at a
 * decision timestamp only after its full timeframe duration has elapsed.
 */
export declare function getCompletedCandlesAt(candles: Candle[], timeframe: Timeframe, decisionTimestamp: string | Date): Candle[];
export declare function synchronizeHigherTimeframe(decisionCandles: Candle[], higherTimeframeCandles: Candle[], higherTimeframe: Timeframe): SynchronizedCandleContext[];
