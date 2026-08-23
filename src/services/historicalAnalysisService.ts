import { Candle } from '../../../shared/types/market';
import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { HistoricalDecisionAnalysis } from '../../../shared/types/backtest';
import { computeIndicators } from '../analysis/indicatorService';
import { analyzeTrend } from '../analysis/trendAnalysisEngine';
import { getMarketStructure } from '../analysis/marketStructureService';
import { getSupportResistance } from '../analysis/supportResistanceService';
import { analyzeMomentum } from '../analysis/momentumAnalysisEngine';
import { analyzeVolatility } from '../analysis/volatilityAnalysisEngine';

export interface HistoricalAnalysisOptions {
  swingWindow?: number;
  higherTimeframeTrends?: HistoricalDecisionAnalysis['higherTimeframeTrends'];
}

/**
 * Evaluates one completed decision candle using only the prefix available at
 * that point in history. Later candles are deliberately excluded.
 */
export function analyzeHistoricalDecision(
  candles: Candle[],
  decisionIndex: number,
  symbol: Symbol,
  timeframe: Timeframe,
  options: HistoricalAnalysisOptions = {}
): HistoricalDecisionAnalysis {
  if (!Number.isInteger(decisionIndex) || decisionIndex < 0 || decisionIndex >= candles.length) {
    throw new Error(`Historical decision index ${decisionIndex} is outside the candle series.`);
  }

  const candlesThroughDecision = candles.slice(0, decisionIndex + 1);
  const decisionCandle = candlesThroughDecision[decisionIndex];
  const indicators = computeIndicators(candlesThroughDecision, symbol, timeframe).indicators;
  const structure = getMarketStructure(candlesThroughDecision, {
    swingWindow: options.swingWindow,
    confirmedSwingOnly: true,
  }).structure;
  const trend = analyzeTrend(candlesThroughDecision, indicators, structure);
  const supportResistance = getSupportResistance(candlesThroughDecision, {
    swingWindow: options.swingWindow,
    confirmedSwingOnly: true,
  });
  const momentum = analyzeMomentum(candlesThroughDecision, indicators, structure);
  const volatility = analyzeVolatility(candlesThroughDecision, indicators);

  return {
    symbol,
    timeframe,
    decisionIndex,
    decisionTimestamp: decisionCandle.timestamp,
    candlesThroughDecision,
    indicators,
    trend,
    structure,
    supportResistance,
    momentum,
    volatility,
    higherTimeframeTrends: options.higherTimeframeTrends ?? {},
  };
}