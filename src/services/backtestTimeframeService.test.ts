import { describe, expect, it } from 'vitest';
import { Candle } from '../../../shared/types/market';
import { getCompletedCandlesAt, synchronizeHigherTimeframe } from './backtestTimeframeService';

function candle(timestamp: string, close: number): Candle {
  return { timestamp, open: close, high: close + 0.01, low: close - 0.01, close, volume: null };
}

describe('backtest timeframe synchronization', () => {
  const higher = [
    candle('2026-01-01T04:00:00.000Z', 4),
    candle('2026-01-01T00:00:00.000Z', 1),
    candle('2026-01-01T08:00:00.000Z', 8),
  ];

  it('only exposes higher-timeframe candles after their full duration', () => {
    expect(getCompletedCandlesAt(higher, '4H', '2026-01-01T03:59:59.000Z')).toHaveLength(0);
    expect(getCompletedCandlesAt(higher, '4H', '2026-01-01T04:00:00.000Z').map((item) => item.close)).toEqual([1]);
    expect(getCompletedCandlesAt(higher, '4H', '2026-01-01T08:00:00.000Z').map((item) => item.close)).toEqual([1, 4]);
  });

  it('keeps synchronized higher-timeframe context chronological for each decision candle', () => {
    const decisions = [
      candle('2026-01-01T08:00:00.000Z', 80),
      candle('2026-01-01T04:00:00.000Z', 40),
    ];
    const result = synchronizeHigherTimeframe(decisions, higher, '4H');

    expect(result[0].decisionCandle.close).toBe(40);
    expect(result[0].latestCompletedHigherTimeframeCandle?.close).toBe(1);
    expect(result[1].decisionCandle.close).toBe(80);
    expect(result[1].completedHigherTimeframeCandles.map((item) => item.close)).toEqual([1, 4]);
  });
});
