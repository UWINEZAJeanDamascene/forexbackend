"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBacktestConfig = validateBacktestConfig;
const instruments_1 = require("../../../shared/constants/instruments");
function record(value) {
    return value !== null && typeof value === 'object' ? value : null;
}
function positiveNumber(value, label, errors) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
        errors.push(`${label} must be a positive number.`);
}
function nonNegativeNumber(value, label, errors) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
        errors.push(`${label} must be a non-negative number.`);
}
function validateBacktestConfig(input) {
    const root = record(input);
    const errors = [];
    if (!root)
        return { config: null, errors: ['Backtest configuration must be an object.'] };
    const symbol = root.symbol;
    const timeframe = root.timeframe;
    if (typeof symbol !== 'string' || !instruments_1.ENABLED_SYMBOLS.includes(symbol))
        errors.push(`symbol must be one of the enabled instruments.`);
    if (typeof timeframe !== 'string' || !instruments_1.ENABLED_TIMEFRAMES.includes(timeframe))
        errors.push(`timeframe must be one of the enabled timeframes.`);
    if (root.higherResolutionTimeframe !== undefined) {
        if (!instruments_1.ENABLED_TIMEFRAMES.includes(root.higherResolutionTimeframe))
            errors.push('higherResolutionTimeframe must be an enabled timeframe.');
        else if (typeof timeframe === 'string' && instruments_1.ENABLED_TIMEFRAMES.includes(timeframe) && (0, instruments_1.timeframeToMs)(root.higherResolutionTimeframe) >= (0, instruments_1.timeframeToMs)(timeframe)) {
            errors.push('higherResolutionTimeframe must be lower than the entry timeframe.');
        }
    }
    const period = record(root.period);
    if (!period)
        errors.push('period is required.');
    else {
        const start = typeof period.start === 'string' ? new Date(period.start) : null;
        const end = typeof period.end === 'string' ? new Date(period.end) : null;
        if (!start || !Number.isFinite(start.getTime()))
            errors.push('period.start must be a valid date.');
        if (!end || !Number.isFinite(end.getTime()))
            errors.push('period.end must be a valid date.');
        if (start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start >= end)
            errors.push('period.start must be before period.end.');
        if (period.dataSplit !== undefined && !['in_sample', 'validation', 'out_of_sample'].includes(String(period.dataSplit)))
            errors.push('period.dataSplit is invalid.');
        if (period.mode !== undefined && !['independent', 'cumulative'].includes(String(period.mode)))
            errors.push('period.mode is invalid.');
        const splitPercentages = ['inSamplePercent', 'validationPercent', 'outOfSamplePercent'].map((field) => period[field]);
        if (splitPercentages.some((value) => value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)))
            errors.push('period split percentages must be numbers between 0 and 100.');
        if (splitPercentages.some((value) => value !== undefined) && splitPercentages.reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0) !== 100)
            errors.push('period split percentages must total 100.');
    }
    const strategy = record(root.strategy);
    if (!strategy || typeof strategy.name !== 'string' || strategy.name.trim() === '')
        errors.push('strategy.name is required.');
    else {
        positiveNumber(strategy.minimumConditions, 'strategy.minimumConditions', errors);
        positiveNumber(strategy.confirmedSwingWindow, 'strategy.confirmedSwingWindow', errors);
        for (const field of ['requireHigherTimeframeAlignment', 'requireMarketStructure', 'requireSupportResistance', 'requireMomentum', 'requireVolatility']) {
            if (typeof strategy[field] !== 'boolean')
                errors.push(`strategy.${field} must be boolean.`);
        }
    }
    const execution = record(root.execution);
    if (!execution)
        errors.push('execution is required.');
    else {
        const enums = {
            entryModel: ['next_candle_open', 'signal_close', 'price_level'],
            stopLossModel: ['structure', 'atr'],
            takeProfitModel: ['risk_reward', 'atr', 'support_resistance', 'price'],
            positionSizingMethod: ['risk_percent', 'fixed_units'],
            ambiguousCandlePolicy: ['stop_first', 'target_first', 'breakeven'],
        };
        for (const [field, values] of Object.entries(enums))
            if (!values.includes(String(execution[field])))
                errors.push(`execution.${field} is invalid.`);
        for (const field of ['spreadPips', 'slippagePips', 'commissionPerTrade'])
            nonNegativeNumber(execution[field], `execution.${field}`, errors);
        for (const field of ['atrStopMultiplier', 'atrTargetMultiplier', 'riskRewardRatio', 'maxOpenTrades'])
            positiveNumber(execution[field], `execution.${field}`, errors);
        if (execution.maxOpenTrades !== undefined && !Number.isInteger(execution.maxOpenTrades))
            errors.push('execution.maxOpenTrades must be an integer.');
        if (execution.entryModel === 'price_level')
            positiveNumber(execution.entryPriceLevel, 'execution.entryPriceLevel', errors);
        if (execution.positionSizingMethod === 'fixed_units')
            positiveNumber(root.fixedPositionUnits, 'fixedPositionUnits', errors);
        if (execution.takeProfitModel === 'price')
            positiveNumber(execution.fixedTargetPrice, 'execution.fixedTargetPrice', errors);
    }
    positiveNumber(root.initialBalance, 'initialBalance', errors);
    positiveNumber(root.riskPercent, 'riskPercent', errors);
    if (!Array.isArray(root.higherTimeframes) || root.higherTimeframes.some((value) => !instruments_1.ENABLED_TIMEFRAMES.includes(value)))
        errors.push('higherTimeframes must contain only enabled timeframes.');
    else {
        if (new Set(root.higherTimeframes).size !== root.higherTimeframes.length)
            errors.push('higherTimeframes must not contain duplicates.');
        if (typeof timeframe === 'string' && instruments_1.ENABLED_TIMEFRAMES.includes(timeframe) && root.higherTimeframes.some((value) => (0, instruments_1.timeframeToMs)(value) <= (0, instruments_1.timeframeToMs)(timeframe)))
            errors.push('higherTimeframes must be higher than the entry timeframe.');
        if (root.higherResolutionTimeframe !== undefined && root.higherTimeframes.includes(root.higherResolutionTimeframe))
            errors.push('higherResolutionTimeframe cannot also be a higher timeframe.');
    }
    return errors.length > 0 ? { config: null, errors } : { config: input, errors: [] };
}
//# sourceMappingURL=backtestValidator.js.map