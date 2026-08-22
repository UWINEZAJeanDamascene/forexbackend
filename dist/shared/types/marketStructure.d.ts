export type SwingType = 'high' | 'low';
export type StructureEventType = 'higher_high' | 'higher_low' | 'lower_high' | 'lower_low' | 'break_of_structure' | 'change_of_character';
export type MarketStructureTrend = 'bullish' | 'bearish' | 'range' | 'unclear';
export interface SwingPoint {
    type: SwingType;
    timestamp: string;
    price: number;
    index: number;
}
export interface StructureEvent {
    type: StructureEventType;
    timestamp: string;
    price: number;
    description: string;
}
export interface CandlestickPattern {
    type: string;
    timestamp: string;
    price: number;
    description: string;
    strength: string;
}
export interface MarketStructureResult {
    trend: MarketStructureTrend;
    trendQualifier: string | null;
    swingHighs: SwingPoint[];
    swingLows: SwingPoint[];
    events: StructureEvent[];
    lastSwingHigh: SwingPoint | null;
    lastSwingLow: SwingPoint | null;
    higherHighsCount: number;
    higherLowsCount: number;
    lowerHighsCount: number;
    lowerLowsCount: number;
    recentHigherHighs: number;
    recentHigherLows: number;
    recentLowerHighs: number;
    recentLowerLows: number;
    candlestickPatterns: CandlestickPattern[];
}
export interface MarketStructureResponse {
    symbol: string;
    timeframe: string;
    structure: MarketStructureResult;
}
