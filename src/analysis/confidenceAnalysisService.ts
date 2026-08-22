import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { ConfidenceResponse } from '../../../shared/types/confidenceAnalysis';
import { getTrendAnalysis } from './trendAnalysisService';
import { getMarketStructure } from './marketStructureService';
import { getMomentumAnalysis } from './momentumAnalysisService';
import { getVolatilityAnalysis } from './volatilityAnalysisService';
import { getSupportResistance } from './supportResistanceService';
import { getMultiTimeframeAnalysis } from './multiTimeframeAnalysisService';
import { getSetupDetection } from './setupDetectionService';
import { DEFAULT_ANALYSIS_CANDLE_LIMIT, getValidatedCandles } from '../services/marketDataService';
import { computeConfidence } from './confidenceAnalysisEngine';
import { createLogger } from '../utils/logger';

const logger = createLogger('confidenceAnalysis');

export async function getConfidenceAnalysis(symbol: Symbol, timeframe: Timeframe): Promise<ConfidenceResponse> {
  try {
    const { analysisCandles: candles } = await getValidatedCandles(symbol, timeframe, { limit: DEFAULT_ANALYSIS_CANDLE_LIMIT });

    const [trend, momentum, volatility, sr, mtf, setups] = await Promise.all([
      getTrendAnalysis(symbol, timeframe, {}),
      getMomentumAnalysis(symbol, timeframe),
      getVolatilityAnalysis(symbol, timeframe),
      getSupportResistance(candles, { swingWindow: 2 }),
      getMultiTimeframeAnalysis(symbol, timeframe),
      getSetupDetection(symbol, timeframe),
    ]);

    const structure = getMarketStructure(candles, { swingWindow: 2 });
    const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

    const confidence = computeConfidence({
      trend: trend.trend,
      structure: structure.structure,
      momentum: momentum.momentum,
      volatility: volatility.volatility,
      supportResistance: sr,
      multiTimeframe: mtf.multiTimeframe,
      setups: setups.setups,
      currentPrice,
    });

    return {
      symbol,
      timeframe,
      confidence,
    };
  } catch (err) {
    logger.error('Failed to compute confidence analysis', {
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
