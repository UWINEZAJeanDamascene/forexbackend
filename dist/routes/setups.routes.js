"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const setups_controller_1 = require("../controllers/setups.controller");
const router = (0, express_1.Router)();
router.get('/setups', setups_controller_1.getSetupsEndpoint);
exports.default = router;
//# sourceMappingURL=setups.routes.js.map