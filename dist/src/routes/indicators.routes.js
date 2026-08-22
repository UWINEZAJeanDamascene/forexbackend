"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const indicators_controller_1 = require("../controllers/indicators.controller");
const router = (0, express_1.Router)();
router.get('/market/indicators', indicators_controller_1.getIndicators);
exports.default = router;
//# sourceMappingURL=indicators.routes.js.map