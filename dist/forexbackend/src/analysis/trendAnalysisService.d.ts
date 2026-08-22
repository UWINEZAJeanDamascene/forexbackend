import { TrendResponse } from '../../shared/types/trendAnalysis';
export interface GetTrendOptions {
    swingWindow?: number;
    limit?: number;
}
export declare function clearTrendAnalysisCache(): void;
export declare function getTrendAnalysis(symbol: string, timeframe: string, options?: GetTrendOptions): Promise<TrendResponse>;
