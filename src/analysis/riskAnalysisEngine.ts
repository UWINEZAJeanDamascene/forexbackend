import {
  TrendAnalysisResult,
  MarketStructureResult,
  VolatilityAnalysisResult,
  SupportResistanceResponse,
  DetectedSetup,
} from '../../shared/types';
import { MomentumAnalysisResult } from '../../shared/types/momentumAnalysis';
import { MultiTimeframeAnalysis } from '../../shared/types/multiTimeframeAnalysis';
import {
  RiskAnalysisResult,
  NearbyLevel,
  InvalidationCandidate,
  RiskRewardScenario,
  PositionSizingResult,
  VolatilityContext,
  ProximityLabel,
  TradeDecisionSummary,
  TradeQuality,
} from '../../shared/types/riskAnalysis';
import { calculatePositionSize as calculateSharedPositionSize } from '../../../shared/utils/positionSizing';

const DEFAULT_NEARBY_ATR = 1.5;
const DEFAULT_WITHIN_RANGE_ATR = 3.0;
const DEFAULT_MAX_RISK_PERCENT = 10;
const DEFAULT_MIN_RISK_PERCENT = 0.1;
const EXTREME_REWARD_RISK_RATIO = 10;
const EXTREME_TARGET_DISTANCE_ATR = 20;
const MIN_SCENARIO_INVALIDATION_DISTANCE_ATR = 0.5;

export function computeRiskAnalysis(params: {
  trend: TrendAnalysisResult;
  structure: MarketStructureResult;
  volatility: VolatilityAnalysisResult;
  supportResistance: SupportResistanceResponse;
  setups: DetectedSetup[];
  currentPrice: number;
  accountSize?: number;
  maxRiskPercent?: number;
  momentum?: MomentumAnalysisResult;
  multiTimeframe?: MultiTimeframeAnalysis;
  quoteToAccountRate?: number;
  accountCurrency?: string;
}): RiskAnalysisResult {
  const atr = params.volatility.currentAtr;
  const volatilityContext = buildVolatilityContext(params.volatility);

  const nearbySupport = findNearbySupport(params.supportResistance, params.currentPrice, atr);
  const nearbyResistance = findNearbyResistance(params.supportResistance, params.currentPrice, atr);

  const invalidationCandidates = buildInvalidationCandidates(
    params,
    nearbySupport,
    nearbyResistance,
    atr
  );

  const riskRewardScenarios = buildRiskRewardScenarios(
    params.currentPrice,
    nearbySupport,
    nearbyResistance,
    invalidationCandidates,
    atr,
  );
  const tradeQuality = assessTradeQuality(
    params.trend,
    params.structure,
    params.setups,
    riskRewardScenarios,
    params.volatility,
    params.momentum,
    params.multiTimeframe,
  );
  const annotatedRiskRewardScenarios = annotateRiskRewardScenarios(
    riskRewardScenarios,
    params.trend,
    tradeQuality,
  );
  const decision = assessTradeDecision(
    params.trend,
    params.setups,
    params.momentum,
    params.multiTimeframe,
    nearbySupport,
    nearbyResistance,
    tradeQuality,
  );

  let positionSizing: PositionSizingResult | null = null;
  let positionSizingInput: { accountSize: number; maxRiskPercent: number } | null = null;

  if (params.accountSize !== undefined && params.maxRiskPercent !== undefined) {
    positionSizingInput = {
      accountSize: params.accountSize,
      maxRiskPercent: params.maxRiskPercent,
    };
    positionSizing = calculatePositionSizing(
      params.accountSize,
      params.maxRiskPercent,
      invalidationCandidates,
      params.currentPrice,
      params.trend.symbol,
      atr,
      params.quoteToAccountRate,
      params.accountCurrency ?? 'USD'
    );
  }

  return {
    symbol: params.trend.symbol ?? 'unknown',
    timeframe: params.trend.timeframe ?? 'unknown',
    currentPrice: params.currentPrice,
    nearbySupport,
    nearbyResistance,
    atr,
    volatilityContext,
    invalidationCandidates,
    riskRewardScenarios: annotatedRiskRewardScenarios,
    tradeQuality: tradeQuality.quality,
    tradeQualityReasons: tradeQuality.reasons,
    decision,
    positionSizing,
    positionSizingInput,
    thresholds: {
      nearbyATR: DEFAULT_NEARBY_ATR,
      withinRangeATR: DEFAULT_WITHIN_RANGE_ATR,
    },
    disclaimer: 'This reflects calculated distances between price and technical levels. It is not a probability of profit, a guaranteed outcome, or trading advice.',
    analyzedAt: new Date().toISOString(),
  };
}

