"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAnalysisContext = buildAnalysisContext;
const instruments_1 = require("../../../shared/constants/instruments");
const marketDataService_1 = require("../services/marketDataService");
const trendAnalysisService_1 = require("./trendAnalysisService");
const marketStructureService_1 = require("./marketStructureService");
const supportResistanceService_1 = require("./supportResistanceService");
const momentumAnalysisService_1 = require("./momentumAnalysisService");
const volatilityAnalysisService_1 = require("./volatilityAnalysisService");
const multiTimeframeAnalysisService_1 = require("./multiTimeframeAnalysisService");
const setupDetectionService_1 = require("./setupDetectionService");
const confidenceAnalysisService_1 = require("./confidenceAnalysisService");
const riskAnalysisService_1 = require("./riskAnalysisService");
function deriveImpulse(momentum) {
    const explanation = momentum.components.macd.explanation.toLowerCase();
    if (explanation.includes('contracting'))
        return 'cooling';
    if (explanation.includes('expanding'))
        return 'building';
    if (Math.abs(momentum.score) < 10)
        return 'flat';
    if (explanation.includes('cross'))
        return 'cooling';
    return 'flat';
}
/**
 * Assemble the deterministic analysis snapshot sent to the AI layer.
 * Raw candles and account/position-sizing inputs deliberately never enter
 * this returned object.
 */
async function buildAnalysisContext(symbol, timeframe) {
    const validated = await (0, marketDataService_1.getValidatedCandles)(symbol, timeframe, { limit: 500 });
    const candles = validated.analysisCandles;
    const latest = validated.candles[validated.candles.length - 1];
    const latestCandleAt = latest?.timestamp ?? null;
    const latestCandleMs = latestCandleAt ? new Date(latestCandleAt).getTime() : NaN;
    const candleAgeMs = Number.isFinite(latestCandleMs) ? Date.now() - latestCandleMs : null;
    const timeframeMs = (0, instruments_1.timeframeToMs)(timeframe);
    const latestCandleClosed = latest ? candles.length === validated.candles.length : null;
    const candleStatus = candleAgeMs === null
        ? 'unknown'
        : candleAgeMs < -60_000
            ? 'future'
            : candleAgeMs > timeframeMs * 2
                ? 'stale'
                : 'fresh';
    const [trend, structure, supportResistance, momentum, volatility, multiTimeframe, setups, confidence, risk] = await Promise.all([
        (0, trendAnalysisService_1.getTrendAnalysis)(symbol, timeframe, { limit: 500, swingWindow: 2 }),
        Promise.resolve((0, marketStructureService_1.getMarketStructure)(candles, { swingWindow: 2 })),
        Promise.resolve((0, supportResistanceService_1.getSupportResistance)(candles, { swingWindow: 2 })),
        (0, momentumAnalysisService_1.getMomentumAnalysis)(symbol, timeframe, { limit: 500 }),
        (0, volatilityAnalysisService_1.getVolatilityAnalysis)(symbol, timeframe, { limit: 500 }),
        (0, multiTimeframeAnalysisService_1.getMultiTimeframeAnalysis)(symbol, timeframe),
        (0, setupDetectionService_1.getSetupDetection)(symbol, timeframe),
        (0, confidenceAnalysisService_1.getConfidenceAnalysis)(symbol, timeframe),
        (0, riskAnalysisService_1.getRiskAnalysis)(symbol, timeframe, { symbol, timeframe }),
    ]);
    return {
        identity: {
            symbol,
            timeframe,
            currentPrice: trend.trend.currentPrice,
            latestCandleAt,
            latestCandleClosed,
            candleStatus,
            candleAgeMs,
            provider: validated.provider,
            fallbackUsed: validated.fallbackUsed,
        },
        marketBias: {
            analysis: trend.trend,
            impulse: deriveImpulse(momentum.momentum),
        },
        momentum: momentum.momentum,
        marketStructure: structure.structure,
        supportResistance: [
            ...supportResistance.resistances,
            ...supportResistance.tested,
            ...supportResistance.supports,
        ],
        volatility: volatility.volatility,
        multiTimeframe: multiTimeframe.multiTimeframe,
        evidenceAgreement: confidence.confidence,
        setups: setups.setups,
        tradeQuality: {
            verdict: risk.risk.tradeQuality,
            reasons: risk.risk.tradeQualityReasons,
        },
        risk: {
            nearbySupport: risk.risk.nearbySupport,
            nearbyResistance: risk.risk.nearbyResistance,
            atr: risk.risk.atr,
            invalidationCandidates: risk.risk.invalidationCandidates,
            riskRewardScenarios: risk.risk.riskRewardScenarios,
        },
    };
}
//# sourceMappingURL=analysisContextService.js.map