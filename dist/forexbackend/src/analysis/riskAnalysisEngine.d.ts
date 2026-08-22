import { TrendAnalysisResult, MarketStructureResult, VolatilityAnalysisResult, SupportResistanceResponse, DetectedSetup } from '../../shared/types';
import { MomentumAnalysisResult } from '../../shared/types/momentumAnalysis';
import { MultiTimeframeAnalysis } from '../../shared/types/multiTimeframeAnalysis';
import { RiskAnalysisResult } from '../../shared/types/riskAnalysis';
export declare function computeRiskAnalysis(params: {
    trend: TrendAnalysisResult;
    structure: MarketStructureResult;
    volatility: VolatilityAnalysisResult;
    supportResistance: SupportResistanceResponse;
    setups: DetectedSetup[];
    currentPrice: number;
    accountSize?: number;
    maxRiskPercent?: number;
    momentum?: MomentumAnalysisResult;
    multiTimeframe?: MultiTimeframeAnalysis;
    quoteToAccountRate?: number;
    accountCurrency?: string;
}): RiskAnalysisResult;
