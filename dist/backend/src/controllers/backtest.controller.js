"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBacktestEndpoint = startBacktestEndpoint;
exports.listBacktestsEndpoint = listBacktestsEndpoint;
exports.getBacktestStatusEndpoint = getBacktestStatusEndpoint;
exports.getBacktestResultsEndpoint = getBacktestResultsEndpoint;
exports.getBacktestTradeEndpoint = getBacktestTradeEndpoint;
exports.cancelBacktestEndpoint = cancelBacktestEndpoint;
const backtestValidator_1 = require("../validation/backtestValidator");
const backtestService_1 = require("../services/backtestService");
const backtestPersistenceService_1 = require("../services/backtestPersistenceService");
function userId(req) {
    return req.historyUserId;
}
async function startBacktestEndpoint(req, res) {
    const input = req.body?.config ?? req.body;
    const validation = (0, backtestValidator_1.validateBacktestConfig)(input);
    if (!validation.config) {
        res.status(400).json({ error: 'Invalid backtest configuration.', issues: validation.errors });
        return;
    }
    try {
        const result = await (0, backtestService_1.startBacktest)(validation.config, userId(req));
        res.status(202).json({ id: result.id, status: 'queued', message: 'Backtest queued.' });
    }
    catch (error) {
        res.status(503).json({ error: error instanceof Error ? error.message : 'Could not queue backtest.' });
    }
}
async function listBacktestsEndpoint(req, res) {
    try {
        res.status(200).json({ backtests: await (0, backtestPersistenceService_1.listBacktestRuns)(userId(req)) });
    }
    catch {
        res.status(500).json({ error: 'Could not load backtests.' });
    }
}
async function getBacktestStatusEndpoint(req, res) {
    try {
        const run = await (0, backtestPersistenceService_1.getBacktestRun)(req.params.id, userId(req));
        if (!run) {
            res.status(404).json({ error: 'Backtest not found.' });
            return;
        }
        res.status(200).json({ id: run.id, status: run.status, error: run.error, createdAt: run.createdAt, completedAt: run.completedAt });
    }
    catch {
        res.status(500).json({ error: 'Could not load backtest status.' });
    }
}
async function getBacktestResultsEndpoint(req, res) {
    try {
        const run = await (0, backtestPersistenceService_1.getBacktestRun)(req.params.id, userId(req));
        if (!run) {
            res.status(404).json({ error: 'Backtest not found.' });
            return;
        }
        res.status(200).json(run);
    }
    catch {
        res.status(500).json({ error: 'Could not load backtest results.' });
    }
}
async function getBacktestTradeEndpoint(req, res) {
    try {
        const trade = await (0, backtestPersistenceService_1.getBacktestTrade)(req.params.tradeId, userId(req));
        if (!trade || trade.backtestId !== req.params.id) {
            res.status(404).json({ error: 'Backtest trade not found.' });
            return;
        }
        res.status(200).json(trade);
    }
    catch {
        res.status(500).json({ error: 'Could not load backtest trade.' });
    }
}
async function cancelBacktestEndpoint(req, res) {
    try {
        const cancelled = await (0, backtestPersistenceService_1.cancelBacktest)(req.params.id, userId(req));
        res.status(cancelled ? 200 : 409).json({ id: req.params.id, status: cancelled ? 'cancelled' : 'Not cancellable.' });
    }
    catch {
        res.status(500).json({ error: 'Could not cancel backtest.' });
    }
}
//# sourceMappingURL=backtest.controller.js.map