"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHistoricalExecutionPlan = buildHistoricalExecutionPlan;
exports.calculateHistoricalPositionSize = calculateHistoricalPositionSize;
const instrumentConfig_1 = require("../../../shared/constants/instrumentConfig");
const positionSizing_1 = require("../../../shared/utils/positionSizing");
const historicalStrategyEvaluator_1 = require("./historicalStrategyEvaluator");
function lastValue(values) {
    for (let index = values.length - 1; index >= 0; index -= 1) {
        if (values[index] !== null && values[index] !== undefined)
            return values[index];
    }
    return null;
}
function nearestBelow(price, values) {
    return values.filter((value) => value < price).sort((a, b) => b - a)[0] ?? null;
}
function nearestAbove(price, values) {
    return values.filter((value) => value > price).sort((a, b) => a - b)[0] ?? null;
}
function historicalStop(setup, entryPrice, execution) {
    const { direction, snapshot } = setup;
    if (execution.stopLossModel === 'atr') {
        const atr = lastValue(snapshot.indicators.atr14);
        if (atr === null || atr <= 0 || execution.atrStopMultiplier <= 0)
            throw new Error('ATR stop requires a positive historical ATR and multiplier.');
        return direction === 'bullish' ? entryPrice - atr * execution.atrStopMultiplier : entryPrice + atr * execution.atrStopMultiplier;
    }
    const swingPrices = direction === 'bullish'
        ? snapshot.structure.swingLows.map((swing) => swing.price)
        : snapshot.structure.swingHighs.map((swing) => swing.price);
    const levelPrices = direction === 'bullish'
        ? snapshot.supportResistance.supports.map((level) => level.zoneLow)
        : snapshot.supportResistance.resistances.map((level) => level.zoneHigh);
    const level = direction === 'bullish'
        ? nearestBelow(entryPrice, [...swingPrices, ...levelPrices])
        : nearestAbove(entryPrice, [...swingPrices, ...levelPrices]);
    if (level === null)
        throw new Error('Structure stop requires a confirmed historical level on the correct side of entry.');
    return level;
}
function historicalTarget(setup, entryPrice, stopPrice, execution) {
    const { direction, snapshot } = setup;
    const riskDistance = Math.abs(entryPrice - stopPrice);
    if (riskDistance <= 0)
        throw new Error('Stop must be a non-zero distance from entry.');
    if (execution.takeProfitModel === 'risk_reward') {
        if (execution.riskRewardRatio <= 0)
            throw new Error('Risk/reward ratio must be positive.');
        return direction === 'bullish' ? entryPrice + riskDistance * execution.riskRewardRatio : entryPrice - riskDistance * execution.riskRewardRatio;
    }
    if (execution.takeProfitModel === 'atr') {
        const atr = lastValue(snapshot.indicators.atr14);
        if (atr === null || atr <= 0 || execution.atrTargetMultiplier <= 0)
            throw new Error('ATR target requires a positive historical ATR and multiplier.');
        return direction === 'bullish' ? entryPrice + atr * execution.atrTargetMultiplier : entryPrice - atr * execution.atrTargetMultiplier;
    }
    if (execution.takeProfitModel === 'price') {
        if (execution.fixedTargetPrice === undefined || !Number.isFinite(execution.fixedTargetPrice))
            throw new Error('Fixed-price target requires fixedTargetPrice.');
        return execution.fixedTargetPrice;
    }
    const prices = direction === 'bullish'
        ? snapshot.supportResistance.resistances.map((level) => level.zoneLow)
        : snapshot.supportResistance.supports.map((level) => level.zoneHigh);
    const target = direction === 'bullish' ? nearestAbove(entryPrice, prices) : nearestBelow(entryPrice, prices);
    if (target === null)
        throw new Error('Support/resistance target requires a historical level on the correct side of entry.');
    return target;
}
function buildHistoricalExecutionPlan(setup, candles, execution) {
    const eligibility = (0, historicalStrategyEvaluator_1.getEntryEligibility)(setup.snapshot.decisionIndex, candles, execution.entryModel, execution.entryPriceLevel);
    if (!eligibility.eligible || eligibility.entryIndex === null || eligibility.entryTimestamp === null) {
        throw new Error(`Entry is not eligible: ${eligibility.reason}`);
    }
    const pipValue = (0, instrumentConfig_1.getInstrumentConfig)(setup.snapshot.symbol).pipValue;
    const spreadCost = execution.spreadPips * pipValue;
    const slippageCost = execution.slippagePips * pipValue;
    const cost = spreadCost / 2 + slippageCost;
    const rawEntry = execution.entryModel === 'signal_close'
        ? candles[eligibility.entryIndex].close
        : execution.entryModel === 'price_level'
            ? execution.entryPriceLevel
            : candles[eligibility.entryIndex].open;
    const entryPrice = setup.direction === 'bullish' ? rawEntry + cost : rawEntry - cost;
    const stopPrice = historicalStop(setup, entryPrice, execution);
    const targetPrice = historicalTarget(setup, entryPrice, stopPrice, execution);
    const riskDistance = Math.abs(entryPrice - stopPrice);
    const rewardDistance = Math.abs(targetPrice - entryPrice);
    const stopFillPrice = setup.direction === 'bullish' ? stopPrice - cost : stopPrice + cost;
    const targetFillPrice = setup.direction === 'bullish' ? targetPrice - cost : targetPrice + cost;
    if (setup.direction === 'bullish' && (stopPrice >= entryPrice || targetPrice <= entryPrice))
        throw new Error('Bullish execution plan has invalid stop or target direction.');
    if (setup.direction === 'bearish' && (stopPrice <= entryPrice || targetPrice >= entryPrice))
        throw new Error('Bearish execution plan has invalid stop or target direction.');
    return {
        entryIndex: eligibility.entryIndex,
        entryTimestamp: eligibility.entryTimestamp,
        entryPrice,
        stopPrice,
        targetPrice,
        stopFillPrice,
        targetFillPrice,
        riskDistance,
        plannedRiskReward: rewardDistance / riskDistance,
        entryModel: execution.entryModel,
        stopLossModel: execution.stopLossModel,
        takeProfitModel: execution.takeProfitModel,
        spreadCost,
        slippageCost,
        exitSpreadCost: spreadCost / 2,
        exitSlippageCost: slippageCost,
    };
}
function calculateHistoricalPositionSize(setup, plan, accountSize, riskPercent, fixedPositionUnits, quoteToAccountRate = 1) {
    if (!Number.isFinite(accountSize) || accountSize <= 0 || !Number.isFinite(quoteToAccountRate) || quoteToAccountRate <= 0) {
        throw new Error('Account size and quote conversion rate must be positive numbers.');
    }
    const instrument = (0, instrumentConfig_1.getInstrumentConfig)(setup.snapshot.symbol);
    if (fixedPositionUnits !== undefined) {
        if (!Number.isFinite(fixedPositionUnits) || fixedPositionUnits <= 0)
            throw new Error('Fixed position units must be positive.');
        return {
            units: fixedPositionUnits,
            lots: fixedPositionUnits / instrument.lotSize,
            riskAmount: plan.riskDistance * fixedPositionUnits * quoteToAccountRate,
            riskDistance: plan.riskDistance,
            riskDistanceInPips: plan.riskDistance / instrument.pipValue,
            quoteToAccountRate,
        };
    }
    const calculation = (0, positionSizing_1.calculatePositionSize)({
        accountSize,
        riskPercent,
        currentPrice: plan.entryPrice,
        invalidationPrice: plan.stopPrice,
        symbol: setup.snapshot.symbol,
        quoteToAccountRate,
    });
    if (!calculation)
        throw new Error('Position size cannot be calculated for this instrument and stop distance.');
    return {
        units: calculation.positionSizeUnits,
        lots: calculation.positionSizeLots,
        riskAmount: calculation.riskAmount,
        riskDistance: calculation.riskDistance,
        riskDistanceInPips: calculation.riskDistanceInPips,
        quoteToAccountRate,
    };
}
//# sourceMappingURL=historicalExecutionService.js.map