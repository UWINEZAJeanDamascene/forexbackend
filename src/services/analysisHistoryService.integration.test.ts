import crypto from 'crypto';
import { describe, expect, it, afterAll } from 'vitest';
import { prisma } from '../database/prisma';
import { deleteAnalysis, getAnalysisDetail, listHistory, saveAnalysis } from './analysisHistoryService';

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === 'true';

const payload = (marketDataTimestamp: string) => ({
  symbol: 'EUR/USD',
  timeframe: '1H',
  status: 'complete' as const,
  analysisTimestamp: '2026-08-23T10:00:00.000Z',
  marketDataTimestamp,
  currentPrice: 1.1234,
  dataProvider: 'integration-test',
  trend: 'bullish',
  momentum: 'bullish',
  volatility: 'normal',
  structureTrend: 'bullish',
  higherHighsCount: 2,
  higherLowsCount: 2,
  lowerHighsCount: 0,
  lowerLowsCount: 0,
  confidenceScore: 72,
  indicators: [{ type: 'EMA', period: 20, value: 1.1220 }],
  structureSnapshot: { trend: 'bullish', events: [{ type: 'higher_high', price: 1.1240 }] },
  srLevels: [{ type: 'support', price: 1.1200, zoneLow: 1.1190, zoneHigh: 1.1210, strength: 80 }],
  historicalCandles: [
    { timestamp: '2026-08-23T08:00:00.000Z', open: 1.12, high: 1.125, low: 1.119, close: 1.123 },
    { timestamp: '2026-08-23T09:00:00.000Z', open: 1.123, high: 1.124, low: 1.121, close: 1.1234 },
  ],
});

describe.skipIf(!runDatabaseTests)('analysis history PostgreSQL integration', () => {
  const ownerId = crypto.randomUUID();
  const otherOwnerId = crypto.randomUUID();
  const marketDataTimestamp = '2026-08-23T09:00:00.000Z';

  afterAll(async () => {
    await prisma.analysis.deleteMany({ where: { userId: { in: [ownerId, otherOwnerId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherOwnerId] } } });
    await prisma.$disconnect();
  });

  it('persists snapshots, deduplicates them, and enforces ownership', async () => {
    const first = await saveAnalysis(payload(marketDataTimestamp), ownerId);
    const duplicate = await saveAnalysis(payload(marketDataTimestamp), ownerId);
    expect(duplicate.id).toBe(first.id);

    const list = await listHistory({ page: 1, pageSize: 20 }, ownerId);
    expect(list.total).toBe(1);

    const detail = await getAnalysisDetail(first.id, ownerId);
    expect(detail?.status).toBe('complete');
    expect(detail?.indicators[0]?.value).toBe(1.122);
    expect(detail?.structureSnapshot?.events?.[0]?.type).toBe('higher_high');
    expect(detail?.srLevels[0]?.price).toBe(1.12);
    expect(detail?.historicalCandles).toHaveLength(2);
    expect(detail?.historicalCandles?.[0]?.close).toBe(1.123);

    expect(await getAnalysisDetail(first.id, otherOwnerId)).toBeNull();
    expect(await deleteAnalysis(first.id, otherOwnerId)).toBe(false);
    expect(await deleteAnalysis(first.id, ownerId)).toBe(true);
  });
});