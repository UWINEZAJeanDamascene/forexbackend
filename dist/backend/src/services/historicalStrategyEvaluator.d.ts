import { Candle } from '../../../shared/types/market';
import { BacktestExecutionAssumptions, BacktestSetupRecord, BacktestStrategyConfig, EntryModel, HistoricalDecisionAnalysis } from '../../../shared/types/backtest';
export interface EntryEligibility {
    eligible: boolean;
    model: EntryModel;
    decisionIndex: number;
    entryIndex: number | null;
    entryTimestamp: string | null;
    reason: string;
}
export interface HistoricalSetupEvaluation {
    setup: BacktestSetupRecord | null;
    entry: EntryEligibility;
}
export declare function evaluateHistoricalStrategy(snapshot: HistoricalDecisionAnalysis, decisionIndex: number, candles: Candle[], config: BacktestStrategyConfig, execution: BacktestExecutionAssumptions): HistoricalSetupEvaluation;
export declare function getEntryEligibility(decisionIndex: number, candles: Candle[], model: EntryModel, entryPriceLevel?: number): EntryEligibility;
