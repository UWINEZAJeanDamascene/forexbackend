import { Candle } from '../../shared/types/market';
import { SupportResistanceResponse } from '../../shared/types/supportResistance';
export interface GetSupportResistanceOptions {
    swingWindow?: number;
}
export declare function getSupportResistance(candles: Candle[], options?: GetSupportResistanceOptions): SupportResistanceResponse;
