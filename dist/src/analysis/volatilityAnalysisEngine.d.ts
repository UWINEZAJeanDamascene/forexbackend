import { Candle } from '../../shared/types/market';
import { IndicatorValues } from '../../shared/types/indicators';
import { VolatilityAnalysisResult } from '../../shared/types/volatilityAnalysis';
export declare function analyzeVolatility(candles: Candle[], indicators: IndicatorValues): VolatilityAnalysisResult;
