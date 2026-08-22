import { Symbol, Timeframe, timeframeToMs } from '../../../shared/constants/instruments';
import { AnalysisContext } from '../../../shared/types/aiAnalysis';
import { getValidatedCandles } from '../services/marketDataService';
import { getTrendAnalysis } from './trendAnalysisService';
import { getMarketStructure } from './marketStructureService';
import { getSupportResistance } from './supportResistanceService';
import { getMomentumAnalysis } from './momentumAnalysisService';
import { getVolatilityAnalysis } from './volatilityAnalysisService';
import { getMultiTimeframeAnalysis } from './multiTimeframeAnalysisService';
import { getSetupDetection } from './setupDetectionService';
import { getConfidenceAnalysis } from './confidenceAnalysisService';
import { getRiskAnalysis } from './riskAnalysisService';

function deriveImpulse(momentum: AnalysisContext['momentum']): AnalysisContext['marketBias']['impulse'] {
  const explanation = momentum.components.macd.explanation.toLowerCase();
  if (explanation.includes('contracting')) return 'cooling';
  if (explanation.includes('expanding')) return 'building';
  if (Math.abs(momentum.score) < 10) return 'flat';
  if (explanation.includes('cross')) return 'cooling';
  return 'flat';
}

/**
 * Assemble the deterministic analysis snapshot sent to the AI layer.
 * Raw candles and account/position-sizing inputs deliberately never enter
 * this returned object.
 */
export async function buildAnalysisContext(symbol: Symbol, timeframe: Timeframe): Promise<AnalysisContext> {
  const validated = await getValidatedCandles(symbol, timeframe, { limit: 500 });
  const candles = validated.analysisCandles;
  const latest = validated.candles[validated.candles.length - 1];
  const latestCandleAt = latest?.timestamp ?? null;
  const latestCandleMs = latestCandleAt ? new Date(latestCandleAt).getTime() : NaN;
  const candleAgeMs = Number.isFinite(latestCandleMs) ? Date.now() - latestCandleMs : null;
  const timeframeMs = timeframeToMs(timeframe);
  const latestCandleClosed = latest ? candles.length === validated.candles.length : null;
  const candleStatus = candleAgeMs === null
    ? 'unknown'
    : candleAgeMs < -60_000
      ? 'future'
      : candleAgeMs > timeframeMs * 2
        ? 'stale'
        : 'fresh';

  const [trend, structure, supportResistance, momentum, volatility, multiTimeframe, setups, confidence, risk] = await Promise.all([
    getTrendAnalysis(symbol, timeframe, { limit: 500, swingWindow: 2 }),
    Promise.resolve(getMarketStructure(candles, { swingWindow: 2 })),
    Promise.resolve(getSupportResistance(candles, { swingWindow: 2 })),
    getMomentumAnalysis(symbol, timeframe, { limit: 500 }),
    getVolatilityAnalysis(symbol, timeframe, { limit: 500 }),
    getMultiTimeframeAnalysis(symbol, timeframe),
    getSetupDetection(symbol, timeframe),
    getConfidenceAnalysis(symbol, timeframe),
    getRiskAnalysis(symbol, timeframe, { symbol, timeframe }),
  ]);

  return {
    identity: {
      symbol,
      timeframe,
      currentPrice: trend.trend.currentPrice,
      latestCandleAt,
      latestCandleClosed,
      candleStatus,
      candleAgeMs,
      provider: validated.provider,
      fallbackUsed: validated.fallbackUsed,
    },
    marketBias: {
      analysis: trend.trend,
      impulse: deriveImpulse(momentum.momentum),
    },
    momentum: momentum.momentum,
    marketStructure: structure.structure,
    supportResistance: [
      ...supportResistance.resistances,
      ...supportResistance.tested,
      ...supportResistance.supports,
    ],
    volatility: volatility.volatility,
    multiTimeframe: multiTimeframe.multiTimeframe,
    evidenceAgreement: confidence.confidence,
    setups: setups.setups,
    tradeQuality: {
      verdict: risk.risk.tradeQuality,
      reasons: risk.risk.tradeQualityReasons,
    },
    risk: {
      nearbySupport: risk.risk.nearbySupport,
      nearbyResistance: risk.risk.nearbyResistance,
      atr: risk.risk.atr,
      invalidationCandidates: risk.risk.invalidationCandidates,
      riskRewardScenarios: risk.risk.riskRewardScenarios,
    },
  };
}
