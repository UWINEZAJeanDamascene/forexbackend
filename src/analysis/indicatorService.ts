import { Candle } from '../../shared/types/market';
import { ema } from '../indicators/ema';
import { rsi } from '../indicators/rsi';
import { macd, MacdResult } from '../indicators/macd';
import { atr } from '../indicators/atr';
import { bollingerBands } from '../indicators/bollingerBands';
import { IndicatorResponse } from '../../shared/types/indicators';

/**
 * Computes all Phase 6 technical indicators from validated candle data.
 *
 * This is the single entry point for indicator calculation. All other
 * backend code (controllers, analysis engines, AI service) should use this
 * rather than calling individual indicator functions directly, so future
 * changes to indicator sets/config only require updating this file.
 */
export function computeIndicators(candles: Candle[], symbol: string, timeframe: string): IndicatorResponse {
  const closes = candles.map((c) => c.close);

  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const rsi14 = rsi(closes, 14);
  const macdResult: MacdResult = macd(closes, 12, 26, 9);
  const atr14 = atr(candles, 14);
  const bb = bollingerBands(candles, 20, 2);

  return {
    symbol,
    timeframe,
    indicators: {
      ema20,
      ema50,
      ema200,
      rsi14,
      macd: {
        line: macdResult.macdLine,
        signal: macdResult.signalLine,
        histogram: macdResult.histogram,
      },
      atr14,
      bollingerBands: {
        upper: bb.upper,
        middle: bb.middle,
        lower: bb.lower,
      },
    },
  };
}