function assessTradeDecision(
  trend: TrendAnalysisResult,
  setups: DetectedSetup[],
  momentum: MomentumAnalysisResult | undefined,
  multiTimeframe: MultiTimeframeAnalysis | undefined,
  nearbySupport: NearbyLevel | null,
  nearbyResistance: NearbyLevel | null,
  tradeQuality: { quality: TradeQuality; reasons: string[] },
): TradeDecisionSummary {
  const trendScore = Math.max(0, Math.min(100, Math.round(trend.score)));
  const direction = trend.trend === 'neutral'
    ? setups[0]?.direction ?? 'bullish'
    : trend.trend;
  const reasons: string[] = [];

  const alignment = multiTimeframe?.alignment;
  const isMixedAlignment = alignment === 'mixed' || alignment === 'insufficient_data';
  const relevantSnapshots = multiTimeframe
    ? [multiTimeframe.higherTimeframe, multiTimeframe.analysis, multiTimeframe.lowerTimeframe]
      .filter((snapshot) => snapshot !== null)
    : [];

  for (const snapshot of relevantSnapshots) {
    if (snapshot.status === 'ok' && snapshot.trend === 'neutral') {
      reasons.push(`${snapshot.timeframe} neutral`);
    }
  }

  const directionalMomentum = momentum && momentum.momentum !== 'neutral';
  const momentumWeakening = momentum && (
    momentum.momentum === 'neutral' ||
    momentum.strength !== 'strong' ||
    (directionalMomentum && momentum.momentum !== direction)
  );
  if (momentumWeakening) reasons.push('momentum weakening');

  const nearbyOpposingLevel = direction === 'bullish' ? nearbyResistance : nearbySupport;
  if (direction === 'bullish' && nearbyResistance?.proximity === 'nearby') reasons.push('resistance too close');
  if (direction === 'bearish' && nearbySupport?.proximity === 'nearby') reasons.push('support too close');
  if (isMixedAlignment && !reasons.some((reason) => reason.includes('neutral'))) {
    reasons.push('multi-timeframe alignment mixed');
  }

  const setupScore = setups.length > 0 ? Math.max(...setups.map((setup) => setup.strength)) : 0;
  const alignmentScore = alignment === 'aligned_bullish' || alignment === 'aligned_bearish'
    ? 100
    : alignment === 'partially_aligned_bullish' || alignment === 'partially_aligned_bearish'
      ? 70
      : alignment === 'aligned_neutral'
        ? 35
        : alignment === 'mixed'
          ? 25
          : 0;
  const momentumScore = !momentum ? 50 : momentum.momentum === direction
    ? momentum.strength === 'strong' ? 100 : momentum.strength === 'moderate' ? 75 : 55
    : momentum.momentum === 'neutral' ? 40 : 15;
  const locationScore = nearbyOpposingLevel?.proximity === 'nearby'
    ? 15
    : nearbyOpposingLevel?.proximity === 'within_range'
      ? 55
      : 85;
  const rawEntryQualityScore = Math.round(
    setupScore * 0.35 + alignmentScore * 0.25 + momentumScore * 0.20 + locationScore * 0.20,
  );

  const blocked = reasons.length > 0 || tradeQuality.quality === 'wait';
  const state: TradeDecisionSummary['state'] = blocked
    ? 'wait'
    : rawEntryQualityScore >= 70
      ? 'ready'
      : 'review';

  const entryQualityScore = blocked
    ? Math.min(rawEntryQualityScore, 69)
    : rawEntryQualityScore;

  return {
    state,
    trendScore,
    rawEntryQualityScore: Math.max(0, Math.min(100, rawEntryQualityScore)),
    entryQualityScore: Math.max(0, Math.min(100, entryQualityScore)),
    entryQualityBlocked: blocked,
    entryQualityNote: blocked
      ? 'Capped while Trade Quality is WAIT. Raw setup score is informational only and not actionable.'
      : null,
    rejectionReasons: reasons,
  };
}

