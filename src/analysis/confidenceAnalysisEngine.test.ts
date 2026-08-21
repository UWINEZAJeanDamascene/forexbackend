import { describe, it, expect } from 'vitest';
import { computeConfidence } from './confidenceAnalysisEngine';
import { TrendAnalysisResult, MarketStructureResult, MomentumAnalysisResult, VolatilityAnalysisResult, SupportResistanceResponse, MultiTimeframeAnalysis, DetectedSetup } from '../../shared/types';

function makeTrend(trend: 'bullish' | 'bearish' | 'neutral', score: number, factors: { direction: string; score: number }[]): TrendAnalysisResult {
  return {
    symbol: 'EUR/USD',
    timeframe: '4H',
    trend,
    strength: 'moderate',
    score,
    factors: {
      emaAlignment: { direction: factors[0].direction as any, score: factors[0].score, explanation: '' },
      marketStructure: { direction: factors[1].direction as any, score: factors[1].score, explanation: '' },
      priceVsEma: { direction: factors[2].direction as any, score: factors[2].score, explanation: '' },
      recentHighsLows: { direction: factors[3].direction as any, score: factors[3].score, explanation: '' },
    },
    priceVsEmaBreakdown: { vsEma20: null, vsEma50: null, vsEma200: null, ema20: null, ema50: null, ema200: null },
    currentPrice: 1.16,
    ema: { ema20: null, ema50: null, ema200: null },
    analyzedAt: new Date().toISOString(),
  };
}

function makeStructure(trend: 'bullish' | 'bearish' | 'range' | 'unclear', counts: { hh: number; hl: number; lh: number; ll: number }, latestEvent?: string): MarketStructureResult {
  const events = latestEvent ? [{ type: latestEvent as any, timestamp: new Date().toISOString(), price: 1.16, description: '' }] : [];
  return {
    trend,
    swingHighs: [],
    swingLows: [],
    events,
    lastSwingHigh: null,
    lastSwingLow: null,
    higherHighsCount: counts.hh,
    higherLowsCount: counts.hl,
    lowerHighsCount: counts.lh,
    lowerLowsCount: counts.ll,
    candlestickPatterns: [],
  };
}

function makeMomentum(score: number, momentum: 'bullish' | 'bearish' | 'neutral' = 'bullish'): MomentumAnalysisResult {
  return {
    momentum,
    strength: 'moderate',
    score,
    counterTrend: false,
    counterTrendExplanation: '',
    trendContext: momentum,
    divergence: null,
    components: {
      rsi: { score: 0, explanation: '', raw: {} },
      macd: { score: 0, explanation: '', raw: {} },
      priceMovement: { score: 0, explanation: '', raw: {} },
    },
    dataQuality: { sufficient: true, candleCount: 100, minimumRequired: 60 },
  };
}

function makeVolatility(classification: 'low' | 'normal' | 'high', bandDisagreement = false): VolatilityAnalysisResult {
  return {
    classification,
    score: 50,
    currentAtr: 0.001,
    averageAtr: 0.001,
    atrPercentile: 50,
    bandWidth: 0.002,
    bandWidthPercentile: 50,
    bandDisagreement,
    explanation: '',
    dataQuality: { sufficient: true, candleCount: 100, minimumRequired: 60 },
  };
}

function makeSR(supports: { price: number; zoneLow: number; zoneHigh: number; strength: number }[], resistances: typeof supports): SupportResistanceResponse {
  return {
    symbol: 'EUR/USD',
    timeframe: '4H',
    supports: supports.map((s) => ({ ...s, type: 'support' as const, touches: 1, lastReactionTime: new Date().toISOString() })),
    resistances: resistances.map((r) => ({ ...r, type: 'resistance' as const, touches: 1, lastReactionTime: new Date().toISOString() })),
    tested: [],
  };
}

