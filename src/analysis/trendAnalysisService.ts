import { Candle } from '../../shared/types/market';
import { getValidatedCandles } from '../services/marketDataService';
import { computeIndicators } from './indicatorService';
import { getMarketStructure } from './marketStructureService';
import { analyzeTrend } from './trendAnalysisEngine';
import { TrendResponse } from '../../shared/types/trendAnalysis';

export interface GetTrendOptions {
  swingWindow?: number;
}

export async function getTrendAnalysis(symbol: string, timeframe: string, options: GetTrendOptions = {}): Promise<TrendResponse> {
  const { candles } = await getValidatedCandles(symbol, timeframe);
  const indicators = computeIndicators(candles, symbol, timeframe);
  const structureResult = getMarketStructure(candles, options);
  const trend = analyzeTrend(candles, indicators.indicators, structureResult.structure);

  return {
    symbol,
    timeframe,
    trend,
  };
}
