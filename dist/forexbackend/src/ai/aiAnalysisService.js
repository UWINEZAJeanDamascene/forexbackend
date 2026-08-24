"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiAnalysisService = void 0;
exports.buildAiPromptContext = buildAiPromptContext;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const aiProvider_1 = require("./aiProvider");
const aiResponseValidator_1 = require("./aiResponseValidator");
const logger = (0, logger_1.createLogger)('aiAnalysis');
const DISCLAIMER = 'AI-generated interpretation of deterministic technical analysis. Educational only; not financial advice or a probability of profit.';
// Input budget only. This does not limit the generated explanation.
const MAX_PROMPT_CONTEXT_CHARS = 12_000;
const SYSTEM_PROMPT = `You are an educational market-analysis explainer. The supplied JSON is already calculated by a deterministic backend from validated market data. Do not calculate indicators, infer missing data, or invent levels. Explain only the supplied context.

Return ONLY one valid JSON object. Do not use Markdown fences, headings outside JSON, commentary, or trailing commas. The object must contain exactly these keys and types:
{"summary":"string","trend":"string","momentum":"string","marketStructure":"string","keyLevels":["string"],"bullishScenario":"string","bearishScenario":"string","confirmationNeeded":["string"],"invalidationConditions":["string"],"riskFactors":["string"],"confidence":0}

The confidence field must copy evidenceAgreement.overallScore exactly. It is analytical agreement, not a probability.


Absolute rules:
- Never claim guaranteed profit, certainty, or a guaranteed direction.
- Never provide win probabilities or percentage chances.
- Never issue an unhedged buy/sell instruction.
- Never contradict the deterministic Trade Quality verdict. If it is WAIT, the explanation must remain cautious and say why confirmation is lacking.
- Distinguish current/forming candle data from closed-candle analysis.
- Treat every number as belonging to its explicitly labelled analysis timeframe. Never replace an EMA value with an invalidation value, resistance boundary, or value from another timeframe.
- Use the timeframeAnchors object as the authoritative source for current price and EMA values, and the multiTimeframeSnapshots object as the authoritative source for timeframe labels and scores.
- An invalidation condition describes what disproves a setup; it is not confirmation for that setup. Do not call a bearish setup confirmed merely because price is below overhead resistance.
- Use only supplied scenario conditions. Do not invent a confirmation level or reverse the meaning of an invalidation condition.
- Use scenarioGuidance as the authoritative mapping: bullishConfirmation supports the bullish case, bullishInvalidation weakens it, bearishConfirmation supports the bearish case, and bearishInvalidation weakens it.
- For XAU/USD, do not convert price distances into pips unless an explicit pip convention is supplied. Prefer the quoted price distance and ATR distance.
- Do not describe an extreme risk/reward ratio as attractive or realistic; explain when it is distorted by a very narrow invalidation or a distant target.
- Use phrases such as “technical conditions currently show…”, “one possible scenario is…”, and “confirmation would strengthen this interpretation…”.
- Do not mention raw candles, account size, position sizing, or hidden implementation details.`;
function contextHash(context) {
    // Provider/analysis timestamps and the live candle age change between two
    // identical requests without changing the technical facts being explained.
    // Exclude those volatile metadata fields so repeated manual requests can
    // use the cache until the actual analysis context changes.
    const stable = JSON.parse(JSON.stringify(context, (key, value) => {
        if (key === 'analyzedAt' || key === 'generatedAt' || key === 'candleAgeMs')
            return undefined;
        return value;
    }));
    return crypto_1.default.createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}
