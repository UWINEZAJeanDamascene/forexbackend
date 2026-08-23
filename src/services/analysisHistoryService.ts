import { prisma } from '../database/prisma';
import { ANALYSIS_ENGINE_VERSION } from '@shared/constants/analysisEngineVersion';
import { SaveAnalysisRequest, AnalysisHistoryResponse, AnalysisDetailResponse } from '@shared/types/analysisHistory';
import { createLogger } from '../utils/logger';

const logger = createLogger('analysisHistory');

export interface ListHistoryOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  symbol?: string;
  timeframe?: string;
  trend?: string;
  startDate?: string;
  endDate?: string;
  minConfidence?: number;
  maxConfidence?: number;
}

function buildAnalysisData(request: SaveAnalysisRequest) {
  const data: Record<string, unknown> = {
    symbol: request.symbol,
    timeframe: request.timeframe,
    status: request.status ?? 'complete',
    snapshotKey: request.marketDataTimestamp ? `${request.symbol}:${request.timeframe}:${request.marketDataTimestamp}` : null,
    historicalCandles: request.historicalCandles ?? null,
    analysisTimestamp: new Date(request.analysisTimestamp),
    currentPrice: request.currentPrice,
    dataProvider: request.dataProvider,
    trend: request.trend,
    momentum: request.momentum,
    volatility: request.volatility,
    structureTrend: request.structureTrend,
    higherHighsCount: request.higherHighsCount,
    higherLowsCount: request.higherLowsCount,
    lowerHighsCount: request.lowerHighsCount,
    lowerLowsCount: request.lowerLowsCount,
    confidenceScore: request.confidenceScore,
    aiAvailable: request.aiAvailable ?? false,
    engineVersion: ANALYSIS_ENGINE_VERSION,
  };

  if (request.marketDataTimestamp) data.marketDataTimestamp = new Date(request.marketDataTimestamp);
  if (request.dataFreshnessMs !== undefined) data.dataFreshnessMs = request.dataFreshnessMs;
  if (request.trendStrength) data.trendStrength = request.trendStrength;
  if (request.trendScore !== undefined) data.trendScore = request.trendScore;
  if (request.trendFactors) data.trendFactors = request.trendFactors;
  if (request.momentumScore !== undefined) data.momentumScore = request.momentumScore;
  if (request.momentumStrength) data.momentumStrength = request.momentumStrength;
  if (request.volatilityClassification) data.volatilityClassification = request.volatilityClassification;
  if (request.volatilityScore !== undefined) data.volatilityScore = request.volatilityScore;
  if (request.structureTrendQualifier) data.structureTrendQualifier = request.structureTrendQualifier;
  if (request.confidenceBand) data.confidenceBand = request.confidenceBand;
  if (request.tradeQualityVerdict) data.tradeQualityVerdict = request.tradeQualityVerdict;
  if (request.tradeQualityReasons) data.tradeQualityReasons = request.tradeQualityReasons;
  if (request.setupName) data.setupName = request.setupName;
  if (request.setupDirection) data.setupDirection = request.setupDirection;
  if (request.setupStrength !== undefined) data.setupStrength = request.setupStrength;
  if (request.setupConditionsMet) data.setupConditionsMet = request.setupConditionsMet;
  if (request.setupConditionsMissing) data.setupConditionsMissing = request.setupConditionsMissing;
  if (request.setupInvalidation) data.setupInvalidation = request.setupInvalidation;
  if (request.setups) data.setups = request.setups;
  if (request.aiExplanation) data.aiExplanation = request.aiExplanation;
  if (request.aiProvider) data.aiProvider = request.aiProvider;
  if (request.aiStructured) data.aiStructured = request.aiStructured;
  if (request.aiDisclaimer) data.aiDisclaimer = request.aiDisclaimer;

  return data;
}

