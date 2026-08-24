export type ProximityLabel = 'nearby' | 'within_range' | 'distant';
export type TradeQuality = 'wait' | 'low' | 'moderate' | 'high';
/**
 * A decision is intentionally never "ready" from indicator agreement alone.
 * That state is reserved for a future, empirically calibrated validation layer.
 */
export type TradeDecisionState = 'wait' | 'review';
export type EvidenceValidationStatus = 'unvalidated' | 'insufficient_sample' | 'validated';
export interface EvidenceValidation {
    /** Whether this exact setup has independent, out-of-sample outcome evidence. */
    status: EvidenceValidationStatus;
    /** The number of comparable out-of-sample observations, when available. */
    sampleSize: number | null;
    /** Never infer a win probability from indicator agreement. */
    outcomeMetricsAvailable: boolean;
    message: string;
}
export interface TradeDecisionSummary {
    state: TradeDecisionState;
    trendScore: number;
    /** Raw weighted score from setup, MTF, momentum, and location inputs. */
    rawEntryQualityScore: number;
    /** Display score; capped below the ready threshold while decision is WAIT. */
    entryQualityScore: number;
    entryQualityBlocked: boolean;
    entryQualityNote: string | null;
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
    quality?: 'normal' | 'extreme' | 'unavailable';
    warning?: string;
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
    accountCurrency?: string;
    quoteToAccountRate?: number;
    conversionPair?: string | null;
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
    evidenceValidation: EvidenceValidation;
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
