import { SaveAnalysisRequest, AnalysisHistoryResponse, AnalysisDetailResponse } from '@shared/types/analysisHistory';
export interface ListHistoryOptions {
    page?: number;
    pageSize?: number;
    search?: string;
    symbol?: string;
    timeframe?: string;
    trend?: string;
    startDate?: string;
    endDate?: string;
    minConfidence?: number;
    maxConfidence?: number;
}
export declare function saveAnalysis(request: SaveAnalysisRequest, userId: string): Promise<{
    id: string;
}>;
export declare function listHistory(options: ListHistoryOptions | undefined, userId: string): Promise<AnalysisHistoryResponse>;
export declare function getAnalysisDetail(id: string, userId: string): Promise<AnalysisDetailResponse | null>;
export declare function deleteAnalysis(id: string, userId: string): Promise<boolean>;
