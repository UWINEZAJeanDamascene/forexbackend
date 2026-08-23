import { Candle } from '../../../shared/types/market';
import { Timeframe, timeframeToMs } from '../../../shared/constants/instruments';

export interface SynchronizedCandleContext {
  decisionCandle: Candle;
  completedHigherTimeframeCandles: Candle[];
  latestCompletedHigherTimeframeCandle: Candle | null;
}

function candleStartMs(candle: Candle): number {
  return new Date(candle.timestamp).getTime();
}

/**
 * Provider timestamps represent candle starts. A candle is usable at a
 * decision timestamp only after its full timeframe duration has elapsed.
 */
export function getCompletedCandlesAt(
  candles: Candle[],
  timeframe: Timeframe,
  decisionTimestamp: string | Date
): Candle[] {
  const decisionMs = typeof decisionTimestamp === 'string'
    ? new Date(decisionTimestamp).getTime()
    : decisionTimestamp.getTime();
  if (!Number.isFinite(decisionMs)) return [];

  return candles
    .filter((candle) => {
      const startMs = candleStartMs(candle);
      return Number.isFinite(startMs) && startMs + timeframeToMs(timeframe) <= decisionMs;
    })
    .sort((a, b) => candleStartMs(a) - candleStartMs(b));
}

export function synchronizeHigherTimeframe(
  decisionCandles: Candle[],
  higherTimeframeCandles: Candle[],
  higherTimeframe: Timeframe
): SynchronizedCandleContext[] {
  const sortedDecisions = [...decisionCandles].sort((a, b) => candleStartMs(a) - candleStartMs(b));
  const sortedHigher = [...higherTimeframeCandles].sort((a, b) => candleStartMs(a) - candleStartMs(b));
  let completedCount = 0;
  const contexts: SynchronizedCandleContext[] = [];

  for (const decisionCandle of sortedDecisions) {
    const decisionMs = candleStartMs(decisionCandle);
    while (
      completedCount < sortedHigher.length &&
      candleStartMs(sortedHigher[completedCount]) + timeframeToMs(higherTimeframe) <= decisionMs
    ) {
      completedCount++;
    }

    const completed = sortedHigher.slice(0, completedCount);
    contexts.push({
      decisionCandle,
      completedHigherTimeframeCandles: completed,
      latestCompletedHigherTimeframeCandle: completed.at(-1) ?? null,
    });
  }

  return contexts;
}
