import { Candle } from '../../shared/types/market';
import { IndicatorValues } from '../../shared/types/indicators';
import { MarketStructureResult } from '../../shared/types/marketStructure';
import { TrendAnalysisResult } from '../../shared/types/trendAnalysis';
export declare function analyzeTrend(candles: Candle[], indicators: IndicatorValues, structure: MarketStructureResult): TrendAnalysisResult;
