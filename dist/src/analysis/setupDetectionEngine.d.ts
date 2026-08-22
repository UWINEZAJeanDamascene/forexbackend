import { SetupContext, DetectedSetup } from '../../shared/types/setupDetection';
interface SetupCondition {
    key: string;
    label: string;
    check: (ctx: SetupContext) => boolean;
    /** When true, this condition cannot be satisfied if HTF data is incomplete. */
    requiresHigherTf?: boolean;
}
interface SetupRule {
    setupName: string;
    direction: 'bullish' | 'bearish';
    conditions: SetupCondition[];
    invalidationCondition: (ctx: SetupContext) => string;
    /** Setups that need HTF confirmation are gated when MTF is incomplete. */
    requiresHigherTfData?: boolean;
}
export declare const SETUP_DEFINITIONS: SetupRule[];
export declare function detectSetups(ctx: SetupContext): DetectedSetup[];
/**
 * Rank by condition coverage + MTF consensus alignment.
 * Suppress opposite-direction noise when consensus is clear and coverage is weaker.
 * Cap to top N so the panel describes conditions, not a pile of conflicting cards.
 */
export declare function rankAndFilterSetups(setups: DetectedSetup[], ctx: SetupContext): DetectedSetup[];
export {};
