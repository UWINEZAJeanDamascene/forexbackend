import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { AnalysisContext } from '../../../shared/types/aiAnalysis';
/**
 * Assemble the deterministic analysis snapshot sent to the AI layer.
 * Raw candles and account/position-sizing inputs deliberately never enter
 * this returned object.
 */
export declare function buildAnalysisContext(symbol: Symbol, timeframe: Timeframe): Promise<AnalysisContext>;
