import { Candle } from '../../shared/types/market';
import { detectMarketStructure, detectStructureEvents } from './marketStructureEngine';
import { MarketStructureResponse } from '../../shared/types/marketStructure';

export interface GetMarketStructureOptions {
  swingWindow?: number;
}

export function getMarketStructure(
  candles: Candle[],
  options: GetMarketStructureOptions = {}
): MarketStructureResponse {
  const swingWindow = options.swingWindow ?? 2;
  const result = detectMarketStructure(candles, swingWindow);
  return result;
}

export function getStructureEvents(candles: Candle[], options: GetMarketStructureOptions = {}): MarketStructureResponse {
  const swingWindow = options.swingWindow ?? 2;
  return detectMarketStructure(candles, swingWindow);
}
