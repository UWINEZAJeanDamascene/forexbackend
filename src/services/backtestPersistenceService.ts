import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';
import { BacktestConfig, BacktestResult, BacktestRunMetadata } from '../../../shared/types/backtest';

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export interface CreateBacktestRunInput {
  userId?: string;
  config: BacktestConfig;
  metadata: BacktestRunMetadata;
  warnings?: string[];
}

export async function createBacktestRun(input: CreateBacktestRunInput): Promise<{ id: string }> {
  if (input.userId) {
    await prisma.user.upsert({ where: { id: input.userId }, update: {}, create: { id: input.userId } });
  }
  const run = await prisma.backtestRun.create({
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

export async function saveCompletedBacktest(
  id: string,
  result: Pick<BacktestResult, 'metrics' | 'trades' | 'equityCurve' | 'drawdownCurve' | 'drawdownPeriods' | 'warnings' | 'periodResults'>
): Promise<void> {
  await prisma.$transaction([
    prisma.backtestRun.update({
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

export async function markBacktestFailed(id: string, error: string): Promise<void> {
  await prisma.backtestRun.update({ where: { id }, data: { status: 'failed', error } });
}

export async function markBacktestRunning(id: string): Promise<void> {
  await prisma.backtestRun.update({ where: { id }, data: { status: 'running', startedAt: new Date(), error: null, nextAttemptAt: null, attempts: { increment: 1 } } });
}

export async function claimNextBacktest(): Promise<{ id: string; config: BacktestConfig } | null> {
  const now = new Date();
  await prisma.backtestRun.updateMany({
    where: { status: 'running', startedAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) } },
    data: { status: 'queued', nextAttemptAt: now, error: 'Recovered after worker interruption.' },
  });
  const candidate = await prisma.backtestRun.findFirst({
    where: { status: 'queued', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    orderBy: { createdAt: 'asc' },
    select: { id: true, config: true },
  });
  if (!candidate) return null;
  const claimed = await prisma.backtestRun.updateMany({ where: { id: candidate.id, status: 'queued' }, data: { status: 'running', startedAt: now, nextAttemptAt: null, error: null, attempts: { increment: 1 } } });
  return claimed.count === 1 ? { id: candidate.id, config: candidate.config as unknown as BacktestConfig } : null;
}

export async function retryBacktest(id: string, error: string): Promise<boolean> {
  const run = await prisma.backtestRun.findUnique({ where: { id }, select: { attempts: true } });
  if (!run || run.attempts >= 3) return false;
  const delayMs = 1000 * 2 ** Math.max(0, run.attempts - 1);
  await prisma.backtestRun.update({ where: { id }, data: { status: 'queued', error, nextAttemptAt: new Date(Date.now() + delayMs), startedAt: null } });
  return true;
}

export async function updateBacktestMetadata(id: string, metadata: BacktestRunMetadata): Promise<void> {
  await prisma.backtestRun.update({
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

export async function getBacktestRun(id: string, userId: string) {
  return prisma.backtestRun.findFirst({ where: { id, userId }, include: { trades: { orderBy: { entryTimestamp: 'asc' } }, equitySnapshots: { orderBy: { timestamp: 'asc' } } } });
}

export async function getBacktestTrade(id: string, userId: string) {
  return prisma.backtestTrade.findFirst({ where: { id, backtest: { userId } } });
}

export async function listBacktestRuns(userId: string) {
  return prisma.backtestRun.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, symbol: true, timeframe: true, strategyName: true, startDate: true, endDate: true, metrics: true, createdAt: true, completedAt: true, error: true } });
}

export async function cancelBacktest(id: string, userId: string): Promise<boolean> {
  const result = await prisma.backtestRun.updateMany({ where: { id, userId, status: { in: ['queued', 'running'] } }, data: { status: 'cancelled', error: 'Cancelled by user.', completedAt: new Date() } });
  return result.count === 1;
}

export async function isBacktestCancelled(id: string): Promise<boolean> {
  const run = await prisma.backtestRun.findUnique({ where: { id }, select: { status: true } });
  return run?.status === 'cancelled';
}