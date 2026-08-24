import { BacktestConfig, BacktestPeriodResult } from '../../../shared/types/backtest';
export declare function startBacktest(config: BacktestConfig, userId: string): Promise<{
    id: string;
}>;
export declare function initializeBacktestWorker(): void;
interface PeriodRange {
    split: BacktestPeriodResult['split'];
    startIndex: number;
    endIndex: number;
}
export declare function splitRanges(config: BacktestConfig, candleCount: number): PeriodRange[];
export declare function getPeriodStartingBalances(config: BacktestConfig, periods: BacktestPeriodResult[]): number[];
export {};
