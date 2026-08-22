import { Candle } from '../../shared/types/market';
import { IndicatorResponse } from '../../shared/types/indicators';
/**
 * Computes all Phase 6 technical indicators from validated candle data.
 *
 * This is the single entry point for indicator calculation. All other
 * backend code (controllers, analysis engines, AI service) should use this
 * rather than calling individual indicator functions directly, so future
 * changes to indicator sets/config only require updating this file.
 */
export declare function computeIndicators(candles: Candle[], symbol: string, timeframe: string): IndicatorResponse;
