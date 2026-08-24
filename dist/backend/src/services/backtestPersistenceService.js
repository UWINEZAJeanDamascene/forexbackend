"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBacktestRun = createBacktestRun;
exports.saveCompletedBacktest = saveCompletedBacktest;
exports.markBacktestFailed = markBacktestFailed;
exports.markBacktestRunning = markBacktestRunning;
exports.claimNextBacktest = claimNextBacktest;
exports.retryBacktest = retryBacktest;
exports.updateBacktestMetadata = updateBacktestMetadata;
exports.getBacktestRun = getBacktestRun;
exports.getBacktestTrade = getBacktestTrade;
exports.listBacktestRuns = listBacktestRuns;
exports.cancelBacktest = cancelBacktest;
exports.isBacktestCancelled = isBacktestCancelled;
const prisma_1 = require("../database/prisma");
function json(value) {
    return value;
}
async function createBacktestRun(input) {
    if (input.userId) {
        await prisma_1.prisma.user.upsert({ where: { id: input.userId }, update: {}, create: { id: input.userId } });
    }
    const run = await prisma_1.prisma.backtestRun.create({
        data: {
            userId: input.userId,
            status: 'queued',
            symbol: input.config.symbol,
            timeframe: input.config.timeframe,
            startDate: new Date(input.config.period.start),
            endDate: new Date(input.config.period.end),
            strategyName: input.config.strategy.name,
            config: json(input.config),
            dataProvider: input.metadata.dataProvider,
            dataSource: input.metadata.dataSource,
            dataVersion: input.metadata.dataVersion,
            indicatorParameters: json(input.metadata.indicatorParameters),
            marketStructureParameters: json(input.metadata.marketStructureParameters),
            executionAssumptions: json(input.metadata.executionAssumptions),
            initialBalance: input.config.initialBalance,
            riskPercent: input.config.riskPercent,
            warnings: json(input.warnings ?? []),
        },
        select: { id: true },
    });
    return run;
}
async function saveCompletedBacktest(id, result) {
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.backtestRun.update({
            where: { id },
            data: {
                status: 'completed',
                metrics: result.metrics ? json(result.metrics) : undefined,
                equityCurve: json(result.equityCurve),
                drawdownCurve: json(result.drawdownCurve),
                periodResults: json(result.periodResults),
                warnings: json(result.warnings),
                completedAt: new Date(),
                trades: {
                    create: result.trades.map((trade) => ({
                        symbol: trade.symbol,
                        timeframe: trade.timeframe,
                        direction: trade.direction,
                        setupTimestamp: new Date(trade.setupTimestamp),
                        entryTimestamp: new Date(trade.entryTimestamp),
                        exitTimestamp: trade.exitTimestamp ? new Date(trade.exitTimestamp) : null,
                        entryPrice: trade.entryPrice,
                        stopPrice: trade.stopPrice,
                        targetPrice: trade.targetPrice,
                        exitPrice: trade.exitPrice,
                        positionSize: trade.positionSize,
                        plannedRiskReward: trade.plannedRiskReward,
                        realizedPnl: trade.realizedPnl,
                        realizedR: trade.realizedR,
                        result: trade.result,
                        holdingMinutes: trade.holdingMinutes,
                        exitReason: trade.exitReason,
                        setupConditions: json(trade.setupConditions),
                        setupSnapshot: json(trade.setupSnapshot),
                    })),
                },
                equitySnapshots: {
                    create: result.equityCurve.map((point) => ({
                        timestamp: new Date(point.timestamp),
                        balance: point.balance,
                        equity: point.equity,
                        peakEquity: point.peakEquity,
                        drawdown: point.drawdown,
                        drawdownPercent: point.drawdownPercent,
                    })),
                },
            },
        }),
    ]);
}
async function markBacktestFailed(id, error) {
    await prisma_1.prisma.backtestRun.update({ where: { id }, data: { status: 'failed', error } });
}
async function markBacktestRunning(id) {
    await prisma_1.prisma.backtestRun.update({ where: { id }, data: { status: 'running', startedAt: new Date(), error: null, nextAttemptAt: null, attempts: { increment: 1 } } });
}
async function claimNextBacktest() {
    const now = new Date();
    await prisma_1.prisma.backtestRun.updateMany({
        where: { status: 'running', startedAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) } },
        data: { status: 'queued', nextAttemptAt: now, error: 'Recovered after worker interruption.' },
    });
    const candidate = await prisma_1.prisma.backtestRun.findFirst({
        where: { status: 'queued', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        orderBy: { createdAt: 'asc' },
        select: { id: true, config: true },
    });
    if (!candidate)
        return null;
    const claimed = await prisma_1.prisma.backtestRun.updateMany({ where: { id: candidate.id, status: 'queued' }, data: { status: 'running', startedAt: now, nextAttemptAt: null, error: null, attempts: { increment: 1 } } });
    return claimed.count === 1 ? { id: candidate.id, config: candidate.config } : null;
}
async function retryBacktest(id, error) {
    const run = await prisma_1.prisma.backtestRun.findUnique({ where: { id }, select: { attempts: true } });
    if (!run || run.attempts >= 3)
        return false;
    const delayMs = 1000 * 2 ** Math.max(0, run.attempts - 1);
    await prisma_1.prisma.backtestRun.update({ where: { id }, data: { status: 'queued', error, nextAttemptAt: new Date(Date.now() + delayMs), startedAt: null } });
    return true;
}
async function updateBacktestMetadata(id, metadata) {
    await prisma_1.prisma.backtestRun.update({
        where: { id },
        data: {
            dataProvider: metadata.dataProvider,
            dataSource: metadata.dataSource,
            dataVersion: metadata.dataVersion,
            indicatorParameters: json(metadata.indicatorParameters),
            marketStructureParameters: json(metadata.marketStructureParameters),
            executionAssumptions: json(metadata.executionAssumptions),
        },
    });
}
async function getBacktestRun(id, userId) {
    return prisma_1.prisma.backtestRun.findFirst({ where: { id, userId }, include: { trades: { orderBy: { entryTimestamp: 'asc' } }, equitySnapshots: { orderBy: { timestamp: 'asc' } } } });
}
async function getBacktestTrade(id, userId) {
    return prisma_1.prisma.backtestTrade.findFirst({ where: { id, backtest: { userId } } });
}
async function listBacktestRuns(userId) {
    return prisma_1.prisma.backtestRun.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, symbol: true, timeframe: true, strategyName: true, startDate: true, endDate: true, metrics: true, createdAt: true, completedAt: true, error: true } });
}
async function cancelBacktest(id, userId) {
    const result = await prisma_1.prisma.backtestRun.updateMany({ where: { id, userId, status: { in: ['queued', 'running'] } }, data: { status: 'cancelled', error: 'Cancelled by user.', completedAt: new Date() } });
    return result.count === 1;
}
async function isBacktestCancelled(id) {
    const run = await prisma_1.prisma.backtestRun.findUnique({ where: { id }, select: { status: true } });
    return run?.status === 'cancelled';
}
//# sourceMappingURL=backtestPersistenceService.js.map