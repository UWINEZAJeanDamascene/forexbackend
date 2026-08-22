"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrendEndpoint = getTrendEndpoint;
const instruments_1 = require("../../../shared/constants/instruments");
const trendAnalysisService_1 = require("../analysis/trendAnalysisService");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('trend.controller');
function isEnabledSymbol(value) {
    return instruments_1.ENABLED_SYMBOLS.includes(value);
}
function isEnabledTimeframe(value) {
    return instruments_1.ENABLED_TIMEFRAMES.includes(value);
}
async function getTrendEndpoint(req, res) {
    const symbol = String(req.query.symbol || '');
    const timeframe = String(req.query.timeframe || '');
    const swingWindowRaw = req.query.swingWindow;
    const swingWindow = swingWindowRaw !== undefined ? Number(swingWindowRaw) : undefined;
    const limitRaw = req.query.limit;
    if (!isEnabledSymbol(symbol)) {
        res.status(400).json({
            error: `Symbol must be one of: ${instruments_1.ENABLED_SYMBOLS.join(', ')}.`,
        });
        return;
    }
    if (!isEnabledTimeframe(timeframe)) {
        res.status(400).json({
            error: `Timeframe must be one of: ${instruments_1.ENABLED_TIMEFRAMES.join(', ')}.`,
        });
        return;
    }
    if (swingWindow !== undefined && (!Number.isInteger(swingWindow) || swingWindow < 1 || swingWindow > 10)) {
        res.status(400).json({ error: 'swingWindow must be an integer between 1 and 10.' });
        return;
    }
    let limit;
    if (limitRaw !== undefined) {
        const parsed = Number(limitRaw);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
            res.status(400).json({ error: 'limit must be an integer between 1 and 500.' });
            return;
        }
        limit = parsed;
    }
    try {
        const result = await (0, trendAnalysisService_1.getTrendAnalysis)(symbol, timeframe, { swingWindow, limit });
        res.status(200).json(result);
    }
    catch (err) {
        logger.error('Failed to compute trend analysis', {
            message: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=trend.controller.js.map