import { BacktestConfig, BacktestResult, BacktestRunMetadata, BacktestPeriodResult } from '../../../shared/types/backtest';
import { Timeframe, timeframeToMs } from '../../../shared/constants/instruments';
import { TrendAnalysisResult } from '../../../shared/types/trendAnalysis';
import { loadHistoricalCandles } from './historicalCandleService';
import { analyzeHistoricalDecision } from './historicalAnalysisService';
import { evaluateHistoricalStrategy } from './historicalStrategyEvaluator';
import { buildHistoricalExecutionPlan } from './historicalExecutionService';
import { HistoricalTradeManager } from './historicalTradeManager';
import { BacktestPerformanceTracker, calculateBacktestMetrics } from './backtestPerformanceService';
import { claimNextBacktest, createBacktestRun, isBacktestCancelled, markBacktestFailed, retryBacktest, saveCompletedBacktest, updateBacktestMetadata } from './backtestPersistenceService';
import { getCompletedCandlesAt } from './backtestTimeframeService';

function metadata(config: BacktestConfig, loaded?: Awaited<ReturnType<typeof loadHistoricalCandles>>): BacktestRunMetadata {
  const provider = loaded?.provider ?? config.dataProvider ?? 'pending';
  const source = loaded
    ? `${provider}:getHistoricalData:${loaded.startDate}/${loaded.endDate}${loaded.fallbackUsed ? `;fallbackFrom=${loaded.fallbackFrom ?? 'unknown'}` : ''}`
    : 'provider.getHistoricalData (pending)';
  return {
    dataProvider: provider,
    dataSource: source,
    dataVersion: loaded?.fetchedAt ?? 'pending',
    indicatorParameters: config.indicatorParameters ?? { emaFast: 20, emaSlow: 50, emaTrend: 200, rsi: 14, atr: 14, bollingerPeriod: 20 },
    marketStructureParameters: config.marketStructureParameters ?? { swingWindow: config.strategy.confirmedSwingWindow, confirmedSwingOnly: true },
    executionAssumptions: config.execution,
  };
}

function periodResult(config: BacktestConfig, metrics: BacktestResult['metrics'], trades: BacktestResult['trades'], equityCurve: BacktestResult['equityCurve'], drawdownCurve: BacktestResult['drawdownCurve'], drawdownPeriods: BacktestResult['drawdownPeriods'], warnings: string[]): BacktestPeriodResult {
  return {
    split: config.period.dataSplit ?? 'in_sample',
    start: config.period.start,
    end: config.period.end,
    metrics: metrics!,
    trades,
    equityCurve,
    drawdownCurve,
    drawdownPeriods,
    warnings,
  };
}

export async function startBacktest(config: BacktestConfig, userId: string): Promise<{ id: string }> {
  const created = await createBacktestRun({ userId, config, metadata: metadata(config) });
  void wakeBacktestWorker();
  return created;
}

let workerActive = false;
let workerTimer: NodeJS.Timeout | undefined;

export function initializeBacktestWorker(): void {
  if (!workerTimer) workerTimer = setInterval(() => { void wakeBacktestWorker(); }, 1000);
  void wakeBacktestWorker();
}

async function wakeBacktestWorker(): Promise<void> {
  if (workerActive) return;
  workerActive = true;
  try {
    let job = await claimNextBacktest();
    while (job) {
      await executeBacktest(job.id, job.config);
      job = await claimNextBacktest();
    }
  } catch (error) {
    console.error('[backtest-worker] failed to claim or run a job', error);
  } finally {
    workerActive = false;
  }
}

