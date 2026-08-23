import { describe, expect, it } from 'vitest';
import { DEFAULT_BACKTEST_EXECUTION_ASSUMPTIONS } from '../../../shared/types/backtest';
import { validateBacktestConfig } from './backtestValidator';

const validConfig = {
  symbol: 'EUR/USD',
  timeframe: '1H',
  higherTimeframes: [],
  period: { start: '2025-01-01T00:00:00.000Z', end: '2025-03-01T00:00:00.000Z', dataSplit: 'in_sample' },
  strategy: {
    name: 'Trend test',
    minimumConditions: 1,
    requireHigherTimeframeAlignment: false,
    requireMarketStructure: false,
    requireSupportResistance: false,
    requireMomentum: false,
    requireVolatility: false,
    confirmedSwingWindow: 2,
  },
  execution: { ...DEFAULT_BACKTEST_EXECUTION_ASSUMPTIONS },
  initialBalance: 10000,
  riskPercent: 1,
};

describe('validateBacktestConfig', () => {
  it('accepts a complete supported configuration', () => {
    const result = validateBacktestConfig(validConfig);
    expect(result.errors).toEqual([]);
    expect(result.config).toEqual(validConfig);
  });

  it('rejects invalid market, date, and risk configuration', () => {
    const result = validateBacktestConfig({
      ...validConfig,
      symbol: 'NOT_SUPPORTED',
      period: { start: 'not-a-date', end: '2024-01-01T00:00:00.000Z' },
      initialBalance: 0,
      riskPercent: -1,
    });
    expect(result.config).toBeNull();
    expect(result.errors).toEqual(expect.arrayContaining([
      'symbol must be one of the enabled instruments.',
      'period.start must be a valid date.',
      'initialBalance must be a positive number.',
      'riskPercent must be a positive number.',
    ]));
  });

  it('requires a fixed target for the fixed-price target model', () => {
    const result = validateBacktestConfig({
      ...validConfig,
      execution: { ...validConfig.execution, takeProfitModel: 'price' },
    });
    expect(result.errors).toContain('execution.fixedTargetPrice must be a positive number.');
  });

  it('rejects a higher-resolution timeframe that is not actually lower', () => {
    const result = validateBacktestConfig({ ...validConfig, higherResolutionTimeframe: '4H' });
    expect(result.errors).toContain('higherResolutionTimeframe must be lower than the entry timeframe.');
  });
});
