import { Candle } from '../../shared/types/market';
import { MarketStructureResponse, StructureEvent } from '../../shared/types/marketStructure';
export declare function detectMarketStructure(candles: Candle[], swingWindow?: number, options?: {
    confirmedSwingOnly?: boolean;
}): MarketStructureResponse;
export declare function detectStructureEvents(candles: Candle[], swingWindow?: number): StructureEvent[];
