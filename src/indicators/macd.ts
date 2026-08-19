import { ema } from './ema';

/**
 * MACD (Moving Average Convergence Divergence).
 *
 * Default configuration per the spec:
 *   - Fast EMA: 12
 *   - Slow EMA: 26
 *   - Signal EMA: 9
 *
 * Returns three parallel arrays, each `null` where the value cannot yet be
 * computed. The first `slowPeriod - 1` entries are `null` because the slow
 * EMA needs that much history; the signal line needs additional `signalPeriod`
 * values on top of that.
 */
export interface MacdResult {
  macdLine: (number | null)[];
  signalLine: (number | null)[];
  histogram: (number | null)[];
}

export function macd(closes: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MacdResult {
  if (fastPeriod >= slowPeriod) {
    throw new Error(`MACD fastPeriod (${fastPeriod}) must be less than slowPeriod (${slowPeriod}).`);
  }
  if (signalPeriod < 1) {
    throw new Error(`MACD signalPeriod must be >= 1, got ${signalPeriod}.`);
  }

  const fastEma = ema(closes, fastPeriod);
  const slowEma = ema(closes, slowPeriod);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    const fast = fastEma[i];
    const slow = slowEma[i];
    if (fast === null || slow === null) {
      macdLine.push(null);
    } else {
      macdLine.push(fast - slow);
    }
  }

  const signalLine = ema(
    macdLine.filter((v): v is number => v !== null),
    signalPeriod
  );

  // Pad the start of signalLine with nulls so it aligns with macdLine.
  const firstNonNull = macdLine.findIndex((v) => v !== null);
  const paddedSignal: (number | null)[] =
    firstNonNull === -1
      ? new Array(closes.length).fill(null)
      : new Array(firstNonNull).fill(null).concat(signalLine);

  const histogram: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    const macd = macdLine[i];
    const signal = paddedSignal[i];
    if (macd === null || signal === null) {
      histogram.push(null);
    } else {
      histogram.push(macd - signal);
    }
  }

  return {
    macdLine,
    signalLine: paddedSignal,
    histogram,
  };
}
