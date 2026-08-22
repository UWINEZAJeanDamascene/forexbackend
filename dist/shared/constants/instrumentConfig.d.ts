/**
 * Instrument-specific trading conventions.
 * Used by risk analysis for position sizing calculations.
 */
export declare const INSTRUMENT_CONFIG: Record<string, {
    pipValue: number;
    lotSize: number;
    name: string;
}>;
export declare function getInstrumentConfig(symbol: string): {
    pipValue: number;
    lotSize: number;
    name: string;
};
