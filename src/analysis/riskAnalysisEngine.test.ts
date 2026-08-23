import { describe, it, expect } from 'vitest';
import { computeRiskAnalysis } from './riskAnalysisEngine';
import { TrendAnalysisResult } from '../../../../shared/types/trendAnalysis';
import { MarketStructureResult } from '../../../../shared/types/marketStructure';
import { VolatilityAnalysisResult } from '../../../../shared/types/volatilityAnalysis';
import { SupportResistanceResponse } from '../../../../shared/types/supportResistance';
import { DetectedSetup } from '../../../../shared/types/setupDetection';
import { MultiTimeframeAnalysis } from '../../../../shared/types/multiTimeframeAnalysis';

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
  it('returns wait with explicit blockers when resistance is nearby and MTF is mixed', () => {
    const multiTimeframe: MultiTimeframeAnalysis = {
      symbol: 'EUR/USD',
      analysisTimeframe: '1H',
      higherTimeframe: { timeframe: '4H', trend: 'neutral', score: 46, strength: 'weak', status: 'ok', analyzedAt: '' },
      analysis: { timeframe: '1H', trend: 'bullish', score: 55, strength: 'moderate', status: 'ok', analyzedAt: '' },
      lowerTimeframe: { timeframe: '15m', trend: 'bullish', score: 51, strength: 'moderate', status: 'ok', analyzedAt: '' },
      alignment: 'mixed',
      possiblePattern: null,
      explanation: '',
    };
    const result = computeRiskAnalysis({
      trend: makeTrend({ score: 85 }),
      structure: makeStructure(),
      volatility: makeVolatility({ currentAtr: 0.006 }),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      momentum: {
        momentum: 'neutral',
        strength: 'weak',
        score: -5,
        rawScore: -5,
        counterTrend: false,
        counterTrendExplanation: '',
        trendContext: 'bullish',
        divergence: null,
        momentumLean: null,
        adjustmentFactor: 1,
        adjustmentReason: '',
        components: { rsi: { score: 0, explanation: '', raw: {} }, macd: { score: 0, explanation: '', raw: {} }, priceMovement: { score: 0, explanation: '', raw: {} } },
        dataQuality: { sufficient: true, candleCount: 100, minimumRequired: 60 },
      },
      multiTimeframe,
      currentPrice: 1.1050,
    });

    expect(result.decision.state).toBe('wait');
    expect(result.decision.trendScore).toBe(85);
    expect(result.decision.entryQualityScore).toBeLessThan(result.decision.trendScore);
    expect(result.decision.rejectionReasons).toEqual(expect.arrayContaining(['4H neutral', 'momentum weakening', 'resistance too close']));
  });

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

  it('falls back to protected structure levels when no setup invalidation exists', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend({ trend: 'neutral' }),
      structure: makeStructure({
        lastSwingLow: { type: 'low', timestamp: '2024-01-01T00:00:00.000Z', price: 1.0980, index: 0 },
        lastSwingHigh: { type: 'high', timestamp: '2024-01-01T00:00:00.000Z', price: 1.1080, index: 0 },
      }),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.invalidationCandidates.length).toBeGreaterThan(0);
    const structureCandidate = result.invalidationCandidates.find((c) => c.source === 'protectedStructureLevel');
    expect(structureCandidate).toBeDefined();
  });

  it('falls back to EMA50 only when no structural or S/R invalidation exists', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend({ ema: { ema20: 1.1020, ema50: 1.1000, ema200: 1.0950 } }),
      structure: makeStructure({ lastSwingLow: null, lastSwingHigh: null }),
      volatility: makeVolatility(),
      supportResistance: makeSR({
        supports: [],
        resistances: [],
      }),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.invalidationCandidates.length).toBeGreaterThan(0);
    expect(result.invalidationCandidates[0].source).toBe('emaBreak');
  });

  it('returns empty invalidation candidates when all data sources are empty', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend({ ema: { ema20: null, ema50: null, ema200: null } }),
      structure: makeStructure({ lastSwingLow: null, lastSwingHigh: null }),
      volatility: makeVolatility(),
      supportResistance: makeSR({ supports: [], resistances: [] }),
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
    expect(result.positionSizing!.basedOnInvalidation).toBeCloseTo(1.1000, 4);
    expect(result.positionSizing!.unusuallyHighRisk).toBe(false);
  });

  it('does not classify a tested zone overlapping current price as a nearby side level', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure(),
      volatility: makeVolatility(),
      supportResistance: makeSR({
        supports: [],
        resistances: [],
        tested: [{ price: 1.1049, zoneLow: 1.1040, zoneHigh: 1.1060, type: 'tested', strength: 80, touches: 3, lastReactionTime: '' }],
      }),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.nearbySupport).toBeNull();
    expect(result.nearbyResistance).toBeNull();
  });

  it('does not use a near-zero setup invalidation to inflate risk/reward', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure({ lastSwingLow: { type: 'low', timestamp: '2024-01-01T00:00:00.000Z', price: 1.0980, index: 0 } }),
      volatility: makeVolatility({ currentAtr: 0.0060 }),
      supportResistance: makeSR(),
      setups: makeSetups([{
        setup: 'Bullish Trend Continuation', direction: 'bullish', strength: 70,
        conditionsMet: ['trend'], conditionsMissing: [], conditionsMetCount: 1, conditionsTotal: 1,
        invalidationCondition: 'price falls back below 1.1049',
      }]),
      currentPrice: 1.1050,
    });

    const bullish = result.riskRewardScenarios.find((scenario) => scenario.direction === 'bullish');
    expect(bullish).toBeDefined();
    expect(bullish!.invalidation.price).toBeCloseTo(1.1000, 4);
  });

  it('uses quote-currency conversion consistently for JPY-quoted instruments', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend({ symbol: 'GBP/JPY' }),
      structure: makeStructure(),
      volatility: makeVolatility({ currentAtr: 0.0100 }),
      supportResistance: makeSR(),
      setups: makeSetups([{
        setup: 'Bullish Pullback',
        direction: 'bullish',
        strength: 60,
        conditionsMet: ['support'],
        conditionsMissing: [],
        conditionsMetCount: 1,
        conditionsTotal: 1,
        invalidationCondition: 'price falls below 216.900',
      }]),
      currentPrice: 216.913,
      accountSize: 2000,
      maxRiskPercent: 2,
      quoteToAccountRate: 0.00629,
      accountCurrency: 'USD',
    });

    expect(result.positionSizing).not.toBeNull();
    // 1.3 pips = 0.013 JPY; each unit risks 0.013 * 0.00629 USD.
    expect(result.positionSizing!.riskDistanceInPips).toBeCloseTo(1.3, 1);
    expect(result.positionSizing!.positionSizeUnits).toBeCloseTo(489000, -3);
    expect(result.positionSizing!.positionSizeLots).toBeCloseTo(4.89, 2);
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

  it('does not calculate an oversized position from a sub-ATR invalidation', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend(),
      structure: makeStructure({ lastSwingLow: null }),
      volatility: makeVolatility({ currentAtr: 0.0060 }),
      supportResistance: makeSR({
        supports: [],
        resistances: [],
      }),
      setups: makeSetups([{
        setup: 'Bullish Trend Continuation',
        direction: 'bullish',
        strength: 60,
        conditionsMet: ['trend'],
        conditionsMissing: [],
        conditionsMetCount: 1,
        conditionsTotal: 1,
        invalidationCondition: 'price falls below 1.1049',
      }]),
      currentPrice: 1.1050,
      accountSize: 10000,
      maxRiskPercent: 1,
    });

    expect(result.positionSizing).toBeNull();
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

  it('GUARDRAIL: bearish invalidation must be above current price', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend({ trend: 'neutral' }),
      structure: makeStructure({
        lastSwingHigh: { type: 'high', timestamp: '2024-01-01T00:00:00.000Z', price: 1.1080, index: 0 },
        lastSwingLow: { type: 'low', timestamp: '2024-01-01T00:00:00.000Z', price: 1.0980, index: 0 },
      }),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    const bearishScenario = result.riskRewardScenarios.find((s) => s.direction === 'bearish');
    if (bearishScenario) {
      expect(bearishScenario.invalidation.price).toBeGreaterThan(1.1050);
    }
  });

  it('GUARDRAIL: bullish invalidation must be below current price', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend({ trend: 'neutral' }),
      structure: makeStructure({
        lastSwingHigh: { type: 'high', timestamp: '2024-01-01T00:00:00.000Z', price: 1.1080, index: 0 },
        lastSwingLow: { type: 'low', timestamp: '2024-01-01T00:00:00.000Z', price: 1.0980, index: 0 },
      }),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    const bullishScenario = result.riskRewardScenarios.find((s) => s.direction === 'bullish');
    if (bullishScenario) {
      expect(bullishScenario.invalidation.price).toBeLessThan(1.1050);
    }
  });

  it('provides separate invalidation for bullish and bearish even when trend is unclear', () => {
    const result = computeRiskAnalysis({
      trend: makeTrend({ trend: 'neutral', score: 5 }),
      structure: makeStructure({
        trend: 'range',
        lastSwingHigh: { type: 'high', timestamp: '2024-01-01T00:00:00.000Z', price: 1.1080, index: 0 },
        lastSwingLow: { type: 'low', timestamp: '2024-01-01T00:00:00.000Z', price: 1.0980, index: 0 },
      }),
      volatility: makeVolatility(),
      supportResistance: makeSR(),
      setups: makeSetups([]),
      currentPrice: 1.1050,
    });

    expect(result.riskRewardScenarios.length).toBe(2);

    const bullish = result.riskRewardScenarios.find((s) => s.direction === 'bullish');
    const bearish = result.riskRewardScenarios.find((s) => s.direction === 'bearish');

    expect(bullish).toBeDefined();
    expect(bearish).toBeDefined();
    expect(bullish!.invalidation.price).toBeLessThan(1.1050);
    expect(bearish!.invalidation.price).toBeGreaterThan(1.1050);
    expect(bullish!.invalidation.price).not.toEqual(bearish!.invalidation.price);
  });
});
