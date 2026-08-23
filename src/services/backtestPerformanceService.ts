import { Candle } from '../../../shared/types/market';
import { BacktestMetrics, BacktestTrade, DrawdownPeriod, DrawdownPoint, EquityPoint } from '../../../shared/types/backtest';

interface ActiveDrawdown {
  startTimestamp: string;
  bottomTimestamp: string;
  depth: number;
  depthPercent: number;
}

function unrealizedPnl(trade: BacktestTrade, price: number): number {
  if (trade.result !== 'open') return 0;
  const direction = trade.direction === 'bullish' ? 1 : -1;
  return (price - trade.entryPrice) * direction * trade.positionSize;
}

export class BacktestPerformanceTracker {
  private balance: number;
  private peakEquity: number;
  private peakTimestamp: string | null = null;
  private readonly equityCurve: EquityPoint[] = [];
  private readonly drawdownPeriods: DrawdownPeriod[] = [];
  private readonly appliedTradeIds = new Set<string>();
  private activeDrawdown: ActiveDrawdown | null = null;

  constructor(initialBalance: number) {
    if (!Number.isFinite(initialBalance) || initialBalance <= 0) throw new Error('Initial balance must be a positive number.');
    this.balance = initialBalance;
    this.peakEquity = initialBalance;
  }

  recordCandle(candle: Candle, openTrades: BacktestTrade[], newlyClosedTrades: BacktestTrade[] = []): EquityPoint {
    for (const trade of newlyClosedTrades) {
      if (this.appliedTradeIds.has(trade.id)) throw new Error(`Trade ${trade.id} was applied to account balance more than once.`);
      if (trade.result === 'open' || trade.realizedPnl === null) throw new Error(`Trade ${trade.id} is not a completed trade with realized P/L.`);
      this.balance += trade.realizedPnl;
      this.appliedTradeIds.add(trade.id);
    }

    const equity = this.balance + openTrades.reduce((total, trade) => total + unrealizedPnl(trade, candle.close), 0);
    if (equity > this.peakEquity) {
      this.peakEquity = equity;
      this.peakTimestamp = candle.timestamp;
    }
    const drawdown = equity - this.peakEquity;
    const drawdownPercent = this.peakEquity > 0 ? (drawdown / this.peakEquity) * 100 : 0;
    const point = { timestamp: candle.timestamp, balance: this.balance, equity, peakEquity: this.peakEquity, drawdown, drawdownPercent };
    this.equityCurve.push(point);

    if (drawdown < 0) {
      if (!this.activeDrawdown) {
        this.activeDrawdown = {
          startTimestamp: this.peakTimestamp ?? candle.timestamp,
          bottomTimestamp: candle.timestamp,
          depth: drawdown,
          depthPercent: drawdownPercent,
        };
      } else if (drawdown < this.activeDrawdown.depth) {
        this.activeDrawdown.bottomTimestamp = candle.timestamp;
        this.activeDrawdown.depth = drawdown;
        this.activeDrawdown.depthPercent = drawdownPercent;
      }
    } else if (this.activeDrawdown) {
      this.drawdownPeriods.push(this.finishDrawdown(this.activeDrawdown, candle.timestamp));
      this.activeDrawdown = null;
    }

    return point;
  }

  finalize(lastTimestamp?: string): void {
    if (!this.activeDrawdown) return;
    const recoveryTimestamp = lastTimestamp ?? null;
    this.drawdownPeriods.push(this.finishDrawdown(this.activeDrawdown, recoveryTimestamp));
    this.activeDrawdown = null;
  }

  getBalance(): number { return this.balance; }
  getEquityCurve(): EquityPoint[] { return [...this.equityCurve]; }
  getDrawdownCurve(): DrawdownPoint[] {
    return this.equityCurve.map(({ timestamp, drawdown, drawdownPercent }) => ({ timestamp, drawdown, drawdownPercent }));
  }
  getDrawdownPeriods(): DrawdownPeriod[] { return [...this.drawdownPeriods]; }

