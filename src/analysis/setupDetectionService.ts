import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { SetupContext, SetupDetectionResponse } from '../../../shared/types/setupDetection';
import { DEFAULT_ANALYSIS_CANDLE_LIMIT, getValidatedCandles } from '../services/marketDataService';
import { getTrendAnalysis } from './trendAnalysisService';
import { getMarketStructure } from './marketStructureService';
import { getMomentumAnalysis } from './momentumAnalysisService';
import { getVolatilityAnalysis } from './volatilityAnalysisService';
import { getSupportResistance } from './supportResistanceService';
import { analyzeMultiTimeframe, TIMEFRAME_HIERARCHY } from './multiTimeframeAnalysisEngine';
import { detectSetups } from './setupDetectionEngine';

export async function getSetupDetection(symbol: Symbol, timeframe: Timeframe): Promise<SetupDetectionResponse> {
  const { analysisCandles: candles } = await getValidatedCandles(symbol, timeframe, { limit: DEFAULT_ANALYSIS_CANDLE_LIMIT });

  const [trendResponse, structureResponse, momentumResponse, volatilityResponse, srResponse, mtfResponse] = await Promise.all([
    getTrendAnalysis(symbol, timeframe, {}),
    getMarketStructure(candles, {}),
    getMomentumAnalysis(symbol, timeframe),
    getVolatilityAnalysis(symbol, timeframe),
    getSupportResistance(candles, {}),
    analyzeMultiTimeframe(symbol, timeframe),
  ]);

  const expectedHigher = TIMEFRAME_HIERARCHY[timeframe]?.higher ?? null;
  const higherSnap = mtfResponse.higherTimeframe;
  // Only treat as incomplete when the higher TF is missing or explicitly failed.
  // Neutral HTF with status ok is valid data — not incomplete.
  const higherIncomplete =
    expectedHigher !== null &&
    (higherSnap === null || higherSnap.status === 'error' || higherSnap.status === 'insufficient_data');

  const ctx: SetupContext = {
    symbol,
    currentPrice: trendResponse.trend.currentPrice,
    trend: {
      trend: trendResponse.trend.trend,
      strength: trendResponse.trend.strength,
      ema: trendResponse.trend.ema,
    },
    structure: {
      trend: structureResponse.structure.trend,
      events: structureResponse.structure.events.map((e) => ({ type: e.type, price: e.price })),
    },
    momentum: {
      momentum: momentumResponse.momentum.momentum,
      strength: momentumResponse.momentum.strength,
      counterTrend: momentumResponse.momentum.counterTrend,
    },
    volatility: {
      classification: volatilityResponse.volatility.classification,
    },
    supportResistance: {
      supports: srResponse.supports,
      resistances: srResponse.resistances,
    },
    multiTimeframe: {
      alignment: mtfResponse.alignment,
      possiblePattern: mtfResponse.possiblePattern,
      higherTimeframe: mtfResponse.higherTimeframe
        ? {
            timeframe: mtfResponse.higherTimeframe.timeframe,
            trend: mtfResponse.higherTimeframe.trend,
            status: mtfResponse.higherTimeframe.status,
          }
        : null,
      analysis: {
        timeframe: mtfResponse.analysisTimeframe,
        trend: mtfResponse.analysis.trend,
        score: mtfResponse.analysis.score,
        status: mtfResponse.analysis.status,
      },
      lowerTimeframe: mtfResponse.lowerTimeframe
        ? {
            timeframe: mtfResponse.lowerTimeframe.timeframe,
            trend: mtfResponse.lowerTimeframe.trend,
            status: mtfResponse.lowerTimeframe.status,
          }
        : null,
      higherTimeframeIncomplete: higherIncomplete,
    },
  };

  const setups = detectSetups(ctx);

  return {
    symbol,
    timeframe,
    setups,
    dataQualityNote: higherIncomplete
      ? 'Higher timeframe data incomplete — setups that require multi-timeframe confirmation were excluded.'
      : null,
  };
}
