"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketStructure = getMarketStructure;
exports.getStructureEvents = getStructureEvents;
const marketStructureEngine_1 = require("./marketStructureEngine");
function getMarketStructure(candles, options = {}) {
    const swingWindow = options.swingWindow ?? 2;
    const result = (0, marketStructureEngine_1.detectMarketStructure)(candles, swingWindow, { confirmedSwingOnly: options.confirmedSwingOnly });
    return result;
}
function getStructureEvents(candles, options = {}) {
    const swingWindow = options.swingWindow ?? 2;
    return (0, marketStructureEngine_1.detectMarketStructure)(candles, swingWindow, { confirmedSwingOnly: options.confirmedSwingOnly });
}
//# sourceMappingURL=marketStructureService.js.map