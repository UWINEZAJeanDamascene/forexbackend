import { Symbol, Timeframe } from '../constants/instruments';
export type TimeframeSnapshotStatus = 'ok' | 'insufficient_data' | 'error';
export interface TimeframeSnapshot {
    timeframe: Timeframe;
    trend: 'bullish' | 'bearish' | 'neutral';
    score: number;
    strength: 'weak' | 'moderate' | 'strong';
    status: TimeframeSnapshotStatus;
    errorReason?: string;
}
export type MultiTimeframeAlignment = 'aligned_bullish' | 'aligned_bearish' | 'partially_aligned_bullish' | 'partially_aligned_bearish' | 'mixed' | 'insufficient_data';
export interface MultiTimeframeAnalysis {
    symbol: Symbol;
    analysisTimeframe: Timeframe;
    higherTimeframe: TimeframeSnapshot | null;
    analysis: TimeframeSnapshot;
    lowerTimeframe: TimeframeSnapshot | null;
    alignment: MultiTimeframeAlignment;
    possiblePattern: string | null;
    explanation: string;
}
export interface MultiTimeframeResponse {
    symbol: Symbol;
    timeframe: Timeframe;
    multiTimeframe: MultiTimeframeAnalysis;
}
