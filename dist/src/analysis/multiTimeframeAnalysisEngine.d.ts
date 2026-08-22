import { TimeframeSnapshot, MultiTimeframeAnalysis, MultiTimeframeAlignment } from '../../shared/types/multiTimeframeAnalysis';
import { Symbol, Timeframe } from '../../../shared/constants/instruments';
export declare const TIMEFRAME_HIERARCHY: Record<Timeframe, {
    higher: Timeframe | null;
    lower: Timeframe | null;
}>;
export declare function clearMultiTimeframeCache(): void;
export declare const BANNED_WORDS: RegExp;
export declare function classifyAlignment(higher: TimeframeSnapshot | null, analysis: TimeframeSnapshot, lower: TimeframeSnapshot | null): MultiTimeframeAlignment;
export declare function detectPattern(higher: TimeframeSnapshot | null, analysis: TimeframeSnapshot, lower: TimeframeSnapshot | null): string | null;
export declare function generateExplanation(alignment: MultiTimeframeAlignment, higher: TimeframeSnapshot | null, analysis: TimeframeSnapshot, lower: TimeframeSnapshot | null, pattern: string | null): string;
export declare function analyzeMultiTimeframe(symbol: Symbol, analysisTimeframe: Timeframe): Promise<MultiTimeframeAnalysis>;
