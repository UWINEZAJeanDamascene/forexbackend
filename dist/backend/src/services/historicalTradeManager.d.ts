import { Candle } from '../../../shared/types/market';
import { BacktestExecutionPlan, BacktestExecutionAssumptions, BacktestSetupRecord, BacktestTrade } from '../../../shared/types/backtest';
export declare class HistoricalTradeManager {
    private readonly execution;
    private readonly openTrades;
    private readonly completedTrades;
    private readonly seenSetupKeys;
    private nextTradeNumber;
    constructor(execution: BacktestExecutionAssumptions);
    getOpenTrades(): BacktestTrade[];
    getCompletedTrades(): BacktestTrade[];
    openTrade(setup: BacktestSetupRecord, plan: BacktestExecutionPlan, accountSize: number, riskPercent: number, fixedPositionUnits?: number, quoteToAccountRate?: number): BacktestTrade | null;
    processCandle(index: number, candle: Candle, higherResolutionCandles?: Candle[]): BacktestTrade[];
    closeAtEnd(candle: Candle): BacktestTrade[];
    private closeState;
    private resolveAmbiguousExit;
    private configuredAmbiguousExit;
}
