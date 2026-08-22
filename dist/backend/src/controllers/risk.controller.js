"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRiskEndpoint = getRiskEndpoint;
const instruments_1 = require("../../../shared/constants/instruments");
const riskAnalysisService_1 = require("../analysis/riskAnalysisService");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('risk.controller');
function isEnabledSymbol(value) {
    return instruments_1.ENABLED_SYMBOLS.includes(value);
}
function isEnabledTimeframe(value) {
    return instruments_1.ENABLED_TIMEFRAMES.includes(value);
}
async function getRiskEndpoint(req, res) {
    const symbol = String(req.query.symbol || '');
    const timeframe = String(req.query.timeframe || '');
    const accountSizeRaw = req.query.accountSize;
    const maxRiskPercentRaw = req.query.maxRiskPercent;
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
    const request = { symbol, timeframe };
    if (accountSizeRaw !== undefined) {
        const parsed = Number(accountSizeRaw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            res.status(400).json({ error: 'accountSize must be a positive number.' });
            return;
        }
        request.accountSize = parsed;
    }
    if (maxRiskPercentRaw !== undefined) {
        const parsed = Number(maxRiskPercentRaw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            res.status(400).json({ error: 'maxRiskPercent must be a positive number.' });
            return;
        }
        request.maxRiskPercent = parsed;
    }
    try {
        const result = await (0, riskAnalysisService_1.getRiskAnalysis)(symbol, timeframe, request);
        res.status(200).json(result);
    }
    catch (err) {
        logger.error('Failed to compute risk analysis', {
            message: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=risk.controller.js.map