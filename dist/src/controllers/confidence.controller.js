"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfidenceEndpoint = getConfidenceEndpoint;
const instruments_1 = require("../../../shared/constants/instruments");
const confidenceAnalysisService_1 = require("../analysis/confidenceAnalysisService");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('confidence.controller');
function isEnabledSymbol(value) {
    return instruments_1.ENABLED_SYMBOLS.includes(value);
}
function isEnabledTimeframe(value) {
    return instruments_1.ENABLED_TIMEFRAMES.includes(value);
}
async function getConfidenceEndpoint(req, res) {
    const symbol = String(req.query.symbol || '');
    const timeframe = String(req.query.timeframe || '');
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
    try {
        const result = await (0, confidenceAnalysisService_1.getConfidenceAnalysis)(symbol, timeframe);
        res.status(200).json(result);
    }
    catch (err) {
        logger.error('Failed to compute confidence analysis', {
            message: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=confidence.controller.js.map