async function executeBacktest(id: string, config: BacktestConfig): Promise<void> {
  try {
    const loaded = await loadHistoricalCandles(config.symbol, config.timeframe, new Date(config.period.start), new Date(config.period.end), { minCandles: 2 });
    await updateBacktestMetadata(id, metadata(config, loaded));
    const candles = loaded.candles;
    const warnings = loaded.issues.map((issue) => issue.message);
    const higherResolutionData = config.higherResolutionTimeframe
      ? await loadHistoricalCandles(config.symbol, config.higherResolutionTimeframe, new Date(config.period.start), new Date(config.period.end), { minCandles: 2 })
      : undefined;
    if (higherResolutionData) warnings.push(...higherResolutionData.issues.map((issue) => `${config.higherResolutionTimeframe}: ${issue.message}`));
    const higherData = new Map(config.higherTimeframes.map((timeframe) => [timeframe, undefined as Awaited<ReturnType<typeof loadHistoricalCandles>> | undefined]));
    await Promise.all(config.higherTimeframes.map(async (timeframe) => {
      const data = await loadHistoricalCandles(config.symbol, timeframe, new Date(config.period.start), new Date(config.period.end), { minCandles: 2 });
      higherData.set(timeframe, data);
      warnings.push(...data.issues.map((issue) => `${timeframe}: ${issue.message}`));
    }));

    const ranges = splitRanges(config, candles.length);
    let balance = config.initialBalance;
    const periods = ranges.map((range) => {
      const startingBalance = config.period.mode === 'cumulative' ? balance : config.initialBalance;
      const period = runPeriod(config, candles, higherData, higherResolutionData?.candles, range.startIndex, range.endIndex, range.split, warnings, startingBalance);
      if (config.period.mode === 'cumulative') balance = startingBalance + period.metrics.netProfit;
      return period;
    });
    const allTrades = periods.flatMap((period) => period.trades);
    const equityCurve = periods.flatMap((period) => period.equityCurve);
    const drawdownCurve = periods.flatMap((period) => period.drawdownCurve);
    const drawdownPeriods = periods.flatMap((period) => period.drawdownPeriods);
    const metrics = calculateBacktestMetrics(allTrades, equityCurve, config.initialBalance);
    const result = {
      metrics,
      trades: allTrades,
      equityCurve,
      drawdownCurve,
      drawdownPeriods,
      warnings,
      periodResults: periods,
    } satisfies Pick<BacktestResult, 'metrics' | 'trades' | 'equityCurve' | 'drawdownCurve' | 'drawdownPeriods' | 'warnings' | 'periodResults'>;
    if (!(await isBacktestCancelled(id))) await saveCompletedBacktest(id, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!(await retryBacktest(id, message))) await markBacktestFailed(id, message);
  }
}

interface PeriodRange { split: BacktestPeriodResult['split']; startIndex: number; endIndex: number; }

export function splitRanges(config: BacktestConfig, candleCount: number): PeriodRange[] {
  if (config.period.dataSplit) return [{ split: config.period.dataSplit, startIndex: 0, endIndex: candleCount - 1 }];
  const hasPercentages = config.period.inSamplePercent !== undefined || config.period.validationPercent !== undefined || config.period.outOfSamplePercent !== undefined;
  if (!hasPercentages) return [{ split: 'in_sample', startIndex: 0, endIndex: candleCount - 1 }];
  const inSampleEnd = Math.max(0, Math.floor(candleCount * (config.period.inSamplePercent ?? 70) / 100) - 1);
  const validationEnd = Math.max(inSampleEnd, Math.floor(candleCount * ((config.period.inSamplePercent ?? 70) + (config.period.validationPercent ?? 15)) / 100) - 1);
  const ranges: PeriodRange[] = [
    { split: 'in_sample', startIndex: 0, endIndex: inSampleEnd },
    { split: 'validation', startIndex: Math.min(inSampleEnd + 1, candleCount - 1), endIndex: validationEnd },
    { split: 'out_of_sample', startIndex: Math.min(validationEnd + 1, candleCount - 1), endIndex: candleCount - 1 },
  ].filter((range): range is PeriodRange => range.startIndex <= range.endIndex);
  return ranges;
}

export function getPeriodStartingBalances(config: BacktestConfig, periods: BacktestPeriodResult[]): number[] {
  let balance = config.initialBalance;
  return periods.map((period) => {
    const startingBalance = config.period.mode === 'cumulative' ? balance : config.initialBalance;
    if (config.period.mode === 'cumulative') balance += period.metrics.netProfit;
    return startingBalance;
  });
}

