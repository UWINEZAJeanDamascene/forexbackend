import { AnalysisContext, AiStructuredOutput } from '../../../shared/types/aiAnalysis';
export interface AiValidationResult {
    valid: boolean;
    matchedPatterns: string[];
}
export declare function validateAiText(text: string): AiValidationResult;
/** Reject explicit EMA numbers that disagree with the deterministic snapshot. */
export declare function validateAiFacts(text: string, context: AnalysisContext): AiValidationResult;
export declare const AI_UNAVAILABLE_MESSAGE = "AI explanation unavailable for this analysis.";
export interface StructuredAiValidationResult extends AiValidationResult {
    output: AiStructuredOutput | null;
}
export declare function validateStructuredAiResponse(text: string, context?: AnalysisContext): StructuredAiValidationResult;
