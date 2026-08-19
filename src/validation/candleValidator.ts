import { Candle } from '../../../shared/types/market';
import { ValidationIssue } from './types';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validates a single candle's price fields. Pure function, no I/O - returns
 * every issue found rather than throwing, so the caller (validateCandleSeries)
 * decides whether to drop the candle, warn, or reject the whole series.
 *
 * Checks required by spec:
 *   high >= open
 *   high >= close
 *   low <= open
 *   low <= close
 *   high >= low
 * plus: non-finite prices, negative/zero prices.
 */
export function validateCandle(candle: Candle, index: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fields: Array<[keyof Candle, number | null]> = [
    ['open', candle.open],
    ['high', candle.high],
    ['low', candle.low],
    ['close', candle.close],
  ];

  let hasInvalidPrice = false;

  for (const [field, value] of fields) {
    if (!isFiniteNumber(value)) {
      issues.push({
        type: 'INVALID_PRICE',
        severity: 'error',
        message: `Candle at index ${index} has a non-finite "${field}" value: ${value}.`,
        index,
        timestamp: candle.timestamp,
      });
      hasInvalidPrice = true;
    } else if (value <= 0) {
      issues.push({
        type: 'NEGATIVE_PRICE',
        severity: 'error',
        message: `Candle at index ${index} has a non-positive "${field}" value: ${value}.`,
        index,
        timestamp: candle.timestamp,
      });
      hasInvalidPrice = true;
    }
  }

  // Only check OHLC relationships if all four prices are usable numbers -
  // otherwise we'd just be comparing garbage to garbage.
  if (!hasInvalidPrice) {
    const { open, high, low, close } = candle;
    const relationshipErrors: string[] = [];

    if (high < open) relationshipErrors.push('high < open');
    if (high < close) relationshipErrors.push('high < close');
    if (low > open) relationshipErrors.push('low > open');
    if (low > close) relationshipErrors.push('low > close');
    if (high < low) relationshipErrors.push('high < low');

    if (relationshipErrors.length > 0) {
      issues.push({
        type: 'INVALID_OHLC_RELATIONSHIP',
        severity: 'error',
        message: `Candle at index ${index} has an invalid OHLC relationship: ${relationshipErrors.join(', ')}.`,
        index,
        timestamp: candle.timestamp,
      });
    }
  }

  if (candle.volume !== null && (!isFiniteNumber(candle.volume) || candle.volume < 0)) {
    issues.push({
      type: 'INVALID_PRICE',
      severity: 'warning',
      message: `Candle at index ${index} has an invalid volume value: ${candle.volume}.`,
      index,
      timestamp: candle.timestamp,
    });
  }

  return issues;
}

/** True if a candle has any error-severity issue (i.e. should be dropped). */
export function isCandleCorrupted(candle: Candle, index: number): boolean {
  return validateCandle(candle, index).some((issue) => issue.severity === 'error');
}
