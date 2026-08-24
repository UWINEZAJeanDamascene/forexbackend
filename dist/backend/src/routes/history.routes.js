"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const history_controller_1 = require("../controllers/history.controller");
const router = (0, express_1.Router)();
router.post('/history', history_controller_1.postSaveAnalysis);
router.get('/history', history_controller_1.getHistoryList);
router.get('/history/:id', history_controller_1.getHistoryDetail);
router.delete('/history/:id', history_controller_1.deleteHistoryItem);
exports.default = router;
//# sourceMappingURL=history.routes.js.map