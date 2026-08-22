"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePositionSize = calculatePositionSize;
const instrumentConfig_1 = require("../constants/instrumentConfig");
/**
 * Calculates the position size for an instrument whose price movement is
 * denominated in its quote currency. quoteToAccountRate converts one quote
 * currency unit into one account-currency unit.
 */
function calculatePositionSize(params) {
    const { accountSize, riskPercent, currentPrice, invalidationPrice, symbol, quoteToAccountRate } = params;
    if (![accountSize, riskPercent, currentPrice, invalidationPrice, quoteToAccountRate].every(Number.isFinite))
        return null;
    if (accountSize <= 0 || riskPercent <= 0 || currentPrice <= 0 || invalidationPrice <= 0 || quoteToAccountRate <= 0)
        return null;
    const config = (0, instrumentConfig_1.getInstrumentConfig)(symbol);
    const riskDistance = Math.abs(currentPrice - invalidationPrice);
    const riskDistanceInPips = riskDistance / config.pipValue;
    if (riskDistance <= 0 ||
        config.pipValue <= 0 ||
        config.lotSize <= 0 ||
        riskDistanceInPips < config.minStopDistancePips - 1e-9)
        return null;
    const riskAmount = accountSize * (riskPercent / 100);
    const lossPerUnitInAccountCurrency = riskDistance * quoteToAccountRate;
    if (lossPerUnitInAccountCurrency <= 0)
        return null;
    const positionSizeUnits = riskAmount / lossPerUnitInAccountCurrency;
    return {
        riskAmount,
        riskDistance,
        riskDistanceInPips,
        positionSizeUnits,
        positionSizeLots: positionSizeUnits / config.lotSize,
    };
}
//# sourceMappingURL=positionSizing.js.map