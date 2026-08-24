export type ConfidenceBand = 'Low' | 'Moderate' | 'High';
export interface ConfidenceFactor {
    name: string;
    score: number;
    rawScore?: number;
    weight: number;
    contribution: number;
    explanation: string;
}
export interface ConfidenceCompositeBreakdown {
    name: string;
    score: number;
    rawScore?: number;
    weight: number;
    contribution: number;
}
export interface ConfidenceWarning {
    type: string;
    message: string;
    severity: 'info' | 'warning';
}
export interface ConfidenceAnalysisResult {
    symbol: string;
    timeframe: string;
    overallScore: number;
    band: ConfidenceBand;
    /** Human-readable evidence-agreement label; not a win probability. */
    bandLabel: string;
    factors: ConfidenceFactor[];
    warnings: ConfidenceWarning[];
    explanation: string;
    compositeBreakdown: ConfidenceCompositeBreakdown[];
    analyzedAt: string;
}
export interface ConfidenceResponse {
    symbol: string;
    timeframe: string;
    confidence: ConfidenceAnalysisResult;
}
