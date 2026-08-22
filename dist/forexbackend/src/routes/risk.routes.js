"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const risk_controller_1 = require("../controllers/risk.controller");
const router = (0, express_1.Router)();
router.get('/risk', risk_controller_1.getRiskEndpoint);
exports.default = router;
//# sourceMappingURL=risk.routes.js.map