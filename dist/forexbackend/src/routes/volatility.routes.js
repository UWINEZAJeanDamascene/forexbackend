"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const volatility_controller_1 = require("../controllers/volatility.controller");
const router = (0, express_1.Router)();
router.get('/analysis/volatility', volatility_controller_1.getVolatilityEndpoint);
exports.default = router;
//# sourceMappingURL=volatility.routes.js.map