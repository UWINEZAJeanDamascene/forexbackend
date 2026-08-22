"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVolatilityEndpoint = getVolatilityEndpoint;
const instruments_1 = require("../../../shared/constants/instruments");
const volatilityAnalysisService_1 = require("../analysis/volatilityAnalysisService");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('volatility.controller');
function isEnabledSymbol(value) {
    return instruments_1.ENABLED_SYMBOLS.includes(value);
}
function isEnabledTimeframe(value) {
    return instruments_1.ENABLED_TIMEFRAMES.includes(value);
}
async function getVolatilityEndpoint(req, res) {
    const symbol = String(req.query.symbol || '');
    const timeframe = String(req.query.timeframe || '');
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
        const result = await (0, volatilityAnalysisService_1.getVolatilityAnalysis)(symbol, timeframe, { limit });
        res.status(200).json(result);
    }
    catch (err) {
        logger.error('Failed to compute volatility analysis', {
            message: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=volatility.controller.js.map