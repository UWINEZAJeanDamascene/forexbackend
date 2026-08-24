import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { MultiTimeframeResponse } from '../../../shared/types/multiTimeframeAnalysis';
export declare function getMultiTimeframeAnalysis(symbol: Symbol, timeframe: Timeframe, includeStack?: boolean): Promise<MultiTimeframeResponse>;
