import { describe, expect, it } from 'vitest';
import { Candle } from '../../../shared/types/market';
import { BacktestExecutionAssumptions, BacktestSetupRecord } from '../../../shared/types/backtest';
import { buildHistoricalExecutionPlan, calculateHistoricalPositionSize } from './historicalExecutionService';

function candle(index: number, open = 1.1): Candle {
  return {
    timestamp: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
    open,
    high: open + 0.01,
    low: open - 0.01,
    close: open,
    volume: null,
  };
}

function setup(overrides: Partial<BacktestSetupRecord['snapshot']> = {}): BacktestSetupRecord {
  return {
    timestamp: candle(0).timestamp,
    direction: 'bullish',
    entryPrice: 1.1,
    conditionsMet: ['Trend: bullish'],
    conditionsMissing: [],
    snapshot: {
      symbol: 'EUR/USD',
      timeframe: '1H',
      decisionIndex: 0,
      decisionTimestamp: candle(0).timestamp,
      candlesThroughDecision: [candle(0)],
      indicators: { atr14: [0.01] } as BacktestSetupRecord['snapshot']['indicators'],
      trend: { currentPrice: 1.1, trend: 'bullish' } as BacktestSetupRecord['snapshot']['trend'],
      structure: { trend: 'bullish', swingLows: [], swingHighs: [] } as BacktestSetupRecord['snapshot']['structure'],
      supportResistance: { supports: [], resistances: [], tested: [] },
      momentum: {} as BacktestSetupRecord['snapshot']['momentum'],
      volatility: {} as BacktestSetupRecord['snapshot']['volatility'],
      higherTimeframeTrends: {},
      ...overrides,
    },
  };
}

function execution(overrides: Partial<BacktestExecutionAssumptions> = {}): BacktestExecutionAssumptions {
  return {
    entryModel: 'next_candle_open',
    stopLossModel: 'atr',
    takeProfitModel: 'risk_reward',
    positionSizingMethod: 'risk_percent',
    spreadPips: 2,
    slippagePips: 1,
    commissionPerTrade: 0,
    atrStopMultiplier: 1,
    atrTargetMultiplier: 2,
    riskRewardRatio: 2,
    ambiguousCandlePolicy: 'stop_first',
    maxOpenTrades: 1,
    ...overrides,
  };
}

describe('historical execution service', () => {
  it('enters at the next candle open with adverse spread and slippage', () => {
    const result = buildHistoricalExecutionPlan(setup(), [candle(0), candle(1, 1.2)], execution());

    expect(result.entryIndex).toBe(1);
    expect(result.entryPrice).toBeCloseTo(1.20015);
    expect(result.stopPrice).toBeCloseTo(1.19015);
    expect(result.targetPrice).toBeCloseTo(1.22015);
    expect(result.stopFillPrice).toBeCloseTo(1.19);
    expect(result.targetFillPrice).toBeCloseTo(1.22);
    expect(result.plannedRiskReward).toBeCloseTo(2);
  });

  it('uses the nearest confirmed structure level for a stop', () => {
    const result = buildHistoricalExecutionPlan(
      setup({ structure: { trend: 'bullish', swingLows: [{ price: 1.18 }], swingHighs: [] } as BacktestSetupRecord['snapshot']['structure'] }),
      [candle(0), candle(1, 1.2)],
      execution({ stopLossModel: 'structure' })
    );

    expect(result.stopPrice).toBeCloseTo(1.18);
  });

  it('uses the adverse side of a bearish structure stop', () => {
    const bearishSetup = { ...setup(), direction: 'bearish' as const, entryPrice: 1.1, snapshot: { ...setup().snapshot, trend: { currentPrice: 1.1, trend: 'bearish' } as BacktestSetupRecord['snapshot']['trend'], structure: { trend: 'bearish', swingHighs: [{ price: 1.12 }], swingLows: [] } as BacktestSetupRecord['snapshot']['structure'] } };
    const result = buildHistoricalExecutionPlan(bearishSetup, [candle(0), candle(1, 1.1)], execution({ stopLossModel: 'structure' }));
    expect(result.stopPrice).toBeCloseTo(1.12);
    expect(result.targetPrice).toBeLessThan(result.entryPrice);
  });

  it('supports ATR, fixed-price, and support/resistance target methods', () => {
    const supportResistance = { supports: [{ price: 1.05, zoneLow: 1.04, zoneHigh: 1.06 }], resistances: [{ price: 1.25, zoneLow: 1.24, zoneHigh: 1.26 }], tested: [] } as BacktestSetupRecord['snapshot']['supportResistance'];
    const snapshot = { supportResistance };
    const base = buildHistoricalExecutionPlan(setup(snapshot), [candle(0), candle(1, 1.2)], execution({ takeProfitModel: 'support_resistance' }));
    expect(base.targetPrice).toBeCloseTo(1.24);

    const fixed = buildHistoricalExecutionPlan(setup(), [candle(0), candle(1, 1.2)], execution({ takeProfitModel: 'price', fixedTargetPrice: 1.3 }));
    expect(fixed.targetPrice).toBe(1.3);

    const atr = buildHistoricalExecutionPlan(setup(), [candle(0), candle(1, 1.2)], execution({ takeProfitModel: 'atr', atrTargetMultiplier: 3 }));
    expect(atr.targetPrice).toBeCloseTo(1.23015);
  });

  it('calculates fixed-unit sizing and quote conversion through the execution plan', () => {
    const plan = buildHistoricalExecutionPlan(setup(), [candle(0), candle(1, 1.2)], execution());
    const position = calculateHistoricalPositionSize(setup(), plan, 10000, 1, 2500, 1.2);
    expect(position.units).toBe(2500);
    expect(position.lots).toBeCloseTo(0.025);
    expect(position.riskAmount).toBeCloseTo(plan.riskDistance * 2500 * 1.2);
  });
});
