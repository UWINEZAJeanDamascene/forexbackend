import { Candle } from '../../../shared/types/market';
import { BacktestMetrics, BacktestTrade, DrawdownPeriod, DrawdownPoint, EquityPoint } from '../../../shared/types/backtest';
export declare class BacktestPerformanceTracker {
    private balance;
    private peakEquity;
    private peakTimestamp;
    private readonly equityCurve;
    private readonly drawdownPeriods;
    private readonly appliedTradeIds;
    private activeDrawdown;
    constructor(initialBalance: number);
    recordCandle(candle: Candle, openTrades: BacktestTrade[], newlyClosedTrades?: BacktestTrade[]): EquityPoint;
    finalize(lastTimestamp?: string): void;
    getBalance(): number;
    getEquityCurve(): EquityPoint[];
    getDrawdownCurve(): DrawdownPoint[];
    getDrawdownPeriods(): DrawdownPeriod[];
    private finishDrawdown;
}
export declare function calculateBacktestMetrics(trades: BacktestTrade[], equityCurve: EquityPoint[], initialBalance: number): BacktestMetrics;
