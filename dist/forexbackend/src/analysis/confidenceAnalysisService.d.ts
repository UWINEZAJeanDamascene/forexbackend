import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { ConfidenceResponse } from '../../../shared/types/confidenceAnalysis';
export declare function getConfidenceAnalysis(symbol: Symbol, timeframe: Timeframe): Promise<ConfidenceResponse>;
