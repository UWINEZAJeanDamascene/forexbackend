import { describe, expect, it } from 'vitest';
import { Candle } from '../../../shared/types/market';
import { BacktestExecutionAssumptions, BacktestStrategyConfig, HistoricalDecisionAnalysis } from '../../../shared/types/backtest';
import { evaluateHistoricalStrategy, getEntryEligibility } from './historicalStrategyEvaluator';
import { analyzeHistoricalDecision } from './historicalAnalysisService';

function candle(index: number): Candle {
  const close = 1 + index * 0.001;
  return {
    timestamp: new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
    open: close,
    high: close + 0.001,
    low: close - 0.001,
    close,
    volume: null,
  };
}

const execution: BacktestExecutionAssumptions = {
  entryModel: 'next_candle_open',
  stopLossModel: 'atr',
  takeProfitModel: 'risk_reward',
  positionSizingMethod: 'risk_percent',
  spreadPips: 0,
  slippagePips: 0,
  commissionPerTrade: 0,
  atrStopMultiplier: 1,
  atrTargetMultiplier: 2,
  riskRewardRatio: 2,
  ambiguousCandlePolicy: 'stop_first',
  maxOpenTrades: 1,
};

const strategy: BacktestStrategyConfig = {
  name: 'Trend test',
  minimumConditions: 2,
  requiredTrend: 'bullish',
  requireHigherTimeframeAlignment: false,
  requireMarketStructure: true,
  requireSupportResistance: false,
  requireMomentum: true,
  requireVolatility: false,
  confirmedSwingWindow: 2,
};

function snapshot(): HistoricalDecisionAnalysis {
  return {
    symbol: 'EUR/USD',
    timeframe: '1H',
    decisionIndex: 2,
    decisionTimestamp: candle(2).timestamp,
    candlesThroughDecision: [candle(0), candle(1), candle(2)],
    indicators: {} as HistoricalDecisionAnalysis['indicators'],
    trend: { trend: 'bullish', currentPrice: 1.002 } as HistoricalDecisionAnalysis['trend'],
    structure: { trend: 'bullish' } as HistoricalDecisionAnalysis['structure'],
    supportResistance: { supports: [], resistances: [], tested: [] },
    momentum: { momentum: 'bullish' } as HistoricalDecisionAnalysis['momentum'],
    volatility: { dataQuality: { sufficient: false }, classification: 'normal' } as HistoricalDecisionAnalysis['volatility'],
    higherTimeframeTrends: {},
  };
}

describe('historical strategy evaluator', () => {
  it('records the conditions that qualified a configurable strategy', () => {
    const result = evaluateHistoricalStrategy(snapshot(), 2, [candle(0), candle(1), candle(2), candle(3)], strategy, execution);

    expect(result.setup?.direction).toBe('bullish');
    expect(result.setup?.conditionsMet).toEqual(['Trend: bullish', 'Market structure: bullish', 'Momentum: bullish']);
    expect(result.setup?.conditionsMissing).toEqual([]);
    expect(result.entry.eligible).toBe(true);
    expect(result.entry.entryIndex).toBe(3);
  });

  it('does not make a next-candle entry eligible at the end of history', () => {
    const result = getEntryEligibility(2, [candle(0), candle(1), candle(2)], 'next_candle_open');
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('No next candle');
  });

  it('supports signal-close entry eligibility', () => {
    const result = getEntryEligibility(1, [candle(0), candle(1), candle(2)], 'signal_close');
    expect(result.eligible).toBe(true);
    expect(result.entryIndex).toBe(1);
    expect(result.entryTimestamp).toBe(candle(1).timestamp);
  });

  it('does not silently execute a price-level model without an entry level', () => {
    const result = getEntryEligibility(1, [candle(0), candle(1), candle(2)], 'price_level');
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('positive entry price level');
  });

  it('executes a price-level entry on the first candle that reaches the level', () => {
    const candles = [candle(0), candle(1), { ...candle(2), low: 1.004, high: 1.01 }, candle(3)];
    const result = getEntryEligibility(1, candles, 'price_level', 1.005);
    expect(result.eligible).toBe(true);
    expect(result.entryIndex).toBe(2);
    expect(result.entryTimestamp).toBe(candles[2].timestamp);
  });

  it('keeps an earlier setup decision unchanged when future candles change', () => {
    const candles = Array.from({ length: 80 }, (_, index) => candle(index));
    const before = analyzeHistoricalDecision(candles, 59, 'EUR/USD', '1H', { swingWindow: 2 });
    const beforeSetup = evaluateHistoricalStrategy(before, 59, candles, { ...strategy, minimumConditions: 1, requireMarketStructure: false, requireMomentum: false }, execution).setup;

    candles[70].high = 99;
    candles[70].low = 0.1;
    candles[79].close = 50;
    const after = analyzeHistoricalDecision(candles, 59, 'EUR/USD', '1H', { swingWindow: 2 });
    const afterSetup = evaluateHistoricalStrategy(after, 59, candles, { ...strategy, minimumConditions: 1, requireMarketStructure: false, requireMomentum: false }, execution).setup;

    expect(afterSetup?.direction).toBe(beforeSetup?.direction);
    expect(afterSetup?.conditionsMet).toEqual(beforeSetup?.conditionsMet);
    expect(afterSetup?.conditionsMissing).toEqual(beforeSetup?.conditionsMissing);
  });
});
