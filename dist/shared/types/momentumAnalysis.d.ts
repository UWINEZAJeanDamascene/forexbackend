export type MomentumDirection = 'bullish' | 'bearish' | 'neutral';
export type MomentumStrength = 'weak' | 'moderate' | 'strong';
export type DivergenceType = 'bullish' | 'bearish' | null;
export interface MomentumComponent {
    score: number;
    explanation: string;
    raw: Record<string, unknown>;
}
export interface MomentumAnalysisResult {
    momentum: MomentumDirection;
    momentumLean: string | null;
    strength: MomentumStrength | null;
    score: number;
    rawScore: number;
    adjustmentFactor: number;
    adjustmentReason: string;
    counterTrend: boolean;
    counterTrendExplanation: string;
    trendContext: MomentumDirection;
    divergence: DivergenceType;
    components: {
        rsi: MomentumComponent;
        macd: MomentumComponent;
        priceMovement: MomentumComponent;
    };
    dataQuality: {
        sufficient: boolean;
        candleCount: number;
        minimumRequired: number;
    };
}
export interface MomentumResponse {
    symbol: string;
    timeframe: string;
    momentum: MomentumAnalysisResult;
}
