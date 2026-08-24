"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupportResistance = getSupportResistance;
const supportResistanceEngine_1 = require("./supportResistanceEngine");
function getSupportResistance(candles, options = {}) {
    const swingWindow = options.swingWindow ?? 2;
    return (0, supportResistanceEngine_1.detectSupportResistance)(candles, swingWindow, { confirmedSwingOnly: options.confirmedSwingOnly });
}
//# sourceMappingURL=supportResistanceService.js.map