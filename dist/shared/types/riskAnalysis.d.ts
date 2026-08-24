export type ProximityLabel = 'nearby' | 'within_range' | 'distant';
export type TradeQuality = 'wait' | 'low' | 'moderate' | 'high';
export type TradeDecisionState = 'wait' | 'review' | 'ready';
export interface TradeDecisionSummary {
    state: TradeDecisionState;
    trendScore: number;
    entryQualityScore: number;
    rejectionReasons: string[];
}
export interface NearbyLevel {
    price: number;
    zoneRange: [number, number];
    strength: number;
    distanceFromPrice: number;
    distanceFromPricePct: number;
    distanceInATR: number;
    proximity: ProximityLabel;
}
export interface InvalidationCandidate {
    source: 'activeSetup' | 'protectedStructureLevel' | 'emaBreak' | 'nearbyResistance';
    price: number;
    description: string;
    distanceFromPrice: number;
    distanceInATR: number;
}
export interface RiskRewardScenario {
    direction: 'bullish' | 'bearish';
    entryReference: number;
    invalidation: {
        price: number;
        distanceInATR: number;
    };
    target: {
        price: number;
        strength: number;
        distanceInATR: number;
    };
    ratio: string;
}
export interface PositionSizingInput {
    accountSize: number;
    maxRiskPercent: number;
}
export interface PositionSizingResult {
    riskAmount: number;
    riskDistanceInPips: number;
    positionSizeUnits: number;
    positionSizeLots: number;
    basedOnInvalidation: number;
    unusuallyHighRisk: boolean;
}
export interface VolatilityContext {
    atr: number;
    atrPercentile: number;
    classification: string;
    bandDisagreement: boolean;
    note: string;
}
export interface RiskAnalysisResult {
    symbol: string;
    timeframe: string;
    currentPrice: number;
    nearbySupport: NearbyLevel | null;
    nearbyResistance: NearbyLevel | null;
    atr: number;
    volatilityContext: VolatilityContext;
    invalidationCandidates: InvalidationCandidate[];
    riskRewardScenarios: RiskRewardScenario[];
    tradeQuality: TradeQuality;
    tradeQualityReasons: string[];
    decision: TradeDecisionSummary;
    positionSizing: PositionSizingResult | null;
    positionSizingInput: PositionSizingInput | null;
    thresholds: {
        nearbyATR: number;
        withinRangeATR: number;
    };
    disclaimer: string;
    analyzedAt: string;
}
export interface RiskAnalysisRequest {
    symbol: string;
    timeframe: string;
    accountSize?: number;
    maxRiskPercent?: number;
}
export interface RiskResponse {
    symbol: string;
    timeframe: string;
    risk: RiskAnalysisResult;
}
