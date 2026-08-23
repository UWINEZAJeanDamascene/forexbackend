import { describe, expect, it } from 'vitest';
import { Candle } from '../../../shared/types/market';
import { BacktestTrade } from '../../../shared/types/backtest';
import { BacktestPerformanceTracker, calculateBacktestMetrics } from './backtestPerformanceService';

function candle(index: number, close: number): Candle {
  return {
    timestamp: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
    open: close,
    high: close + 0.01,
    low: close - 0.01,
    close,
    volume: null,
  };
}

function trade(id: string, result: BacktestTrade['result'], pnl: number | null, exitTimestamp: string | null): BacktestTrade {
  return {
    id,
    symbol: 'EUR/USD',
    timeframe: '1H',
    direction: 'bullish',
    setupTimestamp: candle(0, 1).timestamp,
    entryTimestamp: candle(0, 1).timestamp,
    exitTimestamp,
    entryPrice: 1,
    stopPrice: 0.99,
    targetPrice: 1.02,
    exitPrice: exitTimestamp ? 1.01 : null,
    positionSize: 100,
    plannedRiskReward: 2,
    realizedPnl: pnl,
    realizedR: pnl === null ? null : pnl / 1,
    result,
    holdingMinutes: exitTimestamp ? 60 : null,
    exitReason: exitTimestamp ? 'target' : 'none',
    setupConditions: ['Trend: bullish'],
    setupSnapshot: {} as BacktestTrade['setupSnapshot'],
  };
}