function assessTradeQuality(
  trend: TrendAnalysisResult,
  structure: MarketStructureResult,
  setups: DetectedSetup[],
  scenarios: RiskRewardScenario[],
  volatility: VolatilityAnalysisResult,
  momentum: MomentumAnalysisResult | undefined,
  multiTimeframe: MultiTimeframeAnalysis | undefined
): { quality: 'wait' | 'low' | 'moderate' | 'high'; reasons: string[] } {
  const reasons: string[] = [];
  const bestRatio = scenarios.reduce((best, scenario) => Math.max(best, Number(scenario.ratio)), 0);
  const hasExtremeScenario = scenarios.some((scenario) => scenario.quality === 'extreme');
  if (trend.trend === 'neutral') reasons.push('Trend is neutral; directional evidence is not aligned.');
  if (structure.trend === 'range') reasons.push('Market structure is ranging, not a confirmed directional trend.');
  if (setups.length === 0) reasons.push('No setup passed the minimum evidence conditions.');
  if (bestRatio < 1) reasons.push('All calculated reward/risk scenarios are below 1.0.');
  else if (bestRatio < 1.5) reasons.push(`Best technical reward/risk is ${bestRatio.toFixed(2)}, below the 1.50 review threshold.`);
  if (hasExtremeScenario) reasons.push('At least one reward/risk scenario is mathematically extreme and is not treated as a realistic edge.');
  if (volatility.bandDisagreement) reasons.push('ATR and Bollinger width disagree on the current volatility regime.');
  if (momentum?.counterTrend) reasons.push(`Momentum is counter-trend (${momentum.momentum} versus ${structure.trend} market structure).`);
  if (momentum?.divergence) reasons.push(`${momentum.divergence} momentum divergence is present.`);
  if (multiTimeframe && (multiTimeframe.alignment === 'mixed' || multiTimeframe.alignment === 'insufficient_data')) reasons.push(`Multi-timeframe alignment is ${multiTimeframe.alignment.replace('_', ' ')}.`);
  if (multiTimeframe && trend.trend !== 'neutral' && !multiTimeframe.alignment.includes(trend.trend)) reasons.push(`Higher/current/lower timeframe evidence does not confirm the ${trend.trend} direction.`);

  if (reasons.some((reason) => reason.includes('neutral') || reason.includes('No setup') || reason.includes('below 1.0') || reason.includes('extreme') || reason.includes('counter-trend') || reason.includes('divergence') || reason.includes('alignment is mixed') || reason.includes('does not confirm'))) {
    return { quality: 'wait', reasons };
  }
  if (reasons.length > 0) return { quality: 'low', reasons };
  if (bestRatio < 2) return { quality: 'moderate', reasons: ['Technical conditions are present but not strongly asymmetric.'] };
  return { quality: 'high', reasons: ['Technical conditions and calculated asymmetry are aligned.'] };
}

function buildVolatilityContext(volatility: VolatilityAnalysisResult): VolatilityContext {
  let note = '';
  const classification = volatility.classification;

  if (classification === 'high' || classification === 'very high') {
    note = 'Elevated volatility — structural levels may be reached faster than raw price distance suggests. Consider that stops and targets may need more room.';
  } else if (classification === 'low' || classification === 'very low') {
    note = 'Compressed volatility — structural levels are closer in ATR terms than they appear in raw price distance.';
  } else {
    note = 'Volatility is within a normal range — distance to levels in ATR terms is representative of typical market conditions.';
  }

  if (volatility.bandDisagreement) {
    note += ' ATR and Bollinger Band width are giving mixed signals — volatility may be shifting unevenly.';
  }

  return {
    atr: volatility.currentAtr,
    atrPercentile: volatility.atrPercentile,
    classification,
    bandDisagreement: volatility.bandDisagreement,
    note,
  };
}

