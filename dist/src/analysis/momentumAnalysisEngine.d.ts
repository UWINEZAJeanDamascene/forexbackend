import { Candle } from '../../shared/types/market';
import { IndicatorValues } from '../../shared/types/indicators';
import { MarketStructureResult } from '../../shared/types/marketStructure';
import { MomentumAnalysisResult } from '../../shared/types/momentumAnalysis';
export declare function analyzeMomentum(candles: Candle[], indicators: IndicatorValues, structure: MarketStructureResult): MomentumAnalysisResult;
