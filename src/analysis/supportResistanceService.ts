import { Candle } from '../../shared/types/market';
import { detectSupportResistance } from './supportResistanceEngine';
import { SupportResistanceResponse } from '../../shared/types/supportResistance';

export interface GetSupportResistanceOptions {
  swingWindow?: number;
  confirmedSwingOnly?: boolean;
}

export function getSupportResistance(
  candles: Candle[],
  options: GetSupportResistanceOptions = {}
): SupportResistanceResponse {
  const swingWindow = options.swingWindow ?? 2;
  return detectSupportResistance(candles, swingWindow, { confirmedSwingOnly: options.confirmedSwingOnly });
}
