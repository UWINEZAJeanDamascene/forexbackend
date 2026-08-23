import { describe, expect, it, vi } from 'vitest';
import { Candle } from '../../../shared/types/market';
import { BacktestExecutionAssumptions, BacktestStrategyConfig } from '../../../shared/types/backtest';
import { MarketDataProvider } from '../providers/MarketDataProvider';
import { loadHistoricalCandles } from './historicalCandleService';
import { analyzeHistoricalDecision } from './historicalAnalysisService';
import { evaluateHistoricalStrategy } from './historicalStrategyEvaluator';
import { buildHistoricalExecutionPlan } from './historicalExecutionService';
import { HistoricalTradeManager } from './historicalTradeManager';
import { BacktestPerformanceTracker, calculateBacktestMetrics } from './backtestPerformanceService';

const execution: BacktestExecutionAssumptions = {
  entryModel: 'next_candle_open', stopLossModel: 'atr', takeProfitModel: 'risk_reward',
  positionSizingMethod: 'risk_percent', spreadPips: 0, slippagePips: 0, commissionPerTrade: 0,
  atrStopMultiplier: 1, atrTargetMultiplier: 2, riskRewardRatio: 2,
  ambiguousCandlePolicy: 'stop_first', maxOpenTrades: 1,
};

const strategy: BacktestStrategyConfig = {
  name: 'Historical integration', minimumConditions: 0, requiredTrend: 'bullish',
  requireHigherTimeframeAlignment: false, requireMarketStructure: false,
  requireSupportResistance: false, requireMomentum: false, requireVolatility: false,
  confirmedSwingWindow: 2,
};

function candles(): Candle[] {
  return Array.from({ length: 220 }, (_, index) => {
    const close = 1 + index * 0.001;
    return {
      timestamp: new Date(Date.UTC(2025, 0, 1, index)).toISOString(),
      open: close, high: close + 0.0005, low: close - 0.0005, close, volume: null,
    };
  });
}

function provider(data: Candle[]): MarketDataProvider {
  return {
    name: 'integration-provider', getQuote: vi.fn(), getCandles: vi.fn(),
    getHistoricalData: vi.fn().mockResolvedValue(data),
    getSupportedSymbols: () => ['EUR/USD'], getSupportedTimeframes: () => ['1H'],
  };
}

async function runPipeline() {
  const data = await loadHistoricalCandles('EUR/USD', '1H', new Date('2025-01-01T00:00:00.000Z'), new Date('2025-01-10T12:00:00.000Z'), { provider: provider(candles()), minCandles: 200 });
  const decisionIndex = 200;
  const analysis = analyzeHistoricalDecision(data.candles, decisionIndex, 'EUR/USD', '1H', { swingWindow: 2 });
  const evaluation = evaluateHistoricalStrategy(analysis, decisionIndex, data.candles, strategy, execution);
  if (!evaluation.setup || !evaluation.entry.eligible) throw new Error('Expected an eligible historical setup.');
  const plan = buildHistoricalExecutionPlan(evaluation.setup, data.candles, execution);
  const manager = new HistoricalTradeManager(execution);
  const tracker = new BacktestPerformanceTracker(10000);
  manager.openTrade(evaluation.setup, plan, 10000, 1);
  for (let index = 0; index < data.candles.length; index += 1) {
    const closed = manager.processCandle(index, data.candles[index]);
    tracker.recordCandle(data.candles[index], manager.getOpenTrades(), closed);
  }
  const closedAtEnd = manager.closeAtEnd(data.candles.at(-1)!);
  if (closedAtEnd.length > 0) tracker.recordCandle(data.candles.at(-1)!, manager.getOpenTrades(), closedAtEnd);
  tracker.finalize(data.candles.at(-1)!.timestamp);
  const trades = [...manager.getCompletedTrades(), ...manager.getOpenTrades()];
  return { metrics: calculateBacktestMetrics(trades, tracker.getEquityCurve(), 10000), trades, equity: tracker.getEquityCurve() };
}

describe('historical backtest pipeline integration', () => {
  it('loads provider candles through analysis, execution, lifecycle, and final metrics', async () => {
    const result = await runPipeline();
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].result).not.toBe('open');
    expect(result.metrics.totalTrades).toBe(1);
    expect(result.metrics.completedTrades).toBe(1);
    expect(result.equity.length).toBeGreaterThan(0);
  });

  it('produces deterministic results for identical historical input', async () => {
    const first = await runPipeline();
    const second = await runPipeline();
    const withoutRuntimeTimestamps = (value: unknown) => JSON.parse(JSON.stringify(value, (key, nestedValue) => key === 'analyzedAt' ? undefined : nestedValue));
    expect(withoutRuntimeTimestamps(second)).toEqual(withoutRuntimeTimestamps(first));
  });
});
