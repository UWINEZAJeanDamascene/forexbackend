"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const confidence_controller_1 = require("../controllers/confidence.controller");
const router = (0, express_1.Router)();
router.get('/confidence', confidence_controller_1.getConfidenceEndpoint);
exports.default = router;
//# sourceMappingURL=confidence.routes.js.map