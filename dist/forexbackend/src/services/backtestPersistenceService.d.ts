import { BacktestConfig, BacktestResult, BacktestRunMetadata } from '../../../shared/types/backtest';
export interface CreateBacktestRunInput {
    userId?: string;
    config: BacktestConfig;
    metadata: BacktestRunMetadata;
    warnings?: string[];
}
export declare function createBacktestRun(input: CreateBacktestRunInput): Promise<{
    id: string;
}>;
export declare function saveCompletedBacktest(id: string, result: Pick<BacktestResult, 'metrics' | 'trades' | 'equityCurve' | 'drawdownCurve' | 'drawdownPeriods' | 'warnings' | 'periodResults'>): Promise<void>;
export declare function markBacktestFailed(id: string, error: string): Promise<void>;
export declare function markBacktestRunning(id: string): Promise<void>;
export declare function claimNextBacktest(): Promise<{
    id: string;
    config: BacktestConfig;
} | null>;
export declare function retryBacktest(id: string, error: string): Promise<boolean>;
export declare function updateBacktestMetadata(id: string, metadata: BacktestRunMetadata): Promise<void>;
export declare function getBacktestRun(id: string, userId: string): Promise<any>;
export declare function getBacktestTrade(id: string, userId: string): Promise<any>;
export declare function listBacktestRuns(userId: string): Promise<any>;
export declare function cancelBacktest(id: string, userId: string): Promise<boolean>;
export declare function isBacktestCancelled(id: string): Promise<boolean>;
