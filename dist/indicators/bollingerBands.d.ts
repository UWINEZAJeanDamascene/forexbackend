import { Candle } from '../../shared/types/market';
export interface BollingerBandsResult {
    upper: (number | null)[];
    middle: (number | null)[];
    lower: (number | null)[];
}
/**
 * Bollinger Bands — 20-period SMA middle band with ±2 standard deviations
 * by default.
 *
 * The first `period - 1` values are `null` because there isn't enough
 * history to compute the SMA.
 */
export declare function bollingerBands(candles: Candle[], period?: number, stdDevMultiplier?: number): BollingerBandsResult;
