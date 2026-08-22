"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postAiAnalysis = postAiAnalysis;
exports.getAiUsage = getAiUsage;
const instruments_1 = require("../../../shared/constants/instruments");
const analysisContextService_1 = require("../analysis/analysisContextService");
const aiServiceFactory_1 = require("../ai/aiServiceFactory");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('ai.controller');
function isEnabledSymbol(value) {
    return typeof value === 'string' && instruments_1.ENABLED_SYMBOLS.includes(value);
}
function isEnabledTimeframe(value) {
    return typeof value === 'string' && instruments_1.ENABLED_TIMEFRAMES.includes(value);
}
async function postAiAnalysis(req, res) {
    const symbol = req.body?.symbol;
    const timeframe = req.body?.timeframe;
    if (!isEnabledSymbol(symbol) || !isEnabledTimeframe(timeframe)) {
        res.status(400).json({ error: 'A supported symbol and timeframe are required.' });
        return;
    }
    try {
        const context = await (0, analysisContextService_1.buildAnalysisContext)(symbol, timeframe);
        const result = await aiServiceFactory_1.aiAnalysisService.explain(context);
        res.status(200).json(result);
    }
    catch (error) {
        logger.error('AI analysis failed', { message: error instanceof Error ? error.message : 'unknown' });
        res.status(500).json({ error: 'AI analysis is temporarily unavailable. Deterministic analysis remains available.' });
    }
}
function getAiUsage(_req, res) {
    res.status(200).json(aiServiceFactory_1.aiAnalysisService.getUsage());
}
//# sourceMappingURL=ai.controller.js.map