"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const backtest_controller_1 = require("../controllers/backtest.controller");
const router = (0, express_1.Router)();
router.post('/', backtest_controller_1.startBacktestEndpoint);
router.get('/', backtest_controller_1.listBacktestsEndpoint);
router.get('/:id/status', backtest_controller_1.getBacktestStatusEndpoint);
router.delete('/:id', backtest_controller_1.cancelBacktestEndpoint);
router.get('/:id/trades/:tradeId', backtest_controller_1.getBacktestTradeEndpoint);
router.get('/:id', backtest_controller_1.getBacktestResultsEndpoint);
exports.default = router;
//# sourceMappingURL=backtest.routes.js.map