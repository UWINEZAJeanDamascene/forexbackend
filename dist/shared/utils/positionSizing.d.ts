export interface PositionSizeInput {
    accountSize: number;
    riskPercent: number;
    currentPrice: number;
    invalidationPrice: number;
    symbol: string;
    quoteToAccountRate?: number;
}
export interface PositionSizeResult {
    riskAmount: number;
    riskDistance: number;
    riskDistanceInPips: number;
    positionSizeUnits: number;
    positionSizeLots: number;
}
export declare function calculatePositionSize(input: PositionSizeInput): PositionSizeResult | null;
