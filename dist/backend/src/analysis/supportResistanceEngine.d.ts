import { Candle } from '../../shared/types/market';
import { SupportResistanceResponse } from '../../shared/types/supportResistance';
export declare function detectSupportResistance(candles: Candle[], swingWindow?: number, options?: {
    confirmedSwingOnly?: boolean;
}): SupportResistanceResponse;