export async function saveAnalysis(request: SaveAnalysisRequest, userId: string): Promise<{ id: string }> {
  try {
    const snapshotKey = request.marketDataTimestamp ? `${request.symbol}:${request.timeframe}:${request.marketDataTimestamp}` : null;
    if (snapshotKey) {
      const existing = await prisma.analysis.findFirst({ where: { userId, snapshotKey }, select: { id: true } });
      if (existing) return existing;
    }

    const result = await prisma.$transaction([
      prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId } }),
      prisma.analysis.create({
        data: {
          ...buildAnalysisData(request),
          userId,
          indicators: request.indicators && request.indicators.length > 0
            ? { create: request.indicators.map((ind) => ({
                type: ind.type,
                period: ind.period ?? null,
                value: ind.value ?? null,
                upperBand: ind.upperBand ?? null,
                middleBand: ind.middleBand ?? null,
                lowerBand: ind.lowerBand ?? null,
                macdLine: ind.macdLine ?? null,
                signalLine: ind.signalLine ?? null,
                histogram: ind.histogram ?? null,
              })) }
            : undefined,
          structureSnapshots: request.structureSnapshot
            ? { create: {
                trend: request.structureSnapshot.trend,
                trendQualifier: request.structureSnapshot.trendQualifier ?? null,
                events: request.structureSnapshot.events ?? undefined,
                latestEventType: request.structureSnapshot.latestEventType ?? null,
                latestEventPrice: request.structureSnapshot.latestEventPrice ?? null,
                latestEventTimestamp: request.structureSnapshot.latestEventTimestamp ? new Date(request.structureSnapshot.latestEventTimestamp) : null,
              } }
            : undefined,
          srLevels: request.srLevels && request.srLevels.length > 0
            ? { create: request.srLevels.map((level) => ({
                type: level.type,
                price: level.price,
                zoneLow: level.zoneLow ?? null,
                zoneHigh: level.zoneHigh ?? null,
                strength: level.strength,
                touches: level.touches ?? null,
                lastReactionTime: level.lastReactionTime ? new Date(level.lastReactionTime) : null,
              })) }
            : undefined,
        },
      }),
    ]);

    return { id: result[1].id };
  } catch (error) {
    logger.error('Failed to save analysis', {
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function listHistory(options: ListHistoryOptions = {}, userId: string): Promise<AnalysisHistoryResponse> {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: any = { userId };

  if (options.search) {
    where.OR = [
      { symbol: { contains: options.search, mode: 'insensitive' } },
      { dataProvider: { contains: options.search, mode: 'insensitive' } },
    ];
  }

  if (options.symbol) {
    where.symbol = options.symbol;
  }

  if (options.timeframe) {
    where.timeframe = options.timeframe;
  }

  if (options.trend) {
    where.trend = options.trend;
  }

  if (options.startDate || options.endDate) {
    const analysisTimestamp: any = {};
    if (options.startDate) analysisTimestamp.gte = new Date(options.startDate);
    if (options.endDate) analysisTimestamp.lte = new Date(options.endDate);
    where.analysisTimestamp = analysisTimestamp;
  }

  if (options.minConfidence !== undefined || options.maxConfidence !== undefined) {
    const confidenceScore: any = {};
    if (options.minConfidence !== undefined) confidenceScore.gte = options.minConfidence;
    if (options.maxConfidence !== undefined) confidenceScore.lte = options.maxConfidence;
    where.confidenceScore = confidenceScore;
  }

  const [analyses, total] = await Promise.all([
    prisma.analysis.findMany({
      where,
      select: {
        id: true,
        symbol: true,
        timeframe: true,
        status: true,
        analysisTimestamp: true,
        currentPrice: true,
        dataProvider: true,
        trend: true,
        confidenceScore: true,
        confidenceBand: true,
        createdAt: true,
      },
      orderBy: { analysisTimestamp: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.analysis.count({ where }),
  ]);

  return {
    analyses: analyses.map((a) => ({
      id: a.id,
      symbol: a.symbol,
      timeframe: a.timeframe,
      status: a.status as AnalysisHistoryResponse['analyses'][number]['status'],
      analysisTimestamp: a.analysisTimestamp.toISOString(),
      currentPrice: a.currentPrice,
      dataProvider: a.dataProvider,
      trend: a.trend,
      confidenceScore: a.confidenceScore,
      confidenceBand: a.confidenceBand ?? undefined,
      createdAt: a.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}

export async function getAnalysisDetail(id: string, userId: string): Promise<AnalysisDetailResponse | null> {
  const analysis = await prisma.analysis.findFirst({
    where: { id, userId },
    include: {
      indicators: true,
      structureSnapshots: {
        take: 1,
      },
      srLevels: true,
    },
  });

  if (!analysis) return null;

  return {
    id: analysis.id,
    symbol: analysis.symbol,
    timeframe: analysis.timeframe,
    status: analysis.status as AnalysisDetailResponse['status'],
    analysisTimestamp: analysis.analysisTimestamp.toISOString(),
    marketDataTimestamp: analysis.marketDataTimestamp?.toISOString() ?? undefined,
    historicalCandles: analysis.historicalCandles as AnalysisDetailResponse['historicalCandles'],
    currentPrice: analysis.currentPrice,
    dataProvider: analysis.dataProvider,
    dataFreshnessMs: analysis.dataFreshnessMs ?? undefined,
    trend: analysis.trend,
    trendStrength: analysis.trendStrength ?? undefined,
    trendScore: analysis.trendScore ?? undefined,
    trendFactors: analysis.trendFactors as Record<string, unknown> | undefined,
    momentum: analysis.momentum,
    momentumScore: analysis.momentumScore ?? undefined,
    momentumStrength: analysis.momentumStrength ?? undefined,
    volatility: analysis.volatility,
    volatilityClassification: analysis.volatilityClassification ?? undefined,
    volatilityScore: analysis.volatilityScore ?? undefined,
    structureTrend: analysis.structureTrend,
    structureTrendQualifier: analysis.structureTrendQualifier ?? undefined,
    higherHighsCount: analysis.higherHighsCount,
    higherLowsCount: analysis.higherLowsCount,
    lowerHighsCount: analysis.lowerHighsCount,
    lowerLowsCount: analysis.lowerLowsCount,
    confidenceScore: analysis.confidenceScore,
    confidenceBand: analysis.confidenceBand ?? undefined,
    tradeQualityVerdict: analysis.tradeQualityVerdict ?? undefined,
    tradeQualityReasons: analysis.tradeQualityReasons as string[] | undefined,
    setupName: analysis.setupName ?? undefined,
    setupDirection: analysis.setupDirection ?? undefined,
    setupStrength: analysis.setupStrength ?? undefined,
    setupConditionsMet: analysis.setupConditionsMet as string[] | undefined,
    setupConditionsMissing: analysis.setupConditionsMissing as string[] | undefined,
    setupInvalidation: analysis.setupInvalidation ?? undefined,
    setups: analysis.setups as Record<string, unknown>[] | undefined,
    aiExplanation: analysis.aiExplanation ?? undefined,
    aiProvider: analysis.aiProvider ?? undefined,
    aiAvailable: analysis.aiAvailable,
    aiStructured: analysis.aiStructured as Record<string, unknown> | undefined,
    aiDisclaimer: analysis.aiDisclaimer ?? undefined,
    engineVersion: analysis.engineVersion ?? undefined,
    indicators: analysis.indicators.map((ind) => ({
      id: ind.id,
      type: ind.type,
      period: ind.period ?? undefined,
      value: ind.value ?? undefined,
      upperBand: ind.upperBand ?? undefined,
      middleBand: ind.middleBand ?? undefined,
      lowerBand: ind.lowerBand ?? undefined,
      macdLine: ind.macdLine ?? undefined,
      signalLine: ind.signalLine ?? undefined,
      histogram: ind.histogram ?? undefined,
    })),
    structureSnapshot: analysis.structureSnapshots[0]
      ? {
          id: analysis.structureSnapshots[0].id,
          trend: analysis.structureSnapshots[0].trend,
          trendQualifier: analysis.structureSnapshots[0].trendQualifier ?? undefined,
          events: analysis.structureSnapshots[0].events as Record<string, unknown>[] | undefined,
          latestEventType: analysis.structureSnapshots[0].latestEventType ?? undefined,
          latestEventPrice: analysis.structureSnapshots[0].latestEventPrice ?? undefined,
          latestEventTimestamp: analysis.structureSnapshots[0].latestEventTimestamp?.toISOString() ?? undefined,
        }
      : undefined,
    srLevels: analysis.srLevels.map((level) => ({
      id: level.id,
      type: level.type,
      price: level.price,
      zoneLow: level.zoneLow ?? undefined,
      zoneHigh: level.zoneHigh ?? undefined,
      strength: level.strength,
      touches: level.touches ?? undefined,
      lastReactionTime: level.lastReactionTime?.toISOString() ?? undefined,
    })),
    createdAt: analysis.createdAt.toISOString(),
    updatedAt: analysis.updatedAt.toISOString(),
  };
}

export async function deleteAnalysis(id: string, userId: string): Promise<boolean> {
  try {
    const owned = await prisma.analysis.findFirst({ where: { id, userId }, select: { id: true } });
    if (!owned) return false;
    await prisma.analysis.delete({ where: { id: owned.id } });
    return true;
  } catch (error) {
    logger.error('Failed to delete analysis', {
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
