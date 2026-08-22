"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const support_resistance_controller_1 = require("../controllers/support-resistance.controller");
const router = (0, express_1.Router)();
router.get('/market/support-resistance', support_resistance_controller_1.getSupportResistanceEndpoint);
exports.default = router;
//# sourceMappingURL=support-resistance.routes.js.map