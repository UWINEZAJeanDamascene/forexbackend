"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketStructureEndpoint = getMarketStructureEndpoint;
const instruments_1 = require("../../../shared/constants/instruments");
const marketDataService_1 = require("../services/marketDataService");
const marketStructureService_1 = require("../analysis/marketStructureService");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('market-structure.controller');
function isEnabledSymbol(value) {
    return instruments_1.ENABLED_SYMBOLS.includes(value);
}
function isEnabledTimeframe(value) {
    return instruments_1.ENABLED_TIMEFRAMES.includes(value);
}
async function getMarketStructureEndpoint(req, res) {
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
        const { analysisCandles: candles } = await (0, marketDataService_1.getValidatedCandles)(symbol, timeframe, { limit });
        const result = (0, marketStructureService_1.getMarketStructure)(candles, { swingWindow });
        res.status(200).json({
            symbol,
            timeframe,
            structure: result.structure,
        });
    }
    catch (err) {
        logger.error('Failed to compute market structure', {
            message: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=market-structure.controller.js.map