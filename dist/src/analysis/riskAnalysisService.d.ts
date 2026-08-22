import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { RiskResponse, RiskAnalysisRequest } from '../../../shared/types/riskAnalysis';
export declare function getRiskAnalysis(symbol: Symbol, timeframe: Timeframe, request?: RiskAnalysisRequest): Promise<RiskResponse>;
