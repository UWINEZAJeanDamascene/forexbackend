import { describe, expect, it } from 'vitest';
import { BacktestConfig, BacktestPeriodResult } from '../../../shared/types/backtest';
import { getPeriodStartingBalances } from './backtestService';

const config = { initialBalance: 10000, period: { start: '2026-01-01', end: '2026-01-02' } } as BacktestConfig;
const periods = [
  { metrics: { netProfit: 500 } },
  { metrics: { netProfit: -200 } },
] as BacktestPeriodResult[];

describe('backtest period balance semantics', () => {
  it('keeps each split independent by default', () => {
    expect(getPeriodStartingBalances(config, periods)).toEqual([10000, 10000]);
  });

  it('carries realized balance into the next split when configured', () => {
    const cumulative = { ...config, period: { ...config.period, mode: 'cumulative' as const } };
    expect(getPeriodStartingBalances(cumulative, periods)).toEqual([10000, 10500]);
  });
});