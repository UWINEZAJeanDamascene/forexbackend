export interface PositionSizeCalculation {
    riskAmount: number;
    riskDistance: number;
    riskDistanceInPips: number;
    positionSizeUnits: number;
    positionSizeLots: number;
}
/**
 * Calculates the position size for an instrument whose price movement is
 * denominated in its quote currency. quoteToAccountRate converts one quote
 * currency unit into one account-currency unit.
 */
export declare function calculatePositionSize(params: {
    accountSize: number;
    riskPercent: number;
    currentPrice: number;
    invalidationPrice: number;
    symbol: string;
    quoteToAccountRate: number;
}): PositionSizeCalculation | null;
