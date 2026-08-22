import { Candle } from '../../shared/types/market';
export interface CandlestickPattern {
    type: 'rejection_wick_top' | 'rejection_wick_bottom' | 'bullish_engulfing' | 'bearish_engulfing';
    timestamp: string;
    price: number;
    description: string;
    strength: 'weak' | 'moderate' | 'strong';
}
export declare function detectCandlestickPatterns(candles: Candle[]): CandlestickPattern[];
