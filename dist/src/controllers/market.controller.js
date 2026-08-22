"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCandles = getCandles;
exports.getSymbols = getSymbols;
exports.getTimeframes = getTimeframes;
const instruments_1 = require("../../../shared/constants/instruments");
const marketDataService_1 = require("../services/marketDataService");
const validation_1 = require("../validation");
const MarketDataProvider_1 = require("../providers/MarketDataProvider");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('market.controller');
function isEnabledSymbol(value) {
    return instruments_1.ENABLED_SYMBOLS.includes(value);
}
function isEnabledTimeframe(value) {
    return instruments_1.ENABLED_TIMEFRAMES.includes(value);
}
/**
 * Maps our normalized error types to HTTP status codes. Never leaks raw
 * error internals (stack traces, provider payloads) to the client - only
 * a safe, human-readable message.
 */
function respondWithError(res, err) {
    if (err instanceof validation_1.DataValidationError) {
        res.status(422).json({
            error: 'Market data failed validation and is not usable right now.',
            issues: err.issues.map((i) => ({ type: i.type, severity: i.severity, message: i.message })),
        });
        return;
    }
    if (err instanceof MarketDataProvider_1.MarketDataError) {
        const statusByKind = {
            CONFIG_ERROR: 500,
            UNSUPPORTED_SYMBOL: 400,
            UNSUPPORTED_TIMEFRAME: 400,
            RATE_LIMIT: 429,
            NETWORK_ERROR: 502,
            INVALID_RESPONSE: 502,
            PROVIDER_ERROR: 502,
        };
        const status = statusByKind[err.kind] ?? 502;
        const message = err.kind === 'CONFIG_ERROR'
            ? 'Market data provider is not configured on the server.'
            : 'Market data is temporarily unavailable. Please try again.';
        logger.error('Market data request failed', { kind: err.kind, provider: err.provider });
        res.status(status).json({ error: message });
        return;
    }
    logger.error('Unexpected error handling market data request', {
        message: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Internal server error' });
}
/**
 * GET /api/market/candles?symbol=EUR/USD&timeframe=1H&limit=100
 *
 * Returns validated candles ready for the chart. This is the ONLY way the
 * frontend gets market data - it never talks to the provider or Twelve
 * Data directly.
 */
async function getCandles(req, res) {
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
        const { candles, issues } = await (0, marketDataService_1.getValidatedCandles)(symbol, timeframe, { limit });
        res.status(200).json({
            symbol,
            timeframe,
            candles,
            // Surface non-fatal issues (e.g. gap warnings) so the UI can show a
            // subtle data-quality note without blocking the chart.
            warnings: issues.filter((i) => i.severity === 'warning').map((i) => i.message),
        });
    }
    catch (err) {
        respondWithError(res, err);
    }
}
/** GET /api/market/symbols and /api/market/timeframes - lets the frontend build its selectors from the same source of truth as the backend. */
function getSymbols(_req, res) {
    res.status(200).json({ symbols: instruments_1.ENABLED_SYMBOLS });
}
function getTimeframes(_req, res) {
    res.status(200).json({ timeframes: instruments_1.ENABLED_TIMEFRAMES });
}
//# sourceMappingURL=market.controller.js.map