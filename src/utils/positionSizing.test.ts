import { describe, expect, it } from 'vitest';
import { calculatePositionSize } from '../../../shared/utils/positionSizing';

describe('calculatePositionSize', () => {
  it.each([
    ['EUR/USD', 1.1000, 1.1000 - 0.00017],
    ['NZD/USD', 0.6100, 0.6100 - 0.00007],
  ])('returns unavailable below the absolute stop floor for %s', (symbol, currentPrice, invalidationPrice) => {
    const result = calculatePositionSize({
      accountSize: 10000,
      riskPercent: 1,
      currentPrice,
      invalidationPrice,
      symbol,
      quoteToAccountRate: 1,
    });

    expect(result).toBeNull();
  });

  it('calculates a normal position at the configured minimum distance', () => {
    const result = calculatePositionSize({
      accountSize: 10000,
      riskPercent: 1,
      currentPrice: 1.1000,
      invalidationPrice: 1.0998,
      symbol: 'EUR/USD',
      quoteToAccountRate: 1,
    });

    expect(result).not.toBeNull();
    expect(result!.riskDistanceInPips).toBeCloseTo(2, 8);
    expect(result!.positionSizeLots).toBeCloseTo(5, 8);
  });
});