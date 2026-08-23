import { ENABLED_SYMBOLS, ENABLED_TIMEFRAMES, timeframeToMs } from '../../../shared/constants/instruments';
import { BacktestConfig } from '../../../shared/types/backtest';

export interface BacktestValidationResult {
  config: BacktestConfig | null;
  errors: string[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function positiveNumber(value: unknown, label: string, errors: string[]): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) errors.push(`${label} must be a positive number.`);
}

function nonNegativeNumber(value: unknown, label: string, errors: string[]): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) errors.push(`${label} must be a non-negative number.`);
}

export function validateBacktestConfig(input: unknown): BacktestValidationResult {
  const root = record(input);
  const errors: string[] = [];
  if (!root) return { config: null, errors: ['Backtest configuration must be an object.'] };

  const symbol = root.symbol;
  const timeframe = root.timeframe;
  if (typeof symbol !== 'string' || !ENABLED_SYMBOLS.includes(symbol as never)) errors.push(`symbol must be one of the enabled instruments.`);
  if (typeof timeframe !== 'string' || !ENABLED_TIMEFRAMES.includes(timeframe as never)) errors.push(`timeframe must be one of the enabled timeframes.`);
  if (root.higherResolutionTimeframe !== undefined) {
    if (!ENABLED_TIMEFRAMES.includes(root.higherResolutionTimeframe as never)) errors.push('higherResolutionTimeframe must be an enabled timeframe.');
    else if (typeof timeframe === 'string' && ENABLED_TIMEFRAMES.includes(timeframe as never) && timeframeToMs(root.higherResolutionTimeframe as never) >= timeframeToMs(timeframe as never)) {
      errors.push('higherResolutionTimeframe must be lower than the entry timeframe.');
    }
  }

  const period = record(root.period);
  if (!period) errors.push('period is required.');
  else {
    const start = typeof period.start === 'string' ? new Date(period.start) : null;
    const end = typeof period.end === 'string' ? new Date(period.end) : null;
    if (!start || !Number.isFinite(start.getTime())) errors.push('period.start must be a valid date.');
    if (!end || !Number.isFinite(end.getTime())) errors.push('period.end must be a valid date.');
    if (start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start >= end) errors.push('period.start must be before period.end.');
    if (period.dataSplit !== undefined && !['in_sample', 'validation', 'out_of_sample'].includes(String(period.dataSplit))) errors.push('period.dataSplit is invalid.');
    if (period.mode !== undefined && !['independent', 'cumulative'].includes(String(period.mode))) errors.push('period.mode is invalid.');
    const splitPercentages = ['inSamplePercent', 'validationPercent', 'outOfSamplePercent'].map((field) => period[field]);
    if (splitPercentages.some((value) => value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100))) errors.push('period split percentages must be numbers between 0 and 100.');
    if (splitPercentages.some((value) => value !== undefined) && splitPercentages.reduce<number>((sum, value) => sum + (typeof value === 'number' ? value : 0), 0) !== 100) errors.push('period split percentages must total 100.');
  }

  const strategy = record(root.strategy);
  if (!strategy || typeof strategy.name !== 'string' || strategy.name.trim() === '') errors.push('strategy.name is required.');
  else {
    positiveNumber(strategy.minimumConditions, 'strategy.minimumConditions', errors);
    positiveNumber(strategy.confirmedSwingWindow, 'strategy.confirmedSwingWindow', errors);
    for (const field of ['requireHigherTimeframeAlignment', 'requireMarketStructure', 'requireSupportResistance', 'requireMomentum', 'requireVolatility']) {
      if (typeof strategy[field] !== 'boolean') errors.push(`strategy.${field} must be boolean.`);
    }
  }

  const execution = record(root.execution);
  if (!execution) errors.push('execution is required.');
  else {
    const enums: Record<string, string[]> = {
      entryModel: ['next_candle_open', 'signal_close', 'price_level'],
      stopLossModel: ['structure', 'atr'],
      takeProfitModel: ['risk_reward', 'atr', 'support_resistance', 'price'],
      positionSizingMethod: ['risk_percent', 'fixed_units'],
      ambiguousCandlePolicy: ['stop_first', 'target_first', 'breakeven'],
    };
    for (const [field, values] of Object.entries(enums)) if (!values.includes(String(execution[field]))) errors.push(`execution.${field} is invalid.`);
    for (const field of ['spreadPips', 'slippagePips', 'commissionPerTrade']) nonNegativeNumber(execution[field], `execution.${field}`, errors);
    for (const field of ['atrStopMultiplier', 'atrTargetMultiplier', 'riskRewardRatio', 'maxOpenTrades']) positiveNumber(execution[field], `execution.${field}`, errors);
    if (execution.maxOpenTrades !== undefined && !Number.isInteger(execution.maxOpenTrades)) errors.push('execution.maxOpenTrades must be an integer.');
    if (execution.entryModel === 'price_level') positiveNumber(execution.entryPriceLevel, 'execution.entryPriceLevel', errors);
    if (execution.positionSizingMethod === 'fixed_units') positiveNumber(root.fixedPositionUnits, 'fixedPositionUnits', errors);
    if (execution.takeProfitModel === 'price') positiveNumber(execution.fixedTargetPrice, 'execution.fixedTargetPrice', errors);
  }

  positiveNumber(root.initialBalance, 'initialBalance', errors);
  positiveNumber(root.riskPercent, 'riskPercent', errors);
  if (!Array.isArray(root.higherTimeframes) || root.higherTimeframes.some((value) => !ENABLED_TIMEFRAMES.includes(value as never))) errors.push('higherTimeframes must contain only enabled timeframes.');
  else {
    if (new Set(root.higherTimeframes).size !== root.higherTimeframes.length) errors.push('higherTimeframes must not contain duplicates.');
    if (typeof timeframe === 'string' && ENABLED_TIMEFRAMES.includes(timeframe as never) && root.higherTimeframes.some((value) => timeframeToMs(value as never) <= timeframeToMs(timeframe as never))) errors.push('higherTimeframes must be higher than the entry timeframe.');
    if (root.higherResolutionTimeframe !== undefined && root.higherTimeframes.includes(root.higherResolutionTimeframe)) errors.push('higherResolutionTimeframe cannot also be a higher timeframe.');
  }

  return errors.length > 0 ? { config: null, errors } : { config: input as BacktestConfig, errors: [] };
}
