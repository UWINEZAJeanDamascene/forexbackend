export interface DetectedSetup {
    setup: string;
    direction: 'bullish' | 'bearish';
    strength: number;
    conditionsMet: string[];
    conditionsMissing: string[];
    conditionsMetCount: number;
    conditionsTotal: number;
    invalidationCondition: string;
    mtfIncomplete?: boolean;
    rank?: number;
}
export interface SetupDetectionResponse {
    symbol: string;
    timeframe: string;
    setups: DetectedSetup[];
    dataQualityNote?: string | null;
}
