"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBacktest = startBacktest;
exports.initializeBacktestWorker = initializeBacktestWorker;
exports.splitRanges = splitRanges;
exports.getPeriodStartingBalances = getPeriodStartingBalances;
const instruments_1 = require("../../../shared/constants/instruments");
const historicalCandleService_1 = require("./historicalCandleService");
const historicalAnalysisService_1 = require("./historicalAnalysisService");
const historicalStrategyEvaluator_1 = require("./historicalStrategyEvaluator");
const historicalExecutionService_1 = require("./historicalExecutionService");
const historicalTradeManager_1 = require("./historicalTradeManager");
const backtestPerformanceService_1 = require("./backtestPerformanceService");
const backtestPersistenceService_1 = require("./backtestPersistenceService");
const backtestTimeframeService_1 = require("./backtestTimeframeService");
function metadata(config, loaded) {
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
function periodResult(config, metrics, trades, equityCurve, drawdownCurve, drawdownPeriods, warnings) {
    return {
        split: config.period.dataSplit ?? 'in_sample',
        start: config.period.start,
        end: config.period.end,
        metrics: metrics,
        trades,
        equityCurve,
        drawdownCurve,
        drawdownPeriods,
        warnings,
    };
}
async function startBacktest(config, userId) {
    const created = await (0, backtestPersistenceService_1.createBacktestRun)({ userId, config, metadata: metadata(config) });
    void wakeBacktestWorker();
    return created;
}
let workerActive = false;
let workerTimer;
function initializeBacktestWorker() {
    if (!workerTimer)
        workerTimer = setInterval(() => { void wakeBacktestWorker(); }, 1000);
    void wakeBacktestWorker();
}
async function wakeBacktestWorker() {
    if (workerActive)
        return;
    workerActive = true;
    try {
        let job = await (0, backtestPersistenceService_1.claimNextBacktest)();
        while (job) {
            await executeBacktest(job.id, job.config);
            job = await (0, backtestPersistenceService_1.claimNextBacktest)();
        }
    }
    catch (error) {
        console.error('[backtest-worker] failed to claim or run a job', error);
    }
    finally {
        workerActive = false;
    }
}
async function executeBacktest(id, config) {
    try {
        const loaded = await (0, historicalCandleService_1.loadHistoricalCandles)(config.symbol, config.timeframe, new Date(config.period.start), new Date(config.period.end), { minCandles: 2 });
        await (0, backtestPersistenceService_1.updateBacktestMetadata)(id, metadata(config, loaded));
        const candles = loaded.candles;
        const warnings = loaded.issues.map((issue) => issue.message);
        const higherResolutionData = config.higherResolutionTimeframe
            ? await (0, historicalCandleService_1.loadHistoricalCandles)(config.symbol, config.higherResolutionTimeframe, new Date(config.period.start), new Date(config.period.end), { minCandles: 2 })
            : undefined;
        if (higherResolutionData)
            warnings.push(...higherResolutionData.issues.map((issue) => `${config.higherResolutionTimeframe}: ${issue.message}`));
        const higherData = new Map(config.higherTimeframes.map((timeframe) => [timeframe, undefined]));
        await Promise.all(config.higherTimeframes.map(async (timeframe) => {
            const data = await (0, historicalCandleService_1.loadHistoricalCandles)(config.symbol, timeframe, new Date(config.period.start), new Date(config.period.end), { minCandles: 2 });
            higherData.set(timeframe, data);
            warnings.push(...data.issues.map((issue) => `${timeframe}: ${issue.message}`));
        }));
        const ranges = splitRanges(config, candles.length);
        let balance = config.initialBalance;
        const periods = ranges.map((range) => {
            const startingBalance = config.period.mode === 'cumulative' ? balance : config.initialBalance;
            const period = runPeriod(config, candles, higherData, higherResolutionData?.candles, range.startIndex, range.endIndex, range.split, warnings, startingBalance);
            if (config.period.mode === 'cumulative')
                balance = startingBalance + period.metrics.netProfit;
            return period;
        });
        const allTrades = periods.flatMap((period) => period.trades);
        const equityCurve = periods.flatMap((period) => period.equityCurve);
        const drawdownCurve = periods.flatMap((period) => period.drawdownCurve);
        const drawdownPeriods = periods.flatMap((period) => period.drawdownPeriods);
        const metrics = (0, backtestPerformanceService_1.calculateBacktestMetrics)(allTrades, equityCurve, config.initialBalance);
        const result = {
            metrics,
            trades: allTrades,
            equityCurve,
            drawdownCurve,
            drawdownPeriods,
            warnings,
            periodResults: periods,
        };
        if (!(await (0, backtestPersistenceService_1.isBacktestCancelled)(id)))
            await (0, backtestPersistenceService_1.saveCompletedBacktest)(id, result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!(await (0, backtestPersistenceService_1.retryBacktest)(id, message)))
            await (0, backtestPersistenceService_1.markBacktestFailed)(id, message);
    }
}
function splitRanges(config, candleCount) {
    if (config.period.dataSplit)
        return [{ split: config.period.dataSplit, startIndex: 0, endIndex: candleCount - 1 }];
    const hasPercentages = config.period.inSamplePercent !== undefined || config.period.validationPercent !== undefined || config.period.outOfSamplePercent !== undefined;
    if (!hasPercentages)
        return [{ split: 'in_sample', startIndex: 0, endIndex: candleCount - 1 }];
    const inSampleEnd = Math.max(0, Math.floor(candleCount * (config.period.inSamplePercent ?? 70) / 100) - 1);
    const validationEnd = Math.max(inSampleEnd, Math.floor(candleCount * ((config.period.inSamplePercent ?? 70) + (config.period.validationPercent ?? 15)) / 100) - 1);
    const ranges = [
        { split: 'in_sample', startIndex: 0, endIndex: inSampleEnd },
        { split: 'validation', startIndex: Math.min(inSampleEnd + 1, candleCount - 1), endIndex: validationEnd },
        { split: 'out_of_sample', startIndex: Math.min(validationEnd + 1, candleCount - 1), endIndex: candleCount - 1 },
    ].filter((range) => range.startIndex <= range.endIndex);
    return ranges;
}
function getPeriodStartingBalances(config, periods) {
    let balance = config.initialBalance;
    return periods.map((period) => {
        const startingBalance = config.period.mode === 'cumulative' ? balance : config.initialBalance;
        if (config.period.mode === 'cumulative')
            balance += period.metrics.netProfit;
        return startingBalance;
    });
}
function runPeriod(config, candles, higherData, higherResolutionCandles, startIndex, endIndex, split, inheritedWarnings, startingBalance) {
    const manager = new historicalTradeManager_1.HistoricalTradeManager(config.execution);
    const tracker = new backtestPerformanceService_1.BacktestPerformanceTracker(startingBalance);
    const warnings = [...inheritedWarnings];
    const closedTrades = [];
    for (let index = startIndex; index <= endIndex; index++) {
        const candle = candles[index];
        try {
            const higherTimeframeTrends = {};
            for (const timeframe of config.higherTimeframes) {
                const data = higherData.get(timeframe);
                const completed = data ? (0, backtestTimeframeService_1.getCompletedCandlesAt)(data.candles, timeframe, candle.timestamp) : [];
                const latest = completed.at(-1);
                if (latest && data) {
                    const sourceIndex = data.candles.findIndex((item) => item.timestamp === latest.timestamp);
                    if (sourceIndex >= 0) {
                        higherTimeframeTrends[timeframe] = (0, historicalAnalysisService_1.analyzeHistoricalDecision)(data.candles, sourceIndex, config.symbol, timeframe, { swingWindow: config.strategy.confirmedSwingWindow }).trend;
                    }
                }
            }
            const snapshot = (0, historicalAnalysisService_1.analyzeHistoricalDecision)(candles, index, config.symbol, config.timeframe, { swingWindow: config.strategy.confirmedSwingWindow, higherTimeframeTrends });
            const evaluation = (0, historicalStrategyEvaluator_1.evaluateHistoricalStrategy)(snapshot, index, candles, config.strategy, config.execution);
            if (evaluation.setup && evaluation.entry.eligible && evaluation.entry.entryIndex !== null && evaluation.entry.entryIndex <= endIndex) {
                const plan = (0, historicalExecutionService_1.buildHistoricalExecutionPlan)(evaluation.setup, candles, config.execution);
                manager.openTrade(evaluation.setup, plan, tracker.getBalance(), config.riskPercent, config.fixedPositionUnits, config.quoteToAccountRate);
            }
        }
        catch (error) {
            warnings.push(`Historical analysis skipped at ${candle.timestamp}: ${error instanceof Error ? error.message : String(error)}`);
        }
        const candleStart = new Date(candle.timestamp).getTime();
        const candleEnd = candleStart + (0, instruments_1.timeframeToMs)(config.timeframe);
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
    if (endClosed.length > 0)
        tracker.recordCandle(lastCandle, manager.getOpenTrades(), endClosed);
    tracker.finalize(lastCandle.timestamp);
    const trades = [...closedTrades, ...manager.getOpenTrades()];
    const equityCurve = tracker.getEquityCurve();
    const drawdownCurve = tracker.getDrawdownCurve();
    const drawdownPeriods = tracker.getDrawdownPeriods();
    const metrics = (0, backtestPerformanceService_1.calculateBacktestMetrics)(trades, equityCurve, startingBalance);
    return periodResult({ ...config, period: { ...config.period, dataSplit: split } }, metrics, trades, equityCurve, drawdownCurve, drawdownPeriods, warnings);
}
//# sourceMappingURL=backtestService.js.map