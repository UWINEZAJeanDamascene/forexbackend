export type LevelType = 'support' | 'resistance' | 'tested';
export interface SupportResistanceLevel {
    price: number;
    zoneLow: number;
    zoneHigh: number;
    type: LevelType;
    strength: number;
    touches: number;
    lastReactionTime: string;
}
export interface SupportResistanceResponse {
    symbol: string;
    timeframe: string;
    supports: SupportResistanceLevel[];
    resistances: SupportResistanceLevel[];
    tested: SupportResistanceLevel[];
}