describe('backtest performance service', () => {
  it('tracks balance, equity, peak, drawdown, and recovery periods', () => {
    const tracker = new BacktestPerformanceTracker(1000);
    const losingTrade = trade('loss-1', 'loss', -100, candle(1, 0.99).timestamp);
    const winningTrade = trade('win-1', 'win', 150, candle(3, 1.01).timestamp);

    tracker.recordCandle(candle(0, 1), []);
    const drawdownPoint = tracker.recordCandle(candle(1, 0.99), [], [losingTrade]);
    const recoveryPoint = tracker.recordCandle(candle(3, 1.01), [], [winningTrade]);
    tracker.finalize();

    expect(drawdownPoint.balance).toBe(900);
    expect(drawdownPoint.equity).toBe(900);
    expect(drawdownPoint.peakEquity).toBe(1000);
    expect(drawdownPoint.drawdown).toBe(-100);
    expect(recoveryPoint.balance).toBe(1050);
    expect(recoveryPoint.equity).toBe(1050);
    expect(recoveryPoint.peakEquity).toBe(1050);
    expect(tracker.getEquityCurve()).toHaveLength(3);
    expect(tracker.getDrawdownCurve()).toEqual([
      { timestamp: candle(0, 1).timestamp, drawdown: 0, drawdownPercent: 0 },
      { timestamp: candle(1, 0.99).timestamp, drawdown: -100, drawdownPercent: -10 },
      { timestamp: candle(3, 1.01).timestamp, drawdown: 0, drawdownPercent: 0 },
    ]);
    expect(tracker.getDrawdownPeriods()).toEqual([expect.objectContaining({
      startTimestamp: candle(1, 0.99).timestamp,
      bottomTimestamp: candle(1, 0.99).timestamp,
      recoveryTimestamp: candle(3, 1.01).timestamp,
      depth: -100,
    })]);
  });

  it('includes unrealized P/L in equity while keeping balance unchanged', () => {
    const tracker = new BacktestPerformanceTracker(1000);
    const openTrade = trade('open-1', 'open', null, null);
    const point = tracker.recordCandle(candle(1, 1.01), [openTrade]);

    expect(point.balance).toBe(1000);
    expect(point.equity).toBe(1001);
    expect(point.peakEquity).toBe(1001);
    expect(point.drawdown).toBe(0);
  });

  it('reports maximum drawdown from the deepest equity-curve point', () => {
    const tracker = new BacktestPerformanceTracker(1000);
    const loss = trade('loss-1', 'loss', -250, candle(1, 0.99).timestamp);
    tracker.recordCandle(candle(0, 1), []);
    const point = tracker.recordCandle(candle(1, 0.99), [], [loss]);
    tracker.finalize();

    const metrics = calculateBacktestMetrics([loss], tracker.getEquityCurve(), 1000);
    expect(point.drawdown).toBe(-250);
    expect(metrics.maximumDrawdown).toBe(-250);
    expect(metrics.maximumDrawdownPercent).toBe(-25);
  });

  it('calculates profit factor as gross profits divided by gross losses', () => {
    const trades = [
      trade('win-1', 'win', 300, candle(1, 1.01).timestamp),
      trade('win-2', 'win', 100, candle(2, 1.02).timestamp),
      trade('loss-1', 'loss', -200, candle(3, 0.99).timestamp),
    ];
    expect(calculateBacktestMetrics(trades, [], 1000).profitFactor).toBe(2);
  });

  it('calculates totals from completed trades and excludes open trades', () => {
    const trades = [
      trade('win-1', 'win', 150, candle(1, 1.01).timestamp),
      trade('loss-1', 'loss', -100, candle(2, 0.99).timestamp),
      trade('open-1', 'open', null, null),
    ];
    const metrics = calculateBacktestMetrics(trades, [], 1000);

    expect(metrics.totalTrades).toBe(3);
    expect(metrics.completedTrades).toBe(2);
    expect(metrics.wins).toBe(1);
    expect(metrics.losses).toBe(1);
    expect(metrics.breakevens).toBe(0);
    expect(metrics.winRate).toBe(50);
    expect(metrics.averageGain).toBe(150);
    expect(metrics.averageLoss).toBe(-100);
    expect(metrics.grossProfit).toBe(150);
    expect(metrics.grossLoss).toBe(100);
    expect(metrics.netProfit).toBe(50);
    expect(metrics.returnPercent).toBe(5);
    expect(metrics.profitFactor).toBe(1.5);
    expect(metrics.averagePlannedRiskReward).toBe(2);
    expect(metrics.averageRealizedR).toBe(25);
    expect(metrics.averageTradePnl).toBe(25);
    expect(metrics.largestWin).toBe(150);
    expect(metrics.largestLoss).toBe(-100);
    expect(metrics.longestWinningStreak).toBe(1);
    expect(metrics.longestLosingStreak).toBe(1);
    expect(metrics.averageHoldingMinutes).toBe(60);
    expect(metrics.tradeFrequencyPerDay).toBe(24);
  });

  it('calculates expectancy from win probability and average win/loss', () => {
    const trades = [
      trade('win-1', 'win', 150, candle(1, 1.01).timestamp),
      trade('loss-1', 'loss', -100, candle(2, 0.99).timestamp),
    ];
    expect(calculateBacktestMetrics(trades, [], 1000).expectancy).toBe(25);
  });

  it('tracks the longest winning and losing streaks independently', () => {
    const trades = [
      trade('win-1', 'win', 10, candle(1, 1.01).timestamp),
      trade('win-2', 'win', 10, candle(2, 1.01).timestamp),
      trade('loss-1', 'loss', -10, candle(3, 0.99).timestamp),
      trade('loss-2', 'loss', -10, candle(4, 0.99).timestamp),
      trade('loss-3', 'loss', -10, candle(5, 0.99).timestamp),
      trade('win-3', 'win', 10, candle(6, 1.01).timestamp),
    ];
    const metrics = calculateBacktestMetrics(trades, [], 1000);
    expect(metrics.longestWinningStreak).toBe(2);
    expect(metrics.longestLosingStreak).toBe(3);
  });

  it('counts breakevens separately and safely handles all wins', () => {
    const trades = [
      trade('win-1', 'win', 100, candle(1, 1.01).timestamp),
      trade('flat-1', 'breakeven', 0, candle(2, 1).timestamp),
    ];
    const metrics = calculateBacktestMetrics(trades, [], 1000);

    expect(metrics.completedTrades).toBe(2);
    expect(metrics.wins).toBe(1);
    expect(metrics.losses).toBe(0);
    expect(metrics.breakevens).toBe(1);
    expect(metrics.winRate).toBe(50);
    expect(metrics.grossProfit).toBe(100);
    expect(metrics.grossLoss).toBe(0);
    expect(metrics.profitFactor).toBeNull();
    expect(metrics.averageTradePnl).toBe(50);
    expect(metrics.largestWin).toBe(100);
    expect(metrics.largestLoss).toBeNull();
  });

  it('handles all-loss results without invalid ratios', () => {
    const trades = [
      trade('loss-1', 'loss', -100, candle(1, 0.99).timestamp),
      trade('loss-2', 'loss', -50, candle(2, 0.98).timestamp),
    ];
    const metrics = calculateBacktestMetrics(trades, [], 1000);

    expect(metrics.wins).toBe(0);
    expect(metrics.losses).toBe(2);
    expect(metrics.winRate).toBe(0);
    expect(metrics.averageGain).toBeNull();
    expect(metrics.averageLoss).toBe(-75);
    expect(metrics.grossProfit).toBe(0);
    expect(metrics.grossLoss).toBe(150);
    expect(metrics.netProfit).toBe(-150);
    expect(metrics.returnPercent).toBe(-15);
    expect(metrics.profitFactor).toBe(0);
    expect(metrics.largestWin).toBeNull();
    expect(metrics.largestLoss).toBe(-100);
  });

  it('returns null performance ratios when there are no completed trades', () => {
    const metrics = calculateBacktestMetrics([], [], 1000);
    expect(metrics.completedTrades).toBe(0);
    expect(metrics.winRate).toBeNull();
    expect(metrics.averageGain).toBeNull();
    expect(metrics.averageLoss).toBeNull();
    expect(metrics.profitFactor).toBeNull();
    expect(metrics.expectancy).toBeNull();
  });

  it('handles a zero-trade equity curve without inventing performance', () => {
    const tracker = new BacktestPerformanceTracker(1000);
    tracker.recordCandle(candle(0, 1), []);
    tracker.finalize();
    const metrics = calculateBacktestMetrics([], tracker.getEquityCurve(), 1000);

    expect(metrics.totalTrades).toBe(0);
    expect(metrics.netProfit).toBe(0);
    expect(metrics.returnPercent).toBe(0);
    expect(metrics.maximumDrawdown).toBe(0);
    expect(metrics.profitFactor).toBeNull();
  });
});
