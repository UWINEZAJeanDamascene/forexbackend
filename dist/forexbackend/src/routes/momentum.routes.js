"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const momentum_controller_1 = require("../controllers/momentum.controller");
const router = (0, express_1.Router)();
router.get('/analysis/momentum', momentum_controller_1.getMomentumEndpoint);
exports.default = router;
//# sourceMappingURL=momentum.routes.js.map