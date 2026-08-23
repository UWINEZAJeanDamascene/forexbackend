import { Symbol, Timeframe } from '../constants/instruments';
import { Candle } from './market';
import { IndicatorValues } from './indicators';
import { MarketStructureResult } from './marketStructure';
import { SupportResistanceResponse } from './supportResistance';
import { TrendAnalysisResult } from './trendAnalysis';
import { MomentumAnalysisResult } from './momentumAnalysis';
import { VolatilityAnalysisResult } from './volatilityAnalysis';
export type BacktestStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type BacktestDataSplit = 'in_sample' | 'validation' | 'out_of_sample';
export type BacktestPeriodMode = 'independent' | 'cumulative';
export type EntryModel = 'next_candle_open' | 'signal_close' | 'price_level';
export type StopLossModel = 'structure' | 'atr';
export type TakeProfitModel = 'risk_reward' | 'atr' | 'support_resistance' | 'price';
export type PositionSizingMethod = 'risk_percent' | 'fixed_units';
export type AmbiguousCandlePolicy = 'stop_first' | 'target_first' | 'breakeven';
export interface BacktestExecutionAssumptions {
    entryModel: EntryModel;
    stopLossModel: StopLossModel;
    takeProfitModel: TakeProfitModel;
    positionSizingMethod: PositionSizingMethod;
    spreadPips: number;
    slippagePips: number;
    commissionPerTrade: number;
    atrStopMultiplier: number;
    atrTargetMultiplier: number;
    riskRewardRatio: number;
    ambiguousCandlePolicy: AmbiguousCandlePolicy;
    maxOpenTrades: number;
    entryPriceLevel?: number;
    fixedTargetPrice?: number;
}
export declare const DEFAULT_BACKTEST_EXECUTION_ASSUMPTIONS: BacktestExecutionAssumptions;
export interface BacktestStrategyConfig {
    name: string;
    minimumConditions: number;
    requiredTrend?: 'bullish' | 'bearish' | 'neutral';
    requireHigherTimeframeAlignment: boolean;
    requireMarketStructure: boolean;
    requireSupportResistance: boolean;
    requireMomentum: boolean;
    requireVolatility: boolean;
    confirmedSwingWindow: number;
}
export interface BacktestPeriodConfig {
    start: string;
    end: string;
    dataSplit?: BacktestDataSplit;
    inSamplePercent?: number;
    validationPercent?: number;
    outOfSamplePercent?: number;
    mode?: BacktestPeriodMode;
}
export interface BacktestConfig {
    symbol: Symbol;
    timeframe: Timeframe;
    higherResolutionTimeframe?: Timeframe;
    higherTimeframes: Timeframe[];
    period: BacktestPeriodConfig;
    strategy: BacktestStrategyConfig;
    execution: BacktestExecutionAssumptions;
    initialBalance: number;
    riskPercent: number;
    fixedPositionUnits?: number;
    dataProvider?: string;
    accountCurrency?: string;
    quoteToAccountRate?: number;
    indicatorParameters?: Record<string, number>;
    marketStructureParameters?: Record<string, number | boolean>;
}
export interface BacktestRunMetadata {
    dataProvider: string;
    dataSource: string;
    dataVersion: string;
    indicatorParameters: Record<string, number>;
    marketStructureParameters: Record<string, number | boolean>;
    executionAssumptions: BacktestExecutionAssumptions;
}
export interface HistoricalAnalysisSnapshot {
    timestamp: string;
    candles: Candle[];
    indicators: IndicatorValues;
    trend: TrendAnalysisResult;
    structure: MarketStructureResult;
    supportResistance: SupportResistanceResponse;
    higherTimeframeTrends: Partial<Record<Timeframe, TrendAnalysisResult>>;
}
export interface HistoricalDecisionAnalysis {
    symbol: Symbol;
    timeframe: Timeframe;
    decisionIndex: number;
    decisionTimestamp: string;
    candlesThroughDecision: Candle[];
    indicators: IndicatorValues;
    trend: TrendAnalysisResult;
    structure: MarketStructureResult;
    supportResistance: SupportResistanceResponse;
    momentum: MomentumAnalysisResult;
    volatility: VolatilityAnalysisResult;
    higherTimeframeTrends: Partial<Record<Timeframe, TrendAnalysisResult>>;
}
export interface BacktestSetupRecord {
    timestamp: string;
    direction: 'bullish' | 'bearish';
    entryPrice: number;
    conditionsMet: string[];
    conditionsMissing: string[];
    snapshot: HistoricalDecisionAnalysis;
}
export interface BacktestExecutionPlan {
    entryIndex: number;
    entryTimestamp: string;
    entryPrice: number;
    stopPrice: number;
    targetPrice: number;
    stopFillPrice: number;
    targetFillPrice: number;
    riskDistance: number;
    plannedRiskReward: number;
    entryModel: EntryModel;
    stopLossModel: StopLossModel;
    takeProfitModel: TakeProfitModel;
    spreadCost: number;
    slippageCost: number;
    exitSpreadCost: number;
    exitSlippageCost: number;
}
export interface BacktestTrade {
    id: string;
    symbol: Symbol;
    timeframe: Timeframe;
    direction: 'bullish' | 'bearish';
    setupTimestamp: string;
    entryTimestamp: string;
    exitTimestamp: string | null;
    entryPrice: number;
    stopPrice: number;
    targetPrice: number;
    exitPrice: number | null;
    positionSize: number;
    plannedRiskReward: number;
    realizedPnl: number | null;
    realizedR: number | null;
    result: 'open' | 'win' | 'loss' | 'breakeven';
    holdingMinutes: number | null;
    exitReason: 'stop' | 'target' | 'end_of_test' | 'ambiguous' | 'none';
    setupConditions: string[];
    setupSnapshot: HistoricalDecisionAnalysis;
}
export interface BacktestPositionSize {
    units: number;
    lots: number;
    riskAmount: number;
    riskDistance: number;
    riskDistanceInPips: number;
    quoteToAccountRate: number;
}
export interface EquityPoint {
    timestamp: string;
    balance: number;
    equity: number;
    peakEquity: number;
    drawdown: number;
    drawdownPercent: number;
}
export interface DrawdownPoint {
    timestamp: string;
    drawdown: number;
    drawdownPercent: number;
}
export interface DrawdownPeriod {
    startTimestamp: string;
    bottomTimestamp: string;
    recoveryTimestamp: string | null;
    depth: number;
    depthPercent: number;
    recoveryMinutes: number | null;
}
export interface BacktestMetrics {
    totalTrades: number;
    completedTrades: number;
    wins: number;
    losses: number;
    breakevens: number;
    winRate: number | null;
    averageGain: number | null;
    averageLoss: number | null;
    grossProfit: number;
    grossLoss: number;
    netProfit: number;
    returnPercent: number;
    maximumDrawdown: number;
    maximumDrawdownPercent: number;
    profitFactor: number | null;
    averagePlannedRiskReward: number | null;
    averageRealizedR: number | null;
    averageTradePnl: number | null;
    largestWin: number | null;
    largestLoss: number | null;
    tradeFrequencyPerDay: number | null;
    expectancy: number | null;
    longestWinningStreak: number;
    longestLosingStreak: number;
    averageHoldingMinutes: number | null;
}
export interface BacktestPeriodResult {
    split: BacktestDataSplit;
    start: string;
    end: string;
    metrics: BacktestMetrics;
    trades: BacktestTrade[];
    equityCurve: EquityPoint[];
    drawdownCurve: DrawdownPoint[];
    drawdownPeriods: DrawdownPeriod[];
    warnings: string[];
}
export interface BacktestResult {
    id: string;
    status: BacktestStatus;
    config: BacktestConfig;
    metadata: BacktestRunMetadata;
    metrics: BacktestMetrics | null;
    trades: BacktestTrade[];
    equityCurve: EquityPoint[];
    drawdownCurve: DrawdownPoint[];
    drawdownPeriods: DrawdownPeriod[];
    warnings: string[];
    createdAt: string;
    completedAt: string | null;
    error: string | null;
    periodResults: BacktestPeriodResult[];
}
