"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMultiTimeframeAnalysis = getMultiTimeframeAnalysis;
const multiTimeframeAnalysisEngine_1 = require("./multiTimeframeAnalysisEngine");
async function getMultiTimeframeAnalysis(symbol, timeframe) {
    const multiTimeframe = await (0, multiTimeframeAnalysisEngine_1.analyzeMultiTimeframe)(symbol, timeframe);
    return {
        symbol,
        timeframe,
        multiTimeframe,
    };
}
//# sourceMappingURL=multiTimeframeAnalysisService.js.map