function runPeriod(
  config: BacktestConfig,
  candles: Awaited<ReturnType<typeof loadHistoricalCandles>>['candles'],
  higherData: Map<string, Awaited<ReturnType<typeof loadHistoricalCandles>> | undefined>,
  higherResolutionCandles: Awaited<ReturnType<typeof loadHistoricalCandles>>['candles'] | undefined,
  startIndex: number,
  endIndex: number,
  split: BacktestPeriodResult['split'],
  inheritedWarnings: string[],
  startingBalance: number
): BacktestPeriodResult {
  const manager = new HistoricalTradeManager(config.execution);
  const tracker = new BacktestPerformanceTracker(startingBalance);
  const warnings = [...inheritedWarnings];
  const closedTrades = [] as ReturnType<HistoricalTradeManager['getCompletedTrades']>;

  for (let index = startIndex; index <= endIndex; index++) {
    const candle = candles[index];
    try {
      const higherTimeframeTrends: Partial<Record<Timeframe, TrendAnalysisResult>> = {};
      for (const timeframe of config.higherTimeframes) {
        const data = higherData.get(timeframe);
        const completed = data ? getCompletedCandlesAt(data.candles, timeframe, candle.timestamp) : [];
        const latest = completed.at(-1);
        if (latest && data) {
          const sourceIndex = data.candles.findIndex((item) => item.timestamp === latest.timestamp);
          if (sourceIndex >= 0) {
            higherTimeframeTrends[timeframe] = analyzeHistoricalDecision(data.candles, sourceIndex, config.symbol, timeframe, { swingWindow: config.strategy.confirmedSwingWindow }).trend;
          }
        }
      }
      const snapshot = analyzeHistoricalDecision(candles, index, config.symbol, config.timeframe, { swingWindow: config.strategy.confirmedSwingWindow, higherTimeframeTrends });
      const evaluation = evaluateHistoricalStrategy(snapshot, index, candles, config.strategy, config.execution);
      if (evaluation.setup && evaluation.entry.eligible && evaluation.entry.entryIndex !== null && evaluation.entry.entryIndex <= endIndex) {
        const plan = buildHistoricalExecutionPlan(evaluation.setup, candles, config.execution);
        manager.openTrade(evaluation.setup, plan, tracker.getBalance(), config.riskPercent, config.fixedPositionUnits, config.quoteToAccountRate);
      }
    } catch (error) {
      warnings.push(`Historical analysis skipped at ${candle.timestamp}: ${error instanceof Error ? error.message : String(error)}`);
    }
    const candleStart = new Date(candle.timestamp).getTime();
    const candleEnd = candleStart + timeframeToMs(config.timeframe);
    const intrabars = higherResolutionCandles?.filter((item) => {
      const timestamp = new Date(item.timestamp).getTime();
      return timestamp >= candleStart && timestamp < candleEnd;
    }) ?? [];
    const closed = manager.processCandle(index, candle, intrabars);
    closedTrades.push(...closed);
    tracker.recordCandle(candle, manager.getOpenTrades(), closed);
  }

  const lastCandle = candles[endIndex];
  const endClosed = manager.closeAtEnd(lastCandle);
  closedTrades.push(...endClosed);
  if (endClosed.length > 0) tracker.recordCandle(lastCandle, manager.getOpenTrades(), endClosed);
  tracker.finalize(lastCandle.timestamp);
  const trades = [...closedTrades, ...manager.getOpenTrades()];
  const equityCurve = tracker.getEquityCurve();
  const drawdownCurve = tracker.getDrawdownCurve();
  const drawdownPeriods = tracker.getDrawdownPeriods();
  const metrics = calculateBacktestMetrics(trades, equityCurve, startingBalance);
  return periodResult({ ...config, period: { ...config.period, dataSplit: split } }, metrics, trades, equityCurve, drawdownCurve, drawdownPeriods, warnings);
}
