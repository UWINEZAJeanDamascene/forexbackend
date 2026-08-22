import { VolatilityResponse } from '../../shared/types/volatilityAnalysis';
export declare function clearVolatilityAnalysisCache(): void;
export interface GetVolatilityOptions {
    limit?: number;
}
export declare function getVolatilityAnalysis(symbol: string, timeframe: string, options?: GetVolatilityOptions): Promise<VolatilityResponse>;
