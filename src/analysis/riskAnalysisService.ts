import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { RiskResponse, RiskAnalysisRequest } from '../../../shared/types/riskAnalysis';
import { getTrendAnalysis } from './trendAnalysisService';
import { getMarketStructure } from './marketStructureService';
import { getVolatilityAnalysis } from './volatilityAnalysisService';
import { getSupportResistance } from './supportResistanceService';
import { getSetupDetection } from './setupDetectionService';
import { getValidatedCandles } from '../services/marketDataService';
import { computeRiskAnalysis } from './riskAnalysisEngine';
import { createLogger } from '../utils/logger';

const logger = createLogger('riskAnalysis');

export async function getRiskAnalysis(symbol: Symbol, timeframe: Timeframe, request?: RiskAnalysisRequest): Promise<RiskResponse> {
  try {
    const { candles } = await getValidatedCandles(symbol, timeframe, { limit: 500 });

    const [trend, volatility, sr, setups] = await Promise.all([
      getTrendAnalysis(symbol, timeframe, {}),
      getVolatilityAnalysis(symbol, timeframe),
      getSupportResistance(candles, { swingWindow: 2 }),
      getSetupDetection(symbol, timeframe),
    ]);

    const structure = getMarketStructure(candles, { swingWindow: 2 });
    const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

    const risk = computeRiskAnalysis({
      trend: trend.trend,
      structure: structure.structure,
      volatility: volatility.volatility,
      supportResistance: sr,
      setups: setups.setups,
      currentPrice,
      accountSize: request?.accountSize,
      maxRiskPercent: request?.maxRiskPercent,
    });

    return {
      symbol,
      timeframe,
      risk,
    };
  } catch (err) {
    logger.error('Failed to compute risk analysis', {
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
