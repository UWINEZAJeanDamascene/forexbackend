"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const market_structure_controller_1 = require("../controllers/market-structure.controller");
const router = (0, express_1.Router)();
router.get('/market/structure', market_structure_controller_1.getMarketStructureEndpoint);
exports.default = router;
//# sourceMappingURL=market-structure.routes.js.map