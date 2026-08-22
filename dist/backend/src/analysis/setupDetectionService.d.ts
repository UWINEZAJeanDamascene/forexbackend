import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { SetupDetectionResponse } from '../../../shared/types/setupDetection';
export declare function getSetupDetection(symbol: Symbol, timeframe: Timeframe): Promise<SetupDetectionResponse>;
