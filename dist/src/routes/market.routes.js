"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const market_controller_1 = require("../controllers/market.controller");
const router = (0, express_1.Router)();
router.get('/market/candles', market_controller_1.getCandles);
router.get('/market/symbols', market_controller_1.getSymbols);
router.get('/market/timeframes', market_controller_1.getTimeframes);
exports.default = router;
//# sourceMappingURL=market.routes.js.map