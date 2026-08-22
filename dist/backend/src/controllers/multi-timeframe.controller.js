"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMultiTimeframeEndpoint = getMultiTimeframeEndpoint;
const instruments_1 = require("../../../shared/constants/instruments");
const multiTimeframeAnalysisService_1 = require("../analysis/multiTimeframeAnalysisService");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('multiTimeframe.controller');
function isEnabledSymbol(value) {
    return instruments_1.ENABLED_SYMBOLS.includes(value);
}
function isEnabledTimeframe(value) {
    return instruments_1.ENABLED_TIMEFRAMES.includes(value);
}
async function getMultiTimeframeEndpoint(req, res) {
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
        const result = await (0, multiTimeframeAnalysisService_1.getMultiTimeframeAnalysis)(symbol, timeframe);
        res.status(200).json(result);
    }
    catch (err) {
        logger.error('Failed to compute multi-timeframe analysis', {
            message: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=multi-timeframe.controller.js.map