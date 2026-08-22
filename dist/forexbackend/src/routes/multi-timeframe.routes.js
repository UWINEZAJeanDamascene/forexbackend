"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multi_timeframe_controller_1 = require("../controllers/multi-timeframe.controller");
const router = (0, express_1.Router)();
router.get('/analysis/multi-timeframe', multi_timeframe_controller_1.getMultiTimeframeEndpoint);
exports.default = router;
//# sourceMappingURL=multi-timeframe.routes.js.map