function findNearbySupport(
  sr: SupportResistanceResponse,
  currentPrice: number,
  atr: number
): NearbyLevel | null {
  const supports = [...sr.supports, ...sr.tested].filter((s) => s.zoneHigh < currentPrice);

  if (supports.length === 0) return null;

  let nearest = supports[0];
  let nearestDistance = Math.abs(currentPrice - supports[0].price);

  for (const level of supports) {
    const distance = Math.abs(currentPrice - level.price);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = level;
    }
  }

  const distanceInATR = atr > 0 ? nearestDistance / atr : 0;
  const distanceFromPricePct = (nearestDistance / currentPrice) * 100;

  return {
    price: nearest.price,
    zoneRange: [nearest.zoneLow, nearest.zoneHigh],
    strength: nearest.strength,
    distanceFromPrice: nearestDistance,
    distanceFromPricePct,
    distanceInATR,
    proximity: classifyProximity(distanceInATR),
  };
}

function findNearbyResistance(
  sr: SupportResistanceResponse,
  currentPrice: number,
  atr: number
): NearbyLevel | null {
  const resistances = [...sr.resistances, ...sr.tested].filter((r) => r.zoneLow > currentPrice);

  if (resistances.length === 0) return null;

  let nearest = resistances[0];
  let nearestDistance = Math.abs(currentPrice - resistances[0].price);

  for (const level of resistances) {
    const distance = Math.abs(currentPrice - level.price);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = level;
    }
  }

  const distanceInATR = atr > 0 ? nearestDistance / atr : 0;
  const distanceFromPricePct = (nearestDistance / currentPrice) * 100;

  return {
    price: nearest.price,
    zoneRange: [nearest.zoneLow, nearest.zoneHigh],
    strength: nearest.strength,
    distanceFromPrice: nearestDistance,
    distanceFromPricePct,
    distanceInATR,
    proximity: classifyProximity(distanceInATR),
  };
}

function classifyProximity(distanceInATR: number): ProximityLabel {
  if (distanceInATR <= DEFAULT_NEARBY_ATR) return 'nearby';
  if (distanceInATR <= DEFAULT_WITHIN_RANGE_ATR) return 'within_range';
  return 'distant';
}

function buildInvalidationCandidates(
  params: {
    trend: TrendAnalysisResult;
    structure: MarketStructureResult;
    setups: DetectedSetup[];
    currentPrice: number;
  },
  nearbySupport: NearbyLevel | null,
  nearbyResistance: NearbyLevel | null,
  atr: number
): InvalidationCandidate[] {
  const { currentPrice } = params;
  const candidates: InvalidationCandidate[] = [];

  const activeSetups = params.setups.filter((s) => s.conditionsMet.length > 0);

  for (const setup of activeSetups) {
    if (setup.invalidationCondition && setup.invalidationCondition.trim().length > 0) {
      const priceMatch = setup.invalidationCondition.match(/(?:below|above)\s+(\d+\.\d+|\d+)/i);
      if (priceMatch) {
        const invalidationPrice = parseFloat(priceMatch[1]);
        const distance = Math.abs(params.currentPrice - invalidationPrice);
        const distanceInATR = atr > 0 ? distance / atr : 0;
        candidates.push({
          source: 'activeSetup',
          price: invalidationPrice,
          description: setup.invalidationCondition,
          distanceFromPrice: distance,
          distanceInATR,
        });
      }
    }
  }

  if (params.structure.lastSwingLow) {
    const distance = Math.abs(params.currentPrice - params.structure.lastSwingLow.price);
    candidates.push({
      source: 'protectedStructureLevel',
      price: params.structure.lastSwingLow.price,
      description: `Break of protected swing low at ${params.structure.lastSwingLow.price.toFixed(5)} — would constitute Change of Character`,
      distanceFromPrice: distance,
      distanceInATR: atr > 0 ? distance / atr : 0,
    });
  }

  if (params.structure.lastSwingHigh) {
    const distance = Math.abs(params.currentPrice - params.structure.lastSwingHigh.price);
    candidates.push({
      source: 'protectedStructureLevel',
      price: params.structure.lastSwingHigh.price,
      description: `Break of protected swing high at ${params.structure.lastSwingHigh.price.toFixed(5)} — would constitute Change of Character`,
      distanceFromPrice: distance,
      distanceInATR: atr > 0 ? distance / atr : 0,
    });
  }

  if (nearbySupport && nearbySupport.price < currentPrice) {
    const distance = Math.abs(currentPrice - nearbySupport.price);
    const exists = candidates.some((c) => Math.abs(c.price - nearbySupport.price) < atr * 0.1);
    if (!exists) {
      candidates.push({
        source: 'nearbySupport',
        price: nearbySupport.price,
        description: `Nearby support at ${nearbySupport.price.toFixed(5)}`,
        distanceFromPrice: distance,
        distanceInATR: atr > 0 ? distance / atr : 0,
      });
    }
  }

  if (nearbyResistance && nearbyResistance.price > currentPrice) {
    const distance = Math.abs(currentPrice - nearbyResistance.price);
    const exists = candidates.some((c) => Math.abs(c.price - nearbyResistance.price) < atr * 0.1);
    if (!exists) {
      candidates.push({
        source: 'nearbyResistance',
        price: nearbyResistance.price,
        description: `Nearby resistance at ${nearbyResistance.price.toFixed(5)}`,
        distanceFromPrice: distance,
        distanceInATR: atr > 0 ? distance / atr : 0,
      });
    }
  }

  if (candidates.length === 0 && params.trend.ema.ema50 !== null) {
    const ema50 = params.trend.ema.ema50;
    const distance = Math.abs(params.currentPrice - ema50);
    candidates.push({
      source: 'emaBreak',
      price: ema50,
      description: `Sustained ${ema50 > currentPrice ? 'reclaim' : 'close'} of EMA50 (${ema50.toFixed(5)}) — lower-confidence invalidation signal`,
      distanceFromPrice: distance,
      distanceInATR: atr > 0 ? distance / atr : 0,
    });
  }

  return candidates;
}

