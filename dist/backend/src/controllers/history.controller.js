"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postSaveAnalysis = postSaveAnalysis;
exports.getHistoryList = getHistoryList;
exports.getHistoryDetail = getHistoryDetail;
exports.deleteHistoryItem = deleteHistoryItem;
const analysisHistoryService_1 = require("../services/analysisHistoryService");
const logger_1 = require("../utils/logger");
const analysisHistoryValidator_1 = require("../validation/analysisHistoryValidator");
const logger = (0, logger_1.createLogger)('history.controller');
async function postSaveAnalysis(req, res) {
    try {
        const errors = (0, analysisHistoryValidator_1.validateSaveAnalysisRequest)(req.body);
        if (errors.length > 0) {
            res.status(400).json({ error: 'Invalid analysis snapshot: required fields or values are invalid.', issues: errors });
            return;
        }
        const body = req.body;
        const result = await (0, analysisHistoryService_1.saveAnalysis)(body, req.historyUserId);
        res.status(201).json({
            id: result.id,
            symbol: body.symbol,
            timeframe: body.timeframe,
            analysisTimestamp: body.analysisTimestamp,
            message: 'Analysis saved to history.',
        });
    }
    catch (err) {
        logger.error('Failed to save analysis', {
            message: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Analysis completed, but could not be saved to history.' });
    }
}
async function getHistoryList(req, res) {
    try {
        const options = {};
        const page = req.query.page;
        if (page !== undefined) {
            const parsed = Number(page);
            if (!Number.isInteger(parsed) || parsed < 1) {
                res.status(400).json({ error: 'page must be a positive integer.' });
                return;
            }
            options.page = parsed;
        }
        const pageSize = req.query.pageSize;
        if (pageSize !== undefined) {
            const parsed = Number(pageSize);
            if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
                res.status(400).json({ error: 'pageSize must be an integer between 1 and 100.' });
                return;
            }
            options.pageSize = parsed;
        }
        const search = req.query.search;
        if (search !== undefined) {
            if (typeof search !== 'string' || search.trim().length > 100) {
                res.status(400).json({ error: 'search must be a string with at most 100 characters.' });
                return;
            }
            options.search = search.trim();
        }
        const symbol = req.query.symbol;
        if (symbol !== undefined && typeof symbol === 'string') {
            options.symbol = symbol;
        }
        const timeframe = req.query.timeframe;
        if (timeframe !== undefined && typeof timeframe === 'string') {
            options.timeframe = timeframe;
        }
        const trend = req.query.trend;
        if (trend !== undefined && typeof trend === 'string') {
            options.trend = trend;
        }
        const startDate = req.query.startDate;
        if (startDate !== undefined && typeof startDate === 'string') {
            options.startDate = startDate;
        }
        const endDate = req.query.endDate;
        if (endDate !== undefined && typeof endDate === 'string') {
            options.endDate = endDate;
        }
        const minConfidence = req.query.minConfidence;
        if (minConfidence !== undefined) {
            const parsed = Number(minConfidence);
            if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
                res.status(400).json({ error: 'minConfidence must be a number between 0 and 100.' });
                return;
            }
            options.minConfidence = parsed;
        }
        const maxConfidence = req.query.maxConfidence;
        if (maxConfidence !== undefined) {
            const parsed = Number(maxConfidence);
            if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
                res.status(400).json({ error: 'maxConfidence must be a number between 0 and 100.' });
                return;
            }
            options.maxConfidence = parsed;
        }
        const result = await (0, analysisHistoryService_1.listHistory)(options, req.historyUserId);
        res.status(200).json(result);
    }
    catch (err) {
        logger.error('Failed to list history', {
            message: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function getHistoryDetail(req, res) {
    try {
        const { id } = req.params;
        if (!id || typeof id !== 'string') {
            res.status(400).json({ error: 'Analysis id is required.' });
            return;
        }
        const analysis = await (0, analysisHistoryService_1.getAnalysisDetail)(id, req.historyUserId);
        if (!analysis) {
            res.status(404).json({ error: 'Analysis not found.' });
            return;
        }
        res.status(200).json(analysis);
    }
    catch (err) {
        logger.error('Failed to fetch analysis detail', {
            message: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function deleteHistoryItem(req, res) {
    try {
        const { id } = req.params;
        if (!id || typeof id !== 'string') {
            res.status(400).json({ error: 'Analysis id is required.' });
            return;
        }
        const deleted = await (0, analysisHistoryService_1.deleteAnalysis)(id, req.historyUserId);
        if (!deleted) {
            res.status(404).json({ error: 'Analysis not found or could not be deleted.' });
            return;
        }
        res.status(204).send();
    }
    catch (err) {
        logger.error('Failed to delete analysis', {
            message: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=history.controller.js.map