function primitiveRaw(raw) {
    return Object.fromEntries(Object.entries(raw).filter(([, value]) => value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'));
}
/**
 * Keep the AI request faithful to the deterministic panels without sending
 * historical arrays or implementation-only payloads to the provider.
 */
function buildAiPromptContext(context) {
    const trend = context.marketBias.analysis;
    const structure = context.marketStructure;
    const momentum = context.momentum;
    const confidence = context.evidenceAgreement;
    const currentPrice = trend.currentPrice;
    const ema20 = trend.ema?.ema20 ?? null;
    const resistance = context.supportResistance
        .filter((level) => level.type === 'resistance' && level.price >= currentPrice)
        .sort((a, b) => a.price - b.price)[0] ?? null;
    const protectedSwingLow = structure.lastSwingLow?.price ?? null;
    return {
        identity: context.identity,
        timeframeAnchors: {
            analysisTimeframe: context.identity.timeframe,
            currentPrice,
            ema20,
            ema50: trend.ema?.ema50 ?? null,
            ema200: trend.ema?.ema200 ?? null,
            priceVsEma: trend.priceVsEmaBreakdown,
        },
        marketBias: {
            trend: trend.trend,
            strength: trend.strength,
            score: trend.score,
            impulse: context.marketBias.impulse,
            factors: trend.factors,
            priceVsEmaBreakdown: trend.priceVsEmaBreakdown,
            ema: trend.ema,
        },
        momentum: {
            momentum: momentum.momentum,
            momentumLean: momentum.momentumLean,
            strength: momentum.strength,
            score: momentum.score,
            rawScore: momentum.rawScore,
            adjustmentFactor: momentum.adjustmentFactor,
            adjustmentReason: momentum.adjustmentReason,
            counterTrend: momentum.counterTrend,
            counterTrendExplanation: momentum.counterTrendExplanation,
            trendContext: momentum.trendContext,
            divergence: momentum.divergence,
            components: Object.fromEntries(Object.entries(momentum.components ?? {}).map(([name, component]) => [name, {
                    score: component.score,
                    explanation: component.explanation,
                    raw: primitiveRaw(component.raw),
                }])),
        },
        marketStructure: {
            trend: structure.trend,
            trendQualifier: structure.trendQualifier,
            higherHighsCount: structure.higherHighsCount,
            higherLowsCount: structure.higherLowsCount,
            lowerHighsCount: structure.lowerHighsCount,
            lowerLowsCount: structure.lowerLowsCount,
            recentHigherHighs: structure.recentHigherHighs,
            recentHigherLows: structure.recentHigherLows,
            recentLowerHighs: structure.recentLowerHighs,
            recentLowerLows: structure.recentLowerLows,
            latestEvents: structure.events?.slice(-5) ?? [],
            latestSwingHigh: structure.lastSwingHigh,
            latestSwingLow: structure.lastSwingLow,
            candlestickPatterns: structure.candlestickPatterns?.slice(-5) ?? [],
        },
        supportResistance: context.supportResistance,
        volatility: context.volatility,
        multiTimeframeSnapshots: {
            higher: context.multiTimeframe?.higherTimeframe ?? null,
            analysis: context.multiTimeframe?.analysis ?? null,
            lower: context.multiTimeframe?.lowerTimeframe ?? null,
            alignment: context.multiTimeframe?.alignment ?? 'insufficient_data',
            possiblePattern: context.multiTimeframe?.possiblePattern ?? null,
            explanation: context.multiTimeframe?.explanation ?? null,
        },
        evidenceAgreement: {
            overallScore: confidence.overallScore,
            band: confidence.band,
            factors: confidence.factors,
            warnings: confidence.warnings,
            compositeBreakdown: confidence.compositeBreakdown,
        },
        setups: context.setups,
        tradeQuality: context.tradeQuality,
        interpretationRules: {
            invalidationIsNotConfirmation: true,
            resistanceAbovePriceIsNotBearishConfirmation: true,
            useOnlySuppliedScenarioConditions: true,
            xauPipsRequireExplicitConvention: true,
            extremeRiskRewardRequiresCaution: true,
        },
        scenarioGuidance: {
            bullishConfirmation: [
                ema20 === null ? 'A confirmed close above the analysis-timeframe resistance zone.' : `A confirmed ${context.identity.timeframe} close above EMA20 at ${ema20.toFixed(5)}.`,
                resistance ? `A confirmed close above resistance zone high ${resistance.zoneHigh.toFixed(5)} followed by acceptance above the zone.` : 'A confirmed close above the supplied resistance zone.',
            ],
            bullishInvalidation: [
                ema20 === null ? 'A confirmed close below the analysis-timeframe support or protected structure.' : `A confirmed ${context.identity.timeframe} close below EMA20 at ${ema20.toFixed(5)}.`,
                protectedSwingLow === null ? 'A break of the supplied protected swing low.' : `A break of protected swing low ${protectedSwingLow.toFixed(5)}.`,
            ],
            bearishConfirmation: [
                resistance ? `Rejection from resistance near ${resistance.price.toFixed(5)} followed by a confirmed close lower.` : 'Rejection from the supplied resistance zone followed by a confirmed close lower.',
                ema20 === null ? 'A confirmed downside break of the supplied support or protected structure.' : `A confirmed ${context.identity.timeframe} close below EMA20 at ${ema20.toFixed(5)} or below protected structure.`,
            ],
            bearishInvalidation: [
                resistance ? `A confirmed ${context.identity.timeframe} close above resistance zone high ${resistance.zoneHigh.toFixed(5)}.` : 'A confirmed close above the supplied resistance zone high.',
            ],
        },
        risk: context.risk,
    };
}
function buildUserPrompt(context, stricter = false) {
    const extra = stricter
        ? '\nSTRICT VALIDATION REMINDER: Rewrite any certainty, guarantee, direct instruction, or percentage-probability language using cautious scenario language before responding.'
        : '';
    const compactContext = buildAiPromptContext(context);
    let serialized = JSON.stringify(compactContext);
    // Keep requests well below provider payload/token limits. The fallback view
    // retains all numeric conclusions but drops verbose explanatory duplicates.
    if (serialized.length > MAX_PROMPT_CONTEXT_CHARS) {
        const reduced = {
            ...compactContext,
            momentum: {
                ...compactContext.momentum,
                components: undefined,
            },
            evidenceAgreement: {
                ...compactContext.evidenceAgreement,
                factors: undefined,
                compositeBreakdown: undefined,
            },
            supportResistance: compactContext.supportResistance.slice(0, 6),
            setups: compactContext.setups.slice(0, 3),
            multiTimeframeSnapshots: {
                ...compactContext.multiTimeframeSnapshots,
                explanation: undefined,
            },
        };
        serialized = JSON.stringify(reduced);
    }
    return `Explain this deterministic analysis context. The Trade Quality verdict is authoritative and must control the tone.\n${serialized}${extra}`;
}
class AiAnalysisService {
    providers;
    cache = new Map();
    usage = { requests: 0, providerAttempts: 0, cacheHits: 0, failures: 0, lastRequestAt: null };
    constructor(providers) {
        this.providers = providers;
    }
    getUsage() {
        return { ...this.usage };
    }
    async explain(context) {
        const hash = contextHash(context);
        const cached = this.cache.get(hash);
        if (cached) {
            this.usage.cacheHits += 1;
            return { ...cached, cached: true };
        }
        this.usage.requests += 1;
        this.usage.lastRequestAt = new Date().toISOString();
        if (this.providers.length === 0)
            return this.unavailable(context);
        let first;
        try {
            first = await this.generateWithFallback(buildUserPrompt(context));
        }
        catch (error) {
            logger.error('All AI providers failed', { message: error instanceof Error ? error.message : 'unknown' });
            return this.unavailable(context);
        }
        let explanation = first.text;
        let provider = first.provider;
        let structuredValidation = (0, aiResponseValidator_1.validateStructuredAiResponse)(explanation, context);
        let validation = structuredValidation;
        const factValidation = (0, aiResponseValidator_1.validateAiFacts)(explanation, context);
        if (!factValidation.valid)
            validation = { ...validation, valid: false, matchedPatterns: [...validation.matchedPatterns, ...factValidation.matchedPatterns] };
        if (!validation.valid) {
            logger.warn('AI response rejected by safety validator; retrying', { provider, matchedPatterns: validation.matchedPatterns });
            try {
                const retry = await this.generateWithFallback(buildUserPrompt(context, true));
                explanation = retry.text;
                provider = retry.provider;
            }
            catch (error) {
                logger.error('AI safety retry failed', { message: error instanceof Error ? error.message : 'unknown' });
                return this.unavailable(context);
            }
            structuredValidation = (0, aiResponseValidator_1.validateStructuredAiResponse)(explanation, context);
            validation = structuredValidation;
            const retryFactValidation = (0, aiResponseValidator_1.validateAiFacts)(explanation, context);
            if (!retryFactValidation.valid)
                validation = { ...validation, valid: false, matchedPatterns: [...validation.matchedPatterns, ...retryFactValidation.matchedPatterns] };
        }
        if (!validation.valid) {
            this.usage.failures += 1;
            logger.error('AI response rejected after retry', { matchedPatterns: validation.matchedPatterns });
            return this.unavailable(context);
        }
        const result = {
            symbol: context.identity.symbol,
            timeframe: context.identity.timeframe,
            explanation,
            structured: structuredValidation.output,
            provider,
            cached: false,
            generatedAt: new Date().toISOString(),
            disclaimer: DISCLAIMER,
            available: true,
        };
        this.cache.set(hash, result);
        return result;
    }
    async generateWithFallback(prompt) {
        let lastError = null;
        for (const provider of this.providers) {
            this.usage.providerAttempts += 1;
            try {
                return { text: await provider.generate({ systemPrompt: SYSTEM_PROMPT, userPrompt: prompt }), provider: provider.name };
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error('AI provider failed');
                const kind = error instanceof aiProvider_1.AiProviderError ? error.kind : 'provider_error';
                logger.warn('AI provider failed; trying next provider', { provider: provider.name, kind });
            }
        }
        this.usage.failures += 1;
        throw lastError ?? new Error('No AI provider configured');
    }
    unavailable(context) {
        const structured = buildDeterministicFallback(context);
        return {
            symbol: context.identity.symbol,
            timeframe: context.identity.timeframe,
            explanation: JSON.stringify(structured),
            structured,
            provider: 'deterministic-fallback',
            cached: false,
            generatedAt: new Date().toISOString(),
            disclaimer: DISCLAIMER,
            available: false,
        };
    }
}
exports.AiAnalysisService = AiAnalysisService;
function buildDeterministicFallback(context) {
    const analysis = context.marketBias.analysis;
    const structure = context.marketStructure;
    const quality = context.tradeQuality;
    const agreement = context.evidenceAgreement;
    const levels = context.supportResistance.slice(0, 6).map((level) => `${level.type}: ${level.price}`);
    const waitSummary = quality.verdict === 'wait'
        ? `Trade Quality is WAIT because ${quality.reasons[0] ?? 'directional evidence is not aligned'}.`
        : `Trade Quality is ${quality.verdict.toUpperCase()}.`;
    const agreementSummary = Number.isFinite(agreement.overallScore)
        ? `Evidence agreement is ${agreement.overallScore}/100 (${agreement.bandLabel ?? agreement.band ?? 'mixed evidence'}) — this is not a win probability.`
        : 'Evidence agreement is unavailable.';
    return {
        summary: `${waitSummary} ${agreementSummary} AI provider is unavailable; this cautious summary is generated from deterministic panels only.`,
        trend: `${analysis.trend} (${analysis.strength}), score ${analysis.score}/100 on ${context.identity.timeframe}. Wait for confirmation before treating this as directional.`,
        momentum: `${context.momentum.momentum} momentum, score ${context.momentum.score}/100.`,
        marketStructure: `${structure.trend} structure with ${structure.higherHighsCount} higher highs and ${structure.higherLowsCount} higher lows.`,
        keyLevels: levels,
        bullishScenario: 'One possible bullish scenario requires confirmation from deterministic setup conditions and a non-WAIT Trade Quality verdict.',
        bearishScenario: 'One possible bearish scenario requires confirmation from deterministic setup conditions and a non-WAIT Trade Quality verdict.',
        confirmationNeeded: [
            'Trade Quality must move out of WAIT before any scenario is treated as actionable.',
            ...quality.reasons.slice(0, 2),
        ],
        invalidationConditions: context.risk.invalidationCandidates.slice(0, 4).map((candidate) => candidate.description),
        riskFactors: [...quality.reasons, context.volatility.explanation].filter(Boolean),
        confidence: Number.isFinite(agreement.overallScore) ? agreement.overallScore : 0,
    };
}
//# sourceMappingURL=aiAnalysisService.js.map