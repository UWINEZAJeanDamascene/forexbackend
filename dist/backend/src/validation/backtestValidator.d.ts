import { BacktestConfig } from '../../../shared/types/backtest';
export interface BacktestValidationResult {
    config: BacktestConfig | null;
    errors: string[];
}
export declare function validateBacktestConfig(input: unknown): BacktestValidationResult;