function buildRiskRewardScenarios(
  currentPrice: number,
  nearbySupport: NearbyLevel | null,
  nearbyResistance: NearbyLevel | null,
  invalidationCandidates: InvalidationCandidate[],
  atr: number
): RiskRewardScenario[] {
  const scenarios: RiskRewardScenario[] = [];

  if (invalidationCandidates.length === 0) return scenarios;

  // Setup text can describe an invalidation immediately beside the current
  // price (common for breakout candidates). That is logically valid but not
  // a usable risk boundary and creates artificial 20x-60x R:R values.
  const usableInvalidations = invalidationCandidates.filter(
    (candidate) => candidate.distanceInATR >= MIN_SCENARIO_INVALIDATION_DISTANCE_ATR,
  );

  const bullishInvalidation = usableInvalidations
    .filter((candidate) => candidate.price < currentPrice)
    .sort((a, b) => Math.abs(currentPrice - a.price) - Math.abs(currentPrice - b.price))[0];
  const bearishInvalidation = usableInvalidations
    .filter((candidate) => candidate.price > currentPrice)
    .sort((a, b) => Math.abs(currentPrice - a.price) - Math.abs(currentPrice - b.price))[0];

  if (nearbyResistance && nearbyResistance.price > currentPrice && bullishInvalidation) {
    const targetDistance = nearbyResistance.price - currentPrice;
    const invalidationDistance = Math.abs(currentPrice - bullishInvalidation.price);
    const ratioNumber = invalidationDistance > 0 ? targetDistance / invalidationDistance : 0;
    const ratio = ratioNumber.toFixed(2);
    const targetDistanceInATR = atr > 0 ? targetDistance / atr : 0;
    const extreme = ratioNumber > EXTREME_REWARD_RISK_RATIO || targetDistanceInATR > EXTREME_TARGET_DISTANCE_ATR;

    scenarios.push({
      direction: 'bullish',
      entryReference: currentPrice,
      invalidation: {
        price: bullishInvalidation.price,
        distanceInATR: bullishInvalidation.distanceInATR,
      },
      target: {
        price: nearbyResistance.price,
        strength: nearbyResistance.strength,
        distanceInATR: nearbyResistance.distanceInATR,
      },
      ratio,
      quality: extreme ? 'extreme' : 'normal',
      warning: extreme ? 'Mathematically extreme: the invalidation is unusually narrow or the target is unusually distant; do not treat this ratio as a realistic edge.' : undefined,
    });
  }

  if (nearbySupport && nearbySupport.price < currentPrice && bearishInvalidation) {
    const targetDistance = currentPrice - nearbySupport.price;
    const invalidationDistance = Math.abs(currentPrice - bearishInvalidation.price);
    const ratioNumber = invalidationDistance > 0 ? targetDistance / invalidationDistance : 0;
    const ratio = ratioNumber.toFixed(2);
    const targetDistanceInATR = atr > 0 ? targetDistance / atr : 0;
    const extreme = ratioNumber > EXTREME_REWARD_RISK_RATIO || targetDistanceInATR > EXTREME_TARGET_DISTANCE_ATR;

    scenarios.push({
      direction: 'bearish',
      entryReference: currentPrice,
      invalidation: {
        price: bearishInvalidation.price,
        distanceInATR: bearishInvalidation.distanceInATR,
      },
      target: {
        price: nearbySupport.price,
        strength: nearbySupport.strength,
        distanceInATR: nearbySupport.distanceInATR,
      },
      ratio,
      quality: extreme ? 'extreme' : 'normal',
      warning: extreme ? 'Mathematically extreme: the invalidation is unusually narrow or the target is unusually distant; do not treat this ratio as a realistic edge.' : undefined,
    });
  }

  return scenarios;
}

