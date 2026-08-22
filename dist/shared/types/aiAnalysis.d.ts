import { Symbol, Timeframe } from '../constants/instruments';
import { ConfidenceAnalysisResult } from './confidenceAnalysis';
import { DetectedSetup } from './setupDetection';
import { MomentumAnalysisResult } from './momentumAnalysis';
import { MarketStructureResult } from './marketStructure';
import { SupportResistanceLevel } from './supportResistance';
import { TrendAnalysisResult } from './trendAnalysis';
import { VolatilityAnalysisResult } from './volatilityAnalysis';
import { MultiTimeframeAnalysis } from './multiTimeframeAnalysis';
import { RiskRewardScenario, NearbyLevel, InvalidationCandidate, TradeQuality } from './riskAnalysis';
export interface AnalysisContext {
    identity: {
        symbol: Symbol;
        timeframe: Timeframe;
        currentPrice: number;
        latestCandleAt: string | null;
        latestCandleClosed: boolean | null;
        candleStatus: 'fresh' | 'stale' | 'future' | 'unknown';
        candleAgeMs: number | null;
        provider: string;
        fallbackUsed: boolean;
    };
    marketBias: {
        analysis: TrendAnalysisResult;
        impulse: 'building' | 'cooling' | 'flat' | 'unknown';
    };
    momentum: MomentumAnalysisResult;
    marketStructure: MarketStructureResult;
    supportResistance: SupportResistanceLevel[];
    volatility: VolatilityAnalysisResult;
    multiTimeframe: MultiTimeframeAnalysis;
    evidenceAgreement: ConfidenceAnalysisResult;
    setups: DetectedSetup[];
    tradeQuality: {
        verdict: TradeQuality;
        reasons: string[];
    };
    risk: {
        nearbySupport: NearbyLevel | null;
        nearbyResistance: NearbyLevel | null;
        atr: number;
        invalidationCandidates: InvalidationCandidate[];
        riskRewardScenarios: RiskRewardScenario[];
    };
}
export interface AiAnalysisRequest {
    symbol: Symbol;
    timeframe: Timeframe;
}
/** Strict provider output. It contains explanations only; deterministic
 * backend values remain the source of truth. */
export interface AiStructuredOutput {
    summary: string;
    trend: string;
    momentum: string;
    marketStructure: string;
    keyLevels: string[];
    bullishScenario: string;
    bearishScenario: string;
    confirmationNeeded: string[];
    invalidationConditions: string[];
    riskFactors: string[];
    confidence: number;
}
export interface AiAnalysisResponse {
    symbol: Symbol;
    timeframe: Timeframe;
    explanation: string;
    structured: AiStructuredOutput | null;
    provider: string;
    cached: boolean;
    generatedAt: string;
    disclaimer: string;
    available: boolean;
}
