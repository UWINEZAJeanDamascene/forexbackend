export type VolatilityClassification = 'low' | 'normal' | 'high';
export type VolatilityRegime = 'compressed' | 'stable' | 'expanding' | 'elevated_contracting' | 'mixed';
export type VolatilityStrength = 'weak' | 'moderate' | 'strong';
export interface VolatilityAnalysisResult {
    classification: VolatilityClassification;
    score: number;
    currentAtr: number;
    averageAtr: number;
    atrPercentile: number;
    bandWidth: number;
    bandWidthPercentile: number;
    bandDisagreement: boolean;
    regime: VolatilityRegime;
    explanation: string;
    dataQuality: {
        sufficient: boolean;
        candleCount: number;
        minimumRequired: number;
    };
}
export interface VolatilityResponse {
    symbol: string;
    timeframe: string;
    volatility: VolatilityAnalysisResult;
}
