import { Candle } from '../../shared/types/market';
import { atr } from '../indicators/atr';

const MIN_CANDLES = 20;
const ATR_PERIOD = 14;
const WICK_BODY_RATIO = 2.0;
const CLOSE_POSITION_THRESHOLD = 0.3;

export interface CandlestickPattern {
  type: 'rejection_wick_top' | 'rejection_wick_bottom' | 'bullish_engulfing' | 'bearish_engulfing';
  timestamp: string;
  price: number;
  description: string;
  strength: 'weak' | 'moderate' | 'strong';
}

export function detectCandlestickPatterns(candles: Candle[]): CandlestickPattern[] {
  if (candles.length < MIN_CANDLES) {
    return [];
  }

  const atrValues = atr(candles, ATR_PERIOD);
  const currentAtr = lastNonNil(atrValues);
  const patterns: CandlestickPattern[] = [];

  const recent = candles.slice(-MIN_CANDLES);
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];

    const range = curr.high - curr.low;
    if (range <= 0) continue;

    const body = Math.abs(curr.close - curr.open);
    const upperWick = curr.high - Math.max(curr.open, curr.close);
    const lowerWick = Math.min(curr.open, curr.close) - curr.low;
    const closePosition = curr.close <= curr.open
      ? (curr.close - curr.low) / range
      : (curr.high - curr.close) / range;

    if (curr.close < curr.open && upperWick > WICK_BODY_RATIO * body && closePosition < CLOSE_POSITION_THRESHOLD) {
      const strength = currentAtr !== null && upperWick > currentAtr ? 'strong' : upperWick > currentAtr * 0.5 ? 'moderate' : 'weak';
      patterns.push({
        type: 'rejection_wick_top',
        timestamp: curr.timestamp,
        price: curr.high,
        description: `Rejection wick at ${curr.high.toFixed(5)} (upper wick ${upperWick.toFixed(5)}, body ${body.toFixed(5)})`,
        strength,
      });
    }

    if (curr.close > curr.open && lowerWick > WICK_BODY_RATIO * body && closePosition < CLOSE_POSITION_THRESHOLD) {
      const strength = currentAtr !== null && lowerWick > currentAtr ? 'strong' : lowerWick > currentAtr * 0.5 ? 'moderate' : 'weak';
      patterns.push({
        type: 'rejection_wick_bottom',
        timestamp: curr.timestamp,
        price: curr.low,
        description: `Rejection wick at ${curr.low.toFixed(5)} (lower wick ${lowerWick.toFixed(5)}, body ${body.toFixed(5)})`,
        strength,
      });
    }

    if (curr.close > curr.open && prev.close < prev.open && curr.close > prev.open && curr.open < prev.close) {
      const strength = currentAtr !== null && body > currentAtr ? 'strong' : body > currentAtr * 0.5 ? 'moderate' : 'weak';
      patterns.push({
        type: 'bullish_engulfing',
        timestamp: curr.timestamp,
        price: curr.close,
        description: `Bullish engulfing at ${curr.close.toFixed(5)} (prev close ${prev.close.toFixed(5)})`,
        strength,
      });
    }

    if (curr.close < curr.open && prev.close > prev.open && curr.close < prev.open && curr.open > prev.close) {
      const strength = currentAtr !== null && body > currentAtr ? 'strong' : body > currentAtr * 0.5 ? 'moderate' : 'weak';
      patterns.push({
        type: 'bearish_engulfing',
        timestamp: curr.timestamp,
        price: curr.close,
        description: `Bearish engulfing at ${curr.close.toFixed(5)} (prev close ${prev.close.toFixed(5)})`,
        strength,
      });
    }
  }

  return patterns.slice(-5);
}

function lastNonNil(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] !== null && values[i] !== undefined) {
      return values[i];
    }
  }
  return null;
}
