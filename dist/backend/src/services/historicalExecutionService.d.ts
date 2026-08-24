import { Candle } from '../../../shared/types/market';
import { BacktestExecutionPlan, BacktestExecutionAssumptions, BacktestSetupRecord } from '../../../shared/types/backtest';
import { BacktestPositionSize } from '../../../shared/types/backtest';
export declare function buildHistoricalExecutionPlan(setup: BacktestSetupRecord, candles: Candle[], execution: BacktestExecutionAssumptions): BacktestExecutionPlan;
export declare function calculateHistoricalPositionSize(setup: BacktestSetupRecord, plan: BacktestExecutionPlan, accountSize: number, riskPercent: number, fixedPositionUnits?: number, quoteToAccountRate?: number): BacktestPositionSize;
