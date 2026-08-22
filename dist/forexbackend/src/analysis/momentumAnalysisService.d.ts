import { MomentumResponse } from '../../shared/types/momentumAnalysis';
export interface GetMomentumOptions {
    limit?: number;
}
export declare function clearMomentumAnalysisCache(): void;
export declare function getMomentumAnalysis(symbol: string, timeframe: string, options?: GetMomentumOptions): Promise<MomentumResponse>;
