"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIndicators = getIndicators;
const instruments_1 = require("../../../shared/constants/instruments");
const marketDataService_1 = require("../services/marketDataService");
const indicatorService_1 = require("../analysis/indicatorService");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('indicators.controller');
function isEnabledSymbol(value) {
    return instruments_1.ENABLED_SYMBOLS.includes(value);
}
function isEnabledTimeframe(value) {
    return instruments_1.ENABLED_TIMEFRAMES.includes(value);
}
/**
 * GET /api/market/indicators?symbol=EUR/USD&timeframe=1H
 *
 * Returns all computed technical indicators for the requested symbol and
 * timeframe. Each indicator array is aligned with the returned candles
 * (same length, same order), so the frontend can overlay them on the chart
 * or display the latest values.
 */
async function getIndicators(req, res) {
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
        const validated = await (0, marketDataService_1.getValidatedCandles)(symbol, timeframe, { limit });
        const candles = validated.analysisCandles ?? validated.candles;
        const result = (0, indicatorService_1.computeIndicators)(candles, symbol, timeframe);
        res.status(200).json(result);
    }
    catch (err) {
        logger.error('Failed to compute indicators', {
            message: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=indicators.controller.js.map