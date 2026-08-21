import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { MultiTimeframeResponse } from '../../../shared/types/multiTimeframeAnalysis';
import { analyzeMultiTimeframe } from './multiTimeframeAnalysisEngine';

export async function getMultiTimeframeAnalysis(symbol: Symbol, timeframe: Timeframe): Promise<MultiTimeframeResponse> {
  const multiTimeframe = await analyzeMultiTimeframe(symbol, timeframe);

  return {
    symbol,
    timeframe,
    multiTimeframe,
  };
}
