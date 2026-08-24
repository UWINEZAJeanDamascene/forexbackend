export type SetupStatus = 'candidate' | 'conditions_met';
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
    /** All rule conditions satisfied on the analysis timeframe. */
    conditionsComplete?: boolean;
    /** Deterministic setup status — never implies trade readiness on its own. */
    status?: SetupStatus;
}
export interface SetupDetectionResponse {
    symbol: string;
    timeframe: string;
    setups: DetectedSetup[];
    dataQualityNote?: string | null;
}
export interface SetupContext {
    symbol: string;
    currentPrice: number;
    trend: {
        trend: 'bullish' | 'bearish' | 'neutral';
        strength: string;
        ema: {
            ema20: number | null;
            ema50: number | null;
            ema200: number | null;
        };
    };
    structure: {
        trend: string;
        events: {
            type: string;
            price: number;
        }[];
    };
    momentum: {
        momentum: string;
        strength: string;
        counterTrend: boolean;
    };
    volatility: {
        classification: string;
    };
    supportResistance: {
        supports: {
            price: number;
            zoneLow: number;
            zoneHigh: number;
            strength: number;
        }[];
        resistances: {
            price: number;
            zoneLow: number;
            zoneHigh: number;
            strength: number;
        }[];
    };
    multiTimeframe: {
        alignment: string;
        possiblePattern: string | null;
        higherTimeframe: {
            timeframe: string;
            trend: string;
            status: string;
        } | null;
        analysis: {
            timeframe: string;
            trend: string;
            score: number;
            status: string;
        };
        lowerTimeframe: {
            timeframe: string;
            trend: string;
            status: string;
        } | null;
        higherTimeframeIncomplete: boolean;
    };
}