function makeMTF(higher: { trend: string; score: number; status: string; timeframe: string } | null, analysis: { trend: string; score: number; status: string; timeframe: string }, lower: { trend: string; score: number; status: string; timeframe: string } | null): MultiTimeframeAnalysis {
  return {
    symbol: 'EUR/USD',
    analysisTimeframe: '4H',
    higherTimeframe: higher ? { ...higher, strength: 'moderate' as const } : null,
    analysis: { ...analysis, strength: 'moderate' as const },
    lowerTimeframe: lower ? { ...lower, strength: 'moderate' as const } : null,
    alignment: 'aligned_bullish',
    possiblePattern: null,
    explanation: '',
  };
}

function makeSetups(setups: { direction: 'bullish' | 'bearish'; strength: number; met?: number; missing?: number }[]): DetectedSetup[] {
  return setups.map((s, i) => ({
    setup: `Setup ${i}`,
    direction: s.direction,
    strength: s.strength,
    conditionsMet: Array.from({ length: s.met ?? 0 }, () => `condition-${i}-${Math.random()}`),
    conditionsMissing: Array.from({ length: s.missing ?? 0 }, () => `condition-${i}-${Math.random()}`),
    invalidationCondition: '',
  }));
}

describe('computeConfidence', () => {
  it('returns High band for perfect alignment', () => {
    const result = computeConfidence({
      trend: makeTrend('bullish', 80, [
        { direction: 'bullish', score: 25 },
        { direction: 'bullish', score: 30 },
        { direction: 'bullish', score: 20 },
        { direction: 'bullish', score: 25 },
      ]),
      structure: makeStructure('bullish', { hh: 10, hl: 10, lh: 0, ll: 0 }),
      momentum: makeMomentum(80),
      volatility: makeVolatility('normal'),
      supportResistance: makeSR([{ price: 1.15, zoneLow: 1.149, zoneHigh: 1.151, strength: 80 }], [{ price: 1.17, zoneLow: 1.169, zoneHigh: 1.171, strength: 80 }]),
      multiTimeframe: makeMTF(
        { trend: 'bullish', score: 70, status: 'ok', timeframe: '1D' },
        { trend: 'bullish', score: 65, status: 'ok', timeframe: '4H' },
        { trend: 'bullish', score: 60, status: 'ok', timeframe: '1H' }
      ),
      setups: makeSetups([{ direction: 'bullish', strength: 80 }]),
      currentPrice: 1.16,
    });

    expect(result.overallScore).toBeGreaterThanOrEqual(71);
    expect(result.band).toBe('High');
    const momentumFactor = result.factors.find((f) => f.name === 'Momentum');
    expect(momentumFactor?.score).toBe(90);
  });

  it('returns Low band for poor alignment', () => {
    const result = computeConfidence({
      trend: makeTrend('neutral', 0, [
        { direction: 'neutral', score: 0 },
        { direction: 'bearish', score: 0 },
        { direction: 'bullish', score: 0 },
        { direction: 'neutral', score: 0 },
      ]),
      structure: makeStructure('range', { hh: 1, hl: 1, lh: 5, ll: 5 }),
      momentum: makeMomentum(0, 'neutral'),
      volatility: makeVolatility('high', true),
      supportResistance: makeSR([], []),
      multiTimeframe: makeMTF(
        { trend: 'bearish', score: 50, status: 'ok', timeframe: '1D' },
        { trend: 'bullish', score: 50, status: 'ok', timeframe: '4H' },
        { trend: 'bearish', score: 50, status: 'ok', timeframe: '1H' }
      ),
      setups: makeSetups([{ direction: 'bullish', strength: 60, met: 0, missing: 2 }, { direction: 'bearish', strength: 65, met: 0, missing: 2 }]),
      currentPrice: 1.16,
    });

    expect(result.overallScore).toBeLessThanOrEqual(40);
    expect(result.band).toBe('Low');
  });

  it('applies structure contradiction penalty', () => {
    const result = computeConfidence({
      trend: makeTrend('bullish', 80, [
        { direction: 'bullish', score: 25 },
        { direction: 'bullish', score: 30 },
        { direction: 'bullish', score: 20 },
        { direction: 'bullish', score: 25 },
      ]),
      structure: makeStructure('bullish', { hh: 10, hl: 10, lh: 0, ll: 0 }, 'lower_low'),
      momentum: makeMomentum(80),
      volatility: makeVolatility('normal'),
      supportResistance: makeSR([{ price: 1.15, zoneLow: 1.149, zoneHigh: 1.151, strength: 80 }], [{ price: 1.17, zoneLow: 1.169, zoneHigh: 1.171, strength: 80 }]),
      multiTimeframe: makeMTF(
        { trend: 'bullish', score: 70, status: 'ok', timeframe: '1D' },
        { trend: 'bullish', score: 65, status: 'ok', timeframe: '4H' },
        { trend: 'bullish', score: 60, status: 'ok', timeframe: '1H' }
      ),
      setups: makeSetups([{ direction: 'bullish', strength: 80 }]),
      currentPrice: 1.16,
    });

    const structureFactor = result.factors.find((f) => f.name === 'Market Structure');
    expect(structureFactor?.score).toBeLessThan(100);
    expect(result.warnings.some((w) => w.type === 'structure_contradiction')).toBe(true);
  });

  it('composite score equals sum of factor contributions', () => {
    const result = computeConfidence({
      trend: makeTrend('bullish', 80, [
        { direction: 'bullish', score: 25 },
        { direction: 'bullish', score: 30 },
        { direction: 'bullish', score: 20 },
        { direction: 'bullish', score: 25 },
      ]),
      structure: makeStructure('bullish', { hh: 10, hl: 10, lh: 0, ll: 0 }),
      momentum: makeMomentum(80),
      volatility: makeVolatility('normal'),
      supportResistance: makeSR([{ price: 1.15, zoneLow: 1.149, zoneHigh: 1.151, strength: 80 }], [{ price: 1.17, zoneLow: 1.169, zoneHigh: 1.171, strength: 80 }]),
      multiTimeframe: makeMTF(
        { trend: 'bullish', score: 70, status: 'ok', timeframe: '1D' },
        { trend: 'bullish', score: 65, status: 'ok', timeframe: '4H' },
        { trend: 'bullish', score: 60, status: 'ok', timeframe: '1H' }
      ),
      setups: makeSetups([{ direction: 'bullish', strength: 80 }]),
      currentPrice: 1.16,
    });

    const manualTotal = result.factors.reduce((sum, f) => sum + f.contribution, 0);
    expect(result.overallScore).toBe(Math.round(manualTotal));
  });

  it('opposing setups cap applies before rounding', () => {
    const result = computeConfidence({
      trend: makeTrend('bullish', 80, [
        { direction: 'bullish', score: 25 },
        { direction: 'bullish', score: 30 },
        { direction: 'bullish', score: 20 },
        { direction: 'bullish', score: 25 },
      ]),
      structure: makeStructure('bullish', { hh: 10, hl: 10, lh: 0, ll: 0 }),
      momentum: makeMomentum(80),
      volatility: makeVolatility('normal'),
      supportResistance: makeSR([{ price: 1.15, zoneLow: 1.149, zoneHigh: 1.151, strength: 80 }], [{ price: 1.17, zoneLow: 1.169, zoneHigh: 1.171, strength: 80 }]),
      multiTimeframe: makeMTF(
        { trend: 'bullish', score: 70, status: 'ok', timeframe: '1D' },
        { trend: 'bullish', score: 65, status: 'ok', timeframe: '4H' },
        { trend: 'bullish', score: 60, status: 'ok', timeframe: '1H' }
      ),
      setups: makeSetups([
        { direction: 'bullish', strength: 67, met: 2, missing: 2 },
        { direction: 'bearish', strength: 65, met: 2, missing: 2 },
      ]),
      currentPrice: 1.16,
    });

    expect(result.warnings.some((w) => w.type === 'opposing_setups')).toBe(true);
    expect(result.overallScore).toBeLessThanOrEqual(70);
  });

  it('reduces S/R score when price is inside a zone', () => {
    const result = computeConfidence({
      trend: makeTrend('bullish', 80, [
        { direction: 'bullish', score: 25 },
        { direction: 'bullish', score: 30 },
        { direction: 'bullish', score: 20 },
        { direction: 'bullish', score: 25 },
      ]),
      structure: makeStructure('bullish', { hh: 10, hl: 10, lh: 0, ll: 0 }),
      momentum: makeMomentum(80),
      volatility: makeVolatility('normal'),
      supportResistance: makeSR([{ price: 1.15, zoneLow: 1.149, zoneHigh: 1.151, strength: 80 }], [{ price: 1.16, zoneLow: 1.159, zoneHigh: 1.161, strength: 80 }]),
      multiTimeframe: makeMTF(
        { trend: 'bullish', score: 70, status: 'ok', timeframe: '1D' },
        { trend: 'bullish', score: 65, status: 'ok', timeframe: '4H' },
        { trend: 'bullish', score: 60, status: 'ok', timeframe: '1H' }
      ),
      setups: makeSetups([{ direction: 'bullish', strength: 80 }]),
      currentPrice: 1.16,
    });

    const srFactor = result.factors.find((f) => f.name === 'Support/Resistance');
    expect(srFactor?.score).toBe(30);
    expect(result.warnings.some((w) => w.type === 'price_inside_zone')).toBe(true);
  });

  it('adds MTF mismatch warning when higher timeframe disagrees', () => {
    const result = computeConfidence({
      trend: makeTrend('bullish', 80, [
        { direction: 'bullish', score: 25 },
        { direction: 'bullish', score: 30 },
        { direction: 'bullish', score: 20 },
        { direction: 'bullish', score: 25 },
      ]),
      structure: makeStructure('bullish', { hh: 10, hl: 10, lh: 0, ll: 0 }),
      momentum: makeMomentum(80),
      volatility: makeVolatility('normal'),
      supportResistance: makeSR([{ price: 1.15, zoneLow: 1.149, zoneHigh: 1.151, strength: 80 }], [{ price: 1.17, zoneLow: 1.169, zoneHigh: 1.171, strength: 80 }]),
      multiTimeframe: makeMTF(
        { trend: 'bearish', score: 50, status: 'ok', timeframe: '1D' },
        { trend: 'bullish', score: 65, status: 'ok', timeframe: '4H' },
        { trend: 'bullish', score: 60, status: 'ok', timeframe: '1H' }
      ),
      setups: makeSetups([{ direction: 'bullish', strength: 80 }]),
      currentPrice: 1.16,
    });

    expect(result.warnings.some((w) => w.type === 'mtf_mismatch')).toBe(true);
  });

  it('handles missing higher timeframe by excluding and reweighting', () => {
    const result = computeConfidence({
      trend: makeTrend('bullish', 80, [
        { direction: 'bullish', score: 25 },
        { direction: 'bullish', score: 30 },
        { direction: 'bullish', score: 20 },
        { direction: 'bullish', score: 25 },
      ]),
      structure: makeStructure('bullish', { hh: 10, hl: 10, lh: 0, ll: 0 }),
      momentum: makeMomentum(80),
      volatility: makeVolatility('normal'),
      supportResistance: makeSR([{ price: 1.15, zoneLow: 1.149, zoneHigh: 1.151, strength: 80 }], [{ price: 1.17, zoneLow: 1.169, zoneHigh: 1.171, strength: 80 }]),
      multiTimeframe: makeMTF(
        null,
        { trend: 'bullish', score: 65, status: 'ok', timeframe: '4H' },
        { trend: 'bearish', score: 50, status: 'ok', timeframe: '1H' }
      ),
      setups: makeSetups([{ direction: 'bullish', strength: 80 }]),
      currentPrice: 1.16,
    });

    const mtfFactor = result.factors.find((f) => f.name === 'Multi-Timeframe Alignment');
    expect(mtfFactor?.score).toBeGreaterThan(0);
    expect(mtfFactor?.score).toBeLessThan(100);
  });

  it('returns correct band thresholds', () => {
    const lowTrend = makeTrend('neutral', 0, [
      { direction: 'neutral', score: 0 },
      { direction: 'bearish', score: 0 },
      { direction: 'bullish', score: 0 },
      { direction: 'neutral', score: 0 },
    ]);
    const low = computeConfidence({
      trend: lowTrend,
      structure: makeStructure('range', { hh: 1, hl: 1, lh: 5, ll: 5 }),
      momentum: makeMomentum(0, 'neutral'),
      volatility: makeVolatility('high', true),
      supportResistance: makeSR([], []),
      multiTimeframe: makeMTF(
        { trend: 'bearish', score: 50, status: 'ok', timeframe: '1D' },
        { trend: 'bullish', score: 50, status: 'ok', timeframe: '4H' },
        { trend: 'bearish', score: 50, status: 'ok', timeframe: '1H' }
      ),
      setups: makeSetups([{ direction: 'bullish', strength: 60, met: 0, missing: 2 }, { direction: 'bearish', strength: 65, met: 0, missing: 2 }]),
      currentPrice: 1.16,
    });
    expect(low.band).toBe('Low');

    const moderateTrend = makeTrend('bullish', 50, [
      { direction: 'bullish', score: 15 },
      { direction: 'bullish', score: 15 },
      { direction: 'neutral', score: 10 },
      { direction: 'neutral', score: 10 },
    ]);
    const moderate = computeConfidence({
      trend: moderateTrend,
      structure: makeStructure('bullish', { hh: 5, hl: 5, lh: 4, ll: 4 }),
      momentum: makeMomentum(30),
      volatility: makeVolatility('normal'),
      supportResistance: makeSR([{ price: 1.15, zoneLow: 1.149, zoneHigh: 1.151, strength: 60 }], [{ price: 1.17, zoneLow: 1.169, zoneHigh: 1.171, strength: 60 }]),
      multiTimeframe: makeMTF(
        { trend: 'bullish', score: 60, status: 'ok', timeframe: '1D' },
        { trend: 'bullish', score: 55, status: 'ok', timeframe: '4H' },
        { trend: 'bearish', score: 40, status: 'ok', timeframe: '1H' }
      ),
      setups: makeSetups([{ direction: 'bullish', strength: 70 }]),
      currentPrice: 1.16,
    });
    expect(moderate.band).toBe('Moderate');

    const highTrend = makeTrend('bullish', 80, [
      { direction: 'bullish', score: 25 },
      { direction: 'bullish', score: 30 },
      { direction: 'bullish', score: 20 },
      { direction: 'bullish', score: 25 },
    ]);
    const high = computeConfidence({
      trend: highTrend,
      structure: makeStructure('bullish', { hh: 10, hl: 10, lh: 0, ll: 0 }),
      momentum: makeMomentum(80),
      volatility: makeVolatility('normal'),
      supportResistance: makeSR([{ price: 1.15, zoneLow: 1.149, zoneHigh: 1.151, strength: 80 }], [{ price: 1.17, zoneLow: 1.169, zoneHigh: 1.171, strength: 80 }]),
      multiTimeframe: makeMTF(
        { trend: 'bullish', score: 70, status: 'ok', timeframe: '1D' },
        { trend: 'bullish', score: 65, status: 'ok', timeframe: '4H' },
        { trend: 'bullish', score: 60, status: 'ok', timeframe: '1H' }
      ),
      setups: makeSetups([{ direction: 'bullish', strength: 80 }]),
      currentPrice: 1.16,
    });
    expect(high.band).toBe('High');
  });
});
