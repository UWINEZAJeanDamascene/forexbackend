"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePositionSize = calculatePositionSize;
const instrumentConfig_1 = require("../constants/instrumentConfig");
const MINIMUM_STOP_DISTANCE_PIPS = 2;
const JPY_MINIMUM_STOP_DISTANCE_PIPS = 1;
function calculatePositionSize(input) {
    const { accountSize, riskPercent, currentPrice, invalidationPrice, symbol, quoteToAccountRate = 1, } = input;
    if (!Number.isFinite(accountSize) || accountSize <= 0)
        return null;
    if (!Number.isFinite(riskPercent) || riskPercent <= 0)
        return null;
    if (!Number.isFinite(currentPrice) || currentPrice <= 0)
        return null;
    if (!Number.isFinite(invalidationPrice) || invalidationPrice <= 0)
        return null;
    if (!Number.isFinite(quoteToAccountRate) || quoteToAccountRate <= 0)
        return null;
    const riskDistance = Math.abs(currentPrice - invalidationPrice);
    if (riskDistance <= 0)
        return null;
    const instrument = (0, instrumentConfig_1.getInstrumentConfig)(symbol);
    const minimumPips = symbol.includes('/JPY') ? JPY_MINIMUM_STOP_DISTANCE_PIPS : MINIMUM_STOP_DISTANCE_PIPS;
    const minimumDistance = instrument.pipValue * minimumPips;
    const floatingPointTolerance = instrument.pipValue * 1e-9;
    if (riskDistance + floatingPointTolerance < minimumDistance)
        return null;
    const riskAmount = accountSize * (riskPercent / 100);
    const positionSizeUnits = riskAmount / (riskDistance * quoteToAccountRate);
    const positionSizeLots = positionSizeUnits / instrument.lotSize;
    return {
        riskAmount,
        riskDistance,
        riskDistanceInPips: riskDistance / instrument.pipValue,
        positionSizeUnits,
        positionSizeLots,
    };
}
//# sourceMappingURL=positionSizing.js.map