  private finishDrawdown(drawdown: ActiveDrawdown, recoveryTimestamp: string | null): DrawdownPeriod {
    const recoveryMinutes = recoveryTimestamp
      ? Math.max(0, (new Date(recoveryTimestamp).getTime() - new Date(drawdown.startTimestamp).getTime()) / 60000)
      : null;
    return { ...drawdown, recoveryTimestamp, recoveryMinutes };
  }
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function streaks(trades: BacktestTrade[]): { winning: number; losing: number } {
  let winning = 0;
  let losing = 0;
  let currentWinning = 0;
  let currentLosing = 0;
  for (const trade of [...trades].sort((a, b) => new Date(a.exitTimestamp ?? 0).getTime() - new Date(b.exitTimestamp ?? 0).getTime())) {
    if (trade.result === 'win') {
      currentWinning++;
      currentLosing = 0;
      winning = Math.max(winning, currentWinning);
    } else if (trade.result === 'loss') {
      currentLosing++;
      currentWinning = 0;
      losing = Math.max(losing, currentLosing);
    } else {
      currentWinning = 0;
      currentLosing = 0;
    }
  }
  return { winning, losing };
}

export function calculateBacktestMetrics(
  trades: BacktestTrade[],
  equityCurve: EquityPoint[],
  initialBalance: number
): BacktestMetrics {
  const completed = trades.filter((trade) => trade.result !== 'open' && trade.realizedPnl !== null);
  const wins = completed.filter((trade) => trade.result === 'win');
  const losses = completed.filter((trade) => trade.result === 'loss');
  const breakevens = completed.filter((trade) => trade.result === 'breakeven');
  const gains = wins.map((trade) => trade.realizedPnl!);
  const lossValues = losses.map((trade) => trade.realizedPnl!);
  const grossProfit = gains.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(lossValues.reduce((sum, value) => sum + value, 0));
  const netProfit = completed.reduce((sum, trade) => sum + trade.realizedPnl!, 0);
  const minimumDrawdown = equityCurve.reduce((minimum, point) => Math.min(minimum, point.drawdown), 0);
  const minimumDrawdownPercent = equityCurve.reduce((minimum, point) => Math.min(minimum, point.drawdownPercent), 0);
  const realizedRs = completed.map((trade) => trade.realizedR).filter((value): value is number => value !== null);
  const plannedRrs = trades.map((trade) => trade.plannedRiskReward).filter(Number.isFinite);
  const holdingMinutes = completed.map((trade) => trade.holdingMinutes).filter((value): value is number => value !== null);
  const tradePnl = completed.map((trade) => trade.realizedPnl!);
  const timestamps = completed.flatMap((trade) => [new Date(trade.setupTimestamp).getTime(), new Date(trade.exitTimestamp!).getTime()])
    .filter(Number.isFinite);
  const firstTradeTime = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const lastTradeTime = timestamps.length > 0 ? Math.max(...timestamps) : null;
  const periodDays = firstTradeTime !== null && lastTradeTime !== null
    ? (lastTradeTime - firstTradeTime) / 86_400_000
    : 0;
  const streak = streaks(completed);
  const winRate = completed.length > 0 ? (wins.length / completed.length) * 100 : null;
  const averageGain = average(gains);
  const averageLoss = average(lossValues);

  return {
    totalTrades: trades.length,
    completedTrades: completed.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    winRate,
    averageGain,
    averageLoss,
    grossProfit,
    grossLoss,
    netProfit,
    returnPercent: initialBalance > 0 ? (netProfit / initialBalance) * 100 : 0,
    maximumDrawdown: minimumDrawdown,
    maximumDrawdownPercent: minimumDrawdownPercent,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    averagePlannedRiskReward: average(plannedRrs),
    averageRealizedR: average(realizedRs),
    averageTradePnl: average(tradePnl),
    largestWin: gains.length > 0 ? Math.max(...gains) : null,
    largestLoss: lossValues.length > 0 ? Math.min(...lossValues) : null,
    tradeFrequencyPerDay: periodDays > 0 ? completed.length / periodDays : null,
    expectancy: completed.length > 0 && averageGain !== null && averageLoss !== null
      ? (wins.length / completed.length) * averageGain + (losses.length / completed.length) * averageLoss
      : null,
    longestWinningStreak: streak.winning,
    longestLosingStreak: streak.losing,
    averageHoldingMinutes: average(holdingMinutes),
  };
}