import { describe, expect, it } from 'vitest';
import { Candle } from '../../../shared/types/market';
import { BacktestExecutionAssumptions, BacktestSetupRecord } from '../../../shared/types/backtest';
import { buildHistoricalExecutionPlan } from './historicalExecutionService';
import { HistoricalTradeManager } from './historicalTradeManager';

function candle(index: number, open: number, high = open + 0.01, low = open - 0.01, close = open): Candle {
  return {
    timestamp: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
    open,
    high,
    low,
    close,
    volume: null,
  };
}

function setup(symbol: 'EUR/USD' | 'USD/JPY' = 'EUR/USD'): BacktestSetupRecord {
  return {
    timestamp: candle(0, 1.1).timestamp,
    direction: 'bullish',
    entryPrice: symbol === 'EUR/USD' ? 1.1 : 110,
    conditionsMet: ['Trend: bullish'],
    conditionsMissing: [],
    snapshot: {
      symbol,
      timeframe: '1H',
      decisionIndex: 0,
      decisionTimestamp: candle(0, 1.1).timestamp,
      candlesThroughDecision: [candle(0, 1.1)],
      indicators: { atr14: [symbol === 'EUR/USD' ? 0.01 : 1] } as BacktestSetupRecord['snapshot']['indicators'],
      trend: { currentPrice: symbol === 'EUR/USD' ? 1.1 : 110, trend: 'bullish' } as BacktestSetupRecord['snapshot']['trend'],
      structure: { trend: 'bullish', swingLows: [], swingHighs: [] } as BacktestSetupRecord['snapshot']['structure'],
      supportResistance: { supports: [], resistances: [], tested: [] },
      momentum: {} as BacktestSetupRecord['snapshot']['momentum'],
      volatility: {} as BacktestSetupRecord['snapshot']['volatility'],
      higherTimeframeTrends: {},
    },
  };
}

const execution: BacktestExecutionAssumptions = {
  entryModel: 'next_candle_open',
  stopLossModel: 'atr',
  takeProfitModel: 'risk_reward',
  positionSizingMethod: 'risk_percent',
  spreadPips: 0,
  slippagePips: 0,
  commissionPerTrade: 2,
  atrStopMultiplier: 1,
  atrTargetMultiplier: 2,
  riskRewardRatio: 2,
  ambiguousCandlePolicy: 'stop_first',
  maxOpenTrades: 1,
};

describe('historical trade manager', () => {
  it('sizes risk by instrument pip conventions', () => {
    const euroSetup = setup('EUR/USD');
    const euroPlan = buildHistoricalExecutionPlan(euroSetup, [candle(0, 1.1), candle(1, 1.1)], execution);
    const yenSetup = setup('USD/JPY');
    const yenPlan = buildHistoricalExecutionPlan(yenSetup, [candle(0, 110), candle(1, 110)], execution);
    const euroManager = new HistoricalTradeManager(execution);
    const yenManager = new HistoricalTradeManager(execution);

    const euroTrade = euroManager.openTrade(euroSetup, euroPlan, 10000, 1);
    const yenTrade = yenManager.openTrade(yenSetup, yenPlan, 10000, 1);

    expect(euroTrade?.positionSize).toBeCloseTo(10000);
    expect(yenTrade?.positionSize).toBeCloseTo(100);
  });

  it('rejects duplicate setups and simultaneous trades beyond the configured limit', () => {
    const firstSetup = setup();
    const candles = [candle(0, 1.1), candle(1, 1.1)];
    const plan = buildHistoricalExecutionPlan(firstSetup, candles, execution);
    const manager = new HistoricalTradeManager(execution);

    expect(manager.openTrade(firstSetup, plan, 10000, 1)).not.toBeNull();
    expect(manager.openTrade(firstSetup, plan, 10000, 1)).toBeNull();
    expect(manager.openTrade({ ...firstSetup, timestamp: candle(2, 1.1).timestamp }, plan, 10000, 1)).toBeNull();
  });

  it('closes a trade candle by candle at the conservative stop when both levels are touched', () => {
    const tradeSetup = setup();
    const candles = [candle(0, 1.1), candle(1, 1.1), candle(2, 1.1, 1.13, 1.08, 1.1)];
    const plan = buildHistoricalExecutionPlan(tradeSetup, candles, execution);
    const manager = new HistoricalTradeManager(execution);
    manager.openTrade(tradeSetup, plan, 10000, 1);

    const closed = manager.processCandle(2, candles[2]);

    expect(closed).toHaveLength(1);
    expect(closed[0].exitReason).toBe('stop');
    expect(closed[0].result).toBe('loss');
    expect(manager.getOpenTrades()).toHaveLength(0);
  });

  it('uses the configured ambiguity policy for target-first and breakeven outcomes', () => {
    const candles = [candle(0, 1.1), candle(1, 1.1), candle(2, 1.1, 1.13, 1.08, 1.1)];
    const targetFirst = { ...execution, ambiguousCandlePolicy: 'target_first' as const };
    const targetManager = new HistoricalTradeManager(targetFirst);
    targetManager.openTrade(setup(), buildHistoricalExecutionPlan(setup(), candles, targetFirst), 10000, 1);
    expect(targetManager.processCandle(2, candles[2])[0].exitReason).toBe('target');

    const breakeven = { ...execution, ambiguousCandlePolicy: 'breakeven' as const };
    const breakevenManager = new HistoricalTradeManager(breakeven);
    breakevenManager.openTrade(setup(), buildHistoricalExecutionPlan(setup(), candles, breakeven), 10000, 1);
    const closed = breakevenManager.processCandle(2, candles[2])[0];
    expect(closed.exitReason).toBe('ambiguous');
    expect(closed.result).toBe('breakeven');
  });

  it('keeps a trade open until stop or target is reached and rejects a second close', () => {
    const tradeSetup = setup();
    const candles = [candle(0, 1.1), candle(1, 1.1), candle(2, 1.105, 1.11, 1.1, 1.105), candle(3, 1.1, 1.13, 1.08, 1.1)];
    const manager = new HistoricalTradeManager(execution);
    const plan = buildHistoricalExecutionPlan(tradeSetup, candles, execution);
    manager.openTrade(tradeSetup, plan, 10000, 1);

    expect(manager.processCandle(2, candles[2])).toHaveLength(0);
    const closed = manager.processCandle(3, candles[3]);
    expect(closed).toHaveLength(1);
    expect(closed[0].result).toBe('loss');
    expect(manager.processCandle(3, candles[3])).toHaveLength(0);
    expect(manager.closeAtEnd(candles[3])).toHaveLength(0);
  });

  it('uses higher-resolution candles to resolve stop and target order', () => {
    const tradeSetup = setup();
    const candles = [candle(0, 1.1), candle(1, 1.1), candle(2, 1.1, 1.13, 1.08, 1.1)];
    const plan = buildHistoricalExecutionPlan(tradeSetup, candles, execution);
    const manager = new HistoricalTradeManager(execution);
    manager.openTrade(tradeSetup, plan, 10000, 1);
    const intrabars = [
      candle(2, 1.1, 1.13, 1.1, 1.12),
      candle(2, 1.12, 1.12, 1.08, 1.1),
    ].map((item, index) => ({ ...item, timestamp: `2026-01-01T02:${10 + index * 10}:00.000Z` }));

    const closed = manager.processCandle(2, candles[2], intrabars);

    expect(closed[0].exitReason).toBe('target');
    expect(closed[0].result).toBe('win');
    expect(closed[0].plannedRiskReward).toBeCloseTo(2);
    expect(closed[0].realizedPnl).toBeCloseTo(198);
    expect(closed[0].realizedR).toBeCloseTo(1.98);
    expect(closed[0].entryTimestamp).toBe(candles[1].timestamp);
    expect(closed[0].exitTimestamp).toBe(candles[2].timestamp);
  });

  it('applies spread, slippage, and commission to realized P/L', () => {
    const tradeSetup = setup();
    const costedExecution = { ...execution, spreadPips: 2, slippagePips: 1, commissionPerTrade: 2 };
    const candles = [candle(0, 1.1), candle(1, 1.1), candle(2, 1.1, 1.13, 1.08, 1.1)];
    const plan = buildHistoricalExecutionPlan(tradeSetup, candles, costedExecution);
    const manager = new HistoricalTradeManager(costedExecution);
    manager.openTrade(tradeSetup, plan, 10000, 1);

    const closed = manager.processCandle(2, candles[2]);
    expect(closed[0].exitReason).toBe('stop');
    expect(closed[0].realizedPnl).toBeCloseTo(-104);
    expect(closed[0].realizedR).toBeCloseTo(-1.04);
  });

  it('closes remaining open trades at the end of the test', () => {
    const tradeSetup = setup();
    const candles = [candle(0, 1.1), candle(1, 1.1), candle(2, 1.105, 1.11, 1.1, 1.106)];
    const plan = buildHistoricalExecutionPlan(tradeSetup, candles, execution);
    const manager = new HistoricalTradeManager(execution);
    manager.openTrade(tradeSetup, plan, 10000, 1);

    const closed = manager.closeAtEnd(candles[2]);

    expect(closed[0].exitReason).toBe('end_of_test');
    expect(closed[0].exitTimestamp).toBe(candles[2].timestamp);
  });

  it('requires and uses fixed units when that sizing method is selected', () => {
    const tradeSetup = setup();
    const candles = [candle(0, 1.1), candle(1, 1.1)];
    const plan = buildHistoricalExecutionPlan(tradeSetup, candles, execution);
    const manager = new HistoricalTradeManager({ ...execution, positionSizingMethod: 'fixed_units' });

    expect(() => manager.openTrade(tradeSetup, plan, 10000, 1)).toThrow('Fixed position units');
    const trade = manager.openTrade(tradeSetup, plan, 10000, 1, 2500);
    expect(trade?.positionSize).toBe(2500);
  });
});
