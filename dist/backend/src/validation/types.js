"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataValidationError = void 0;
/**
 * Thrown when a candle series cannot be safely used at all - e.g. every
 * candle was corrupted, or too few valid candles remain after cleaning to
 * do any meaningful analysis. Callers (indicators/analysis) should never
 * receive candles that would trigger this.
 */
class DataValidationError extends Error {
    issues;
    constructor(message, issues) {
        super(message);
        this.name = 'DataValidationError';
        this.issues = issues;
    }
}
exports.DataValidationError = DataValidationError;
//# sourceMappingURL=types.js.map