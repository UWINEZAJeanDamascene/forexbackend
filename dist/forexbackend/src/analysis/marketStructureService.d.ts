import { Candle } from '../../shared/types/market';
import { MarketStructureResponse } from '../../shared/types/marketStructure';
export interface GetMarketStructureOptions {
    swingWindow?: number;
}
export declare function getMarketStructure(candles: Candle[], options?: GetMarketStructureOptions): MarketStructureResponse;
export declare function getStructureEvents(candles: Candle[], options?: GetMarketStructureOptions): MarketStructureResponse;
