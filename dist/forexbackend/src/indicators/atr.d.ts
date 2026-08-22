import { Candle } from '../../shared/types/market';
/**
 * Average True Range (ATR) — 14-period by default.
 *
 * True Range for each candle is the greatest of:
 *   - high - low
 *   - |high - previous close|
 *   - |low - previous close|
 *
 * The first value is `null` because TR requires the previous close. ATR is
 * then the EMA of the TR series (same smoothing as the EMA indicator).
 */
export declare function atr(candles: Candle[], period?: number): (number | null)[];
