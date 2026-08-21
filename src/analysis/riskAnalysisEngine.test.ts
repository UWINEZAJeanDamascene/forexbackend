import { describe, it, expect } from 'vitest';
import { computeRiskAnalysis } from './riskAnalysisEngine';
import { TrendAnalysisResult } from '../../../../shared/types/trendAnalysis';
import { MarketStructureResult } from '../../../../shared/types/marketStructure';
import { VolatilityAnalysisResult } from '../../../../shared/types/volatilityAnalysis';
import { SupportResistanceResponse } from '../../../../shared/types/supportResistance';
import { DetectedSetup } from '../../../../shared/types/setupDetection';

function makeTrend(overrides: Partial<TrendAnalysisResult> = {}): TrendAnalysisResult {
  return {
    symbol: 'EUR/USD',
    timeframe: '1H',
    trend: 'bullish',
    strength: 'moderate',
    score: 65,
    factors: {
      emaAlignment: { direction: 'bullish', score: 70, explanation: '' },
      marketStructure: { direction: 'bullish', score: 60, explanation: '' },
      priceVsEma: { direction: 'bullish', score: 65, explanation: '' },
      recentHighsLows: { direction: 'bullish', score: 65, explanation: '' },
    },
    priceVsEmaBreakdown: { vsEma20: 'bullish', vsEma50: 'bullish', vsEma200: 'bullish', ema20: 1.1, ema50: 1.08, ema200: 1.05 },
    currentPrice: 1.1050,
    ema: { ema20: 1.1020, ema50: 1.1000, ema200: 1.0950 },
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeStructure(overrides: Partial<MarketStructureResult> = {}): MarketStructureResult {
  return {
    trend: 'bullish',
    swingHighs: [],
    swingLows: [],
    events: [],
    lastSwingHigh: null,
    lastSwingLow: { type: 'low', timestamp: '2024-01-01T00:00:00.000Z', price: 1.0980, index: 0 },
    higherHighsCount: 2,
    higherLowsCount: 3,
    lowerHighsCount: 0,
    lowerLowsCount: 0,
    candlestickPatterns: [],
    ...overrides,
  };
}

function makeVolatility(overrides: Partial<VolatilityAnalysisResult> = {}): VolatilityAnalysisResult {
  return {
    symbol: 'EUR/USD',
    timeframe: '1H',
    currentAtr: 0.0060,
    atrPercentile: 68,
    classification: 'high',
    bandDisagreement: false,
    explanation: 'Elevated volatility.',
    ...overrides,
  };
}

function makeSR(overrides: Partial<SupportResistanceResponse> = {}): SupportResistanceResponse {
  return {
    symbol: 'EUR/USD',
    timeframe: '1H',
    supports: [
      { price: 1.1000, zoneLow: 1.0995, zoneHigh: 1.1005, type: 'support', strength: 77, touches: 3, lastReactionTime: '2024-01-01T00:00:00.000Z' },
    ],
    resistances: [
      { price: 1.1100, zoneLow: 1.1095, zoneHigh: 1.1105, type: 'resistance', strength: 59, touches: 2, lastReactionTime: '2024-01-01T00:00:00.000Z' },
    ],
    tested: [],
    ...overrides,
  };
}

function makeSetups(setups: DetectedSetup[]): DetectedSetup[] {
  return setups;
}

describe('computeRiskAnalysis', () => {
  it('returns nearby support and resistance with ATR-normalized distances', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure(),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.nearbySupport).not.toBeNull();
    expect(result.nearbySupport!.price).toBeCloseTo(1.1000, 4);
    expect(result.nearbySupport!.distanceInATR).toBeCloseTo(0.833, 2);
    expect(result.nearbySupport!.proximity).toBe('nearby');

    expect(result.nearbyResistance).not.toBeNull();
    expect(result.nearbyResistance!.price).toBeCloseTo(1.1100, 4);
    expect(result.nearbyResistance!.distanceInATR).toBeCloseTo(0.833, 2);
    expect(result.nearbyResistance!.proximity).toBe('nearby');
  });

  it('classifies proximity based on ATR thresholds', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure(),
      volatility: makeVolatility({ currentAtr: 0.0010 }),
      supportResistance: makeSR({
        supports: [{ price: 1.0950, zoneLow: 1.0945, zoneHigh: 1.0955, type: 'support', strength: 50, touches: 1, lastReactionTime: '' }],
      }),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.nearbySupport!.distanceInATR).toBeCloseTo(10, 0);
    expect(result.nearbySupport!.proximity).toBe('distant');
  });

  it('returns null for nearby support/resistance when none exist on the correct side', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure(),
      volatility: makeVolatility(),
      supportResistance: makeSR({
        supports: [],
        resistances: [],
      }),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.nearbySupport).toBeNull();
    expect(result.nearbyResistance).toBeNull();
  });

  it('builds invalidation from active setup when present', () => {
    const setups: DetectedSetup[] = [
      {
        setup: 'Bullish Trend Continuation',
        direction: 'bullish',
        strength: 67,
        conditionsMet: ['condition1'],
        conditionsMissing: [],
        conditionsMetCount: 2,
        conditionsTotal: 4,
        invalidationCondition: 'Would be invalidated by: price falls back below 1.1020',
      },
    ];

    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure(),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups(setups),
      currentPrice: 1.1050,
    });

    expect(result.invalidationCandidates.length).toBeGreaterThan(0);
    expect(result.invalidationCandidates[0].source).toBe('activeSetup');
    expect(result.invalidationCandidates[0].price).toBeCloseTo(1.1020, 4);
  });

  it('falls back to protected structure level when no setup invalidation exists', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure(),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.invalidationCandidates.length).toBeGreaterThan(0);
    expect(result.invalidationCandidates[0].source).toBe('protectedStructureLevel');
    expect(result.invalidationCandidates[0].price).toBeCloseTo(1.0980, 4);
  });

  it('falls back to EMA50 when no structural invalidation exists', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend({ ema: { ema20: 1.1020, ema50: 1.1000, ema200: 1.0950 } }),
      structure: makeStructure({ lastSwingLow: null, lastSwingHigh: null }),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.invalidationCandidates.length).toBeGreaterThan(0);
    expect(result.invalidationCandidates[0].source).toBe('emaBreak');
  });

  it('returns empty invalidation candidates when data is insufficient', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend({ ema: { ema20: null, ema50: null, ema200: null } }),
      structure: makeStructure({ lastSwingLow: null, lastSwingHigh: null }),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.invalidationCandidates.length).toBe(0);
  });

  it('computes risk/reward scenarios when invalidation and target both exist', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure(),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.riskRewardScenarios.length).toBeGreaterThan(0);
    expect(result.riskRewardScenarios[0].direction).toBe('bullish');
    expect(result.riskRewardScenarios[0].target.price).toBeCloseTo(1.1100, 4);
  });

  it('computes position sizing when inputs are provided', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure(),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
      accountSize: 50000,
      maxRiskPercent: 1,
    });

    expect(result.positionSizing).not.toBeNull();
    expect(result.positionSizing!.riskAmount).toBeCloseTo(500, 0);
    expect(result.positionSizing!.basedOnInvalidation).toBeCloseTo(1.0980, 4);
    expect(result.positionSizing!.unusuallyHighRisk).toBe(false);
  });

  it('flags unusually high risk', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure(),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
      accountSize: 50000,
      maxRiskPercent: 15,
    });

    expect(result.positionSizing!.unusuallyHighRisk).toBe(true);
  });

  it('returns null position sizing when inputs are missing', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure(),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.positionSizing).toBeNull();
  });

  it('includes volatility context note for high volatility', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure(),
      volatility: makeVolatility({ classification: 'high', bandDisagreement: true }),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.volatilityContext.note).toContain('Elevated volatility');
    expect(result.volatilityContext.note).toContain('mixed signals');
  });

  it('includes thresholds in response', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure(),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.thresholds.nearbyATR).toBe(1.5);
    expect(result.thresholds.withinRangeATR).toBe(3.0);
  });

  it('includes disclaimer in response', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure(),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.disclaimer).toContain('not a probability of profit');
  });
});
