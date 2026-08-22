import { TrendAnalysisResult, MarketStructureResult, MomentumAnalysisResult, VolatilityAnalysisResult, SupportResistanceResponse, MultiTimeframeAnalysis, DetectedSetup } from '../../shared/types';
import { ConfidenceAnalysisResult } from '../../shared/types/confidenceAnalysis';
export declare function computeConfidence(params: {
    trend: TrendAnalysisResult;
    structure: MarketStructureResult;
    momentum: MomentumAnalysisResult;
    volatility: VolatilityAnalysisResult;
    supportResistance: SupportResistanceResponse;
    multiTimeframe: MultiTimeframeAnalysis;
    setups: DetectedSetup[];
    currentPrice: number;
}): ConfidenceAnalysisResult;
