"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_UNAVAILABLE_MESSAGE = void 0;
exports.validateAiText = validateAiText;
exports.validateAiFacts = validateAiFacts;
exports.validateStructuredAiResponse = validateStructuredAiResponse;
const BANNED_PATTERNS = [
    /\bguaranteed\b/i,
    /\bwill definitely\b/i,
    /\bsure thing\b/i,
    /\bcan't lose\b/i,
    /\bcan not lose\b/i,
    /\bno[- ]?loss\b/i,
    /\b\d+(?:\.\d+)?\s*%\s*(?:chance|probability|odds|likelihood)\b/i,
    /\b\d+(?:\.\d+)?\s*%\s*(?:win rate|success rate|chance of winning)\b/i,
    /\b(?:buy|sell)\s+(?:now|immediately|here|this|with certainty)\b/i,
    /\b(?:you should|i recommend|recommended)\s+(?:buy|sell|enter|go long|go short)\b/i,
    /\bprice\s+will\s+(?:rise|fall|go up|go down)\b/i,
];
function containsUnsafeGuarantee(text) {
    const guarantee = /\bguaranteed\b/gi;
    let match;
    while ((match = guarantee.exec(text)) !== null) {
        const prefix = text.slice(Math.max(0, match.index - 32), match.index);
        // Educational disclaimers such as "not guaranteed" are safe. An
        // affirmative claim such as "guaranteed profit" remains rejected.
        if (!/\b(?:not|never|no|without)\s+(?:a\s+)?$/i.test(prefix))
            return true;
    }
    return false;
}
function validateAiText(text) {
    const matchedPatterns = BANNED_PATTERNS
        .filter((pattern) => pattern.source === '\\bguaranteed\\b' ? containsUnsafeGuarantee(text) : pattern.test(text))
        .map((pattern) => pattern.source);
    return { valid: matchedPatterns.length === 0, matchedPatterns };
}
/** Reject explicit EMA numbers that disagree with the deterministic snapshot. */
function validateAiFacts(text, context) {
    const matchedPatterns = [];
    const tolerance = context.identity.symbol === 'XAU/USD' ? 0.02 : 0.00002;
    const anchors = [
        { label: 'EMA20', value: context.marketBias.analysis.ema?.ema20 ?? null },
        { label: 'EMA50', value: context.marketBias.analysis.ema?.ema50 ?? null },
        { label: 'EMA200', value: context.marketBias.analysis.ema?.ema200 ?? null },
    ];
    for (const anchor of anchors) {
        if (anchor.value === null)
            continue;
        const period = anchor.label.replace('EMA', '');
        const pattern = new RegExp(`(?:EMA\\s*${period}|${period}[- ]period\\s+EMA)[^\\d]{0,18}(\\d+(?:\\.\\d+)?)`, 'i');
        const match = text.match(pattern);
        if (!match)
            continue;
        const mentioned = Number(match[1]);
        if (!Number.isFinite(mentioned) || Math.abs(mentioned - anchor.value) > tolerance) {
            matchedPatterns.push(`${anchor.label} value does not match deterministic ${context.identity.timeframe} snapshot`);
        }
    }
    return { valid: matchedPatterns.length === 0, matchedPatterns };
}
exports.AI_UNAVAILABLE_MESSAGE = 'AI explanation unavailable for this analysis.';
const STRUCTURED_KEYS = [
    'summary', 'trend', 'momentum', 'marketStructure', 'keyLevels',
    'bullishScenario', 'bearishScenario', 'confirmationNeeded',
    'invalidationConditions', 'riskFactors', 'confidence',
];
function parseJsonObject(text) {
    const unfenced = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
        return JSON.parse(unfenced);
    }
    catch {
        const start = unfenced.indexOf('{');
        const end = unfenced.lastIndexOf('}');
        if (start < 0 || end <= start)
            return null;
        try {
            return JSON.parse(unfenced.slice(start, end + 1));
        }
        catch {
            return null;
        }
    }
}
function validateStructuredAiResponse(text, context) {
    const parsed = parseJsonObject(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { valid: false, matchedPatterns: ['response is not a JSON object'], output: null };
    }
    const record = parsed;
    const keys = Object.keys(record).sort();
    const expected = [...STRUCTURED_KEYS].sort();
    if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
        return { valid: false, matchedPatterns: ['response does not match the required schema'], output: null };
    }
    const stringFields = ['summary', 'trend', 'momentum', 'marketStructure', 'bullishScenario', 'bearishScenario'];
    const listFields = ['keyLevels', 'confirmationNeeded', 'invalidationConditions', 'riskFactors'];
    const invalid = [
        ...stringFields.filter((field) => typeof record[field] !== 'string' || !record[field].trim()),
        ...listFields.filter((field) => !Array.isArray(record[field]) || !record[field].every((item) => typeof item === 'string' && item.trim())),
    ];
    if (!Number.isInteger(record.confidence) || record.confidence < 0 || record.confidence > 100) {
        invalid.push('confidence must be an integer from 0 to 100');
    }
    if (invalid.length > 0)
        return { valid: false, matchedPatterns: invalid, output: null };
    const output = record;
    const safety = validateAiText(JSON.stringify(output));
    if (!safety.valid)
        return { ...safety, output: null };
    const combined = JSON.stringify(output);
    if (context?.tradeQuality.verdict === 'wait' && !/\b(wait|caution|uncertain|confirmation|not aligned|lack)/i.test(combined)) {
        return { valid: false, matchedPatterns: ['structured response does not reflect deterministic WAIT verdict'], output: null };
    }
    if (context && Number.isFinite(context.evidenceAgreement.overallScore) && output.confidence !== context.evidenceAgreement.overallScore) {
        return { valid: false, matchedPatterns: ['confidence must equal deterministic evidence agreement score'], output: null };
    }
    return { valid: true, matchedPatterns: [], output };
}
//# sourceMappingURL=aiResponseValidator.js.map