function annotateRiskRewardScenarios(
  scenarios: RiskRewardScenario[],
  trend: TrendAnalysisResult,
  tradeQuality: { quality: TradeQuality; reasons: string[] },
): RiskRewardScenario[] {
  return scenarios.map((scenario) => {
    const warnings: string[] = [];
    if (scenario.warning) warnings.push(scenario.warning);
    if (tradeQuality.quality === 'wait') {
      warnings.push('Calculated while Trade Quality is WAIT — this is distance geometry only, not a validated edge.');
    }
    if (trend.trend === 'neutral') {
      warnings.push('Trend is neutral — a higher ratio on one side does not confirm that direction.');
    }
    if (scenario.quality === 'normal' && Number(scenario.ratio) >= 1.5 && tradeQuality.quality === 'wait') {
      warnings.push('Do not treat a favorable ratio as trade permission while broader evidence remains unaligned.');
    }

    return warnings.length > 0
      ? { ...scenario, warning: warnings.join(' ') }
      : scenario;
  });
}

function calculatePositionSizing(
  accountSize: number,
  maxRiskPercent: number,
  invalidationCandidates: InvalidationCandidate[],
  currentPrice: number,
  symbol: string,
  atr: number,
  quoteToAccountRate = 1,
  accountCurrency = 'USD'
): PositionSizingResult | null {
  if (accountSize <= 0 || maxRiskPercent <= 0) return null;
  if (invalidationCandidates.length === 0) return null;

  // A boundary that is closer than this is too sensitive to spread and normal
  // candle noise to support an educational position-size example. Returning
  // unavailable is safer than converting a tiny distance into a huge size.
  const sizingInvalidation = invalidationCandidates
    .filter((candidate) => candidate.distanceInATR >= MIN_SCENARIO_INVALIDATION_DISTANCE_ATR)
    .sort((a, b) => a.distanceInATR - b.distanceInATR)[0];
  if (!sizingInvalidation) return null;

  const clampedRiskPercent = Math.max(DEFAULT_MIN_RISK_PERCENT, Math.min(DEFAULT_MAX_RISK_PERCENT, maxRiskPercent));
  const unusuallyHighRisk = maxRiskPercent > 10;

  const primaryInvalidation = sizingInvalidation;
  const riskDistance = Math.abs(currentPrice - primaryInvalidation.price);

  const calculation = calculateSharedPositionSize({
    accountSize,
    riskPercent: clampedRiskPercent,
    currentPrice,
    invalidationPrice: primaryInvalidation.price,
    symbol,
    quoteToAccountRate,
  });
  if (!calculation) return null;

  return {
    riskAmount: Math.round(calculation.riskAmount * 100) / 100,
    riskDistanceInPips: Math.round(calculation.riskDistanceInPips * 100) / 100,
    positionSizeUnits: Math.round(calculation.positionSizeUnits),
    positionSizeLots: Math.round(calculation.positionSizeLots * 10000) / 10000,
    basedOnInvalidation: primaryInvalidation.price,
    unusuallyHighRisk,
    accountCurrency,
    quoteToAccountRate,
    conversionPair: quoteToAccountRate === 1 ? null : `USD/${symbol.split('/')[1]}`,
  };
}
