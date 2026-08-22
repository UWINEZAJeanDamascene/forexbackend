export type TrendDirection = 'bullish' | 'bearish' | 'neutral';
export type TrendStrength = 'weak' | 'moderate' | 'strong';
export type ImpulseState = 'expanding' | 'cooling' | 'flat' | 'unknown';
export interface TrendFactor {
    direction: TrendDirection;
    score: number;
    explanation: string;
}
export interface PriceVsEmaBreakdown {
    vsEma20: TrendDirection | null;
    vsEma50: TrendDirection | null;
    vsEma200: TrendDirection | null;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
}
export interface TrendAnalysisResult {
    trend: TrendDirection;
    strength: TrendStrength;
    score: number;
    factors: {
        emaAlignment: TrendFactor;
        marketStructure: TrendFactor;
        priceVsEma: TrendFactor;
        recentHighsLows: TrendFactor;
    };
    priceVsEmaBreakdown: PriceVsEmaBreakdown;
    currentPrice: number;
    ema: {
        ema20: number | null;
        ema50: number | null;
        ema200: number | null;
    };
    analyzedAt: string;
}
export interface TrendResponse {
    symbol: string;
    timeframe: string;
    trend: TrendAnalysisResult;
}
