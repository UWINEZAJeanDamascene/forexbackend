import {
  TrendAnalysisResult,
  MarketStructureResult,
  VolatilityAnalysisResult,
  SupportResistanceResponse,
  DetectedSetup,
} from '../../shared/types';
import {
  RiskAnalysisResult,
  NearbyLevel,
  InvalidationCandidate,
  RiskRewardScenario,
  PositionSizingResult,
  VolatilityContext,
  ProximityLabel,
} from '../../shared/types/riskAnalysis';
import { getInstrumentConfig } from '../../../shared/constants/instrumentConfig';

const DEFAULT_NEARBY_ATR = 1.5;
const DEFAULT_WITHIN_RANGE_ATR = 3.0;
const DEFAULT_MAX_RISK_PERCENT = 10;
const DEFAULT_MIN_RISK_PERCENT = 0.1;

export function computeRiskAnalysis(params: {
  trend: TrendAnalysisResult;
  structure: MarketStructureResult;
  volatility: VolatilityAnalysisResult;
  supportResistance: SupportResistanceResponse;
  setups: DetectedSetup[];
  currentPrice: number;
  accountSize?: number;
  maxRiskPercent?: number;
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
    invalidationCandidates
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
      atr
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
    riskRewardScenarios,
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
  const supports = [...sr.supports, ...sr.tested].filter((s) => s.price < currentPrice);

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
  const resistances = [...sr.resistances, ...sr.tested].filter((r) => r.price > currentPrice);

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

  if (params.structure.lastSwingLow && params.structure.trend === 'bullish') {
    const distance = Math.abs(params.currentPrice - params.structure.lastSwingLow.price);
    candidates.push({
      source: 'protectedStructureLevel',
      price: params.structure.lastSwingLow.price,
      description: `Break of protected swing low at ${params.structure.lastSwingLow.price.toFixed(5)} — would constitute Change of Character`,
      distanceFromPrice: distance,
      distanceInATR: atr > 0 ? distance / atr : 0,
    });
  }

  if (params.structure.lastSwingHigh && params.structure.trend === 'bearish') {
    const distance = Math.abs(params.currentPrice - params.structure.lastSwingHigh.price);
    candidates.push({
      source: 'protectedStructureLevel',
      price: params.structure.lastSwingHigh.price,
      description: `Break of protected swing high at ${params.structure.lastSwingHigh.price.toFixed(5)} — would constitute Change of Character`,
      distanceFromPrice: distance,
      distanceInATR: atr > 0 ? distance / atr : 0,
    });
  }

  if (candidates.length === 0 && params.trend.ema.ema50 !== null) {
    const ema50 = params.trend.ema.ema50;
    const distance = Math.abs(params.currentPrice - ema50);
    candidates.push({
      source: 'emaBreak',
      price: ema50,
      description: `Sustained close below EMA50 (${ema50.toFixed(5)}) — lower-confidence invalidation signal`,
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
  invalidationCandidates: InvalidationCandidate[]
): RiskRewardScenario[] {
  const scenarios: RiskRewardScenario[] = [];

  if (invalidationCandidates.length === 0) return scenarios;

  const primaryInvalidation = invalidationCandidates[0];

  if (nearbyResistance && nearbyResistance.price > currentPrice) {
    const targetDistance = nearbyResistance.price - currentPrice;
    const invalidationDistance = Math.abs(currentPrice - primaryInvalidation.price);
    const ratio = invalidationDistance > 0 ? (targetDistance / invalidationDistance).toFixed(2) : '0.00';

    scenarios.push({
      direction: 'bullish',
      entryReference: currentPrice,
      invalidation: {
        price: primaryInvalidation.price,
        distanceInATR: primaryInvalidation.distanceInATR,
      },
      target: {
        price: nearbyResistance.price,
        strength: nearbyResistance.strength,
        distanceInATR: nearbyResistance.distanceInATR,
      },
      ratio,
    });
  }

  if (nearbySupport && nearbySupport.price < currentPrice) {
    const targetDistance = currentPrice - nearbySupport.price;
    const invalidationDistance = Math.abs(currentPrice - primaryInvalidation.price);
    const ratio = invalidationDistance > 0 ? (targetDistance / invalidationDistance).toFixed(2) : '0.00';

    scenarios.push({
      direction: 'bearish',
      entryReference: currentPrice,
      invalidation: {
        price: primaryInvalidation.price,
        distanceInATR: primaryInvalidation.distanceInATR,
      },
      target: {
        price: nearbySupport.price,
        strength: nearbySupport.strength,
        distanceInATR: nearbySupport.distanceInATR,
      },
      ratio,
    });
  }

  return scenarios;
}

function calculatePositionSizing(
  accountSize: number,
  maxRiskPercent: number,
  invalidationCandidates: InvalidationCandidate[],
  currentPrice: number,
  symbol: string,
  atr: number
): PositionSizingResult | null {
  if (accountSize <= 0 || maxRiskPercent <= 0) return null;
  if (invalidationCandidates.length === 0) return null;

  const clampedRiskPercent = Math.max(DEFAULT_MIN_RISK_PERCENT, Math.min(DEFAULT_MAX_RISK_PERCENT, maxRiskPercent));
  const unusuallyHighRisk = maxRiskPercent > 10;

  const riskAmount = accountSize * (clampedRiskPercent / 100);
  const primaryInvalidation = invalidationCandidates[0];
  const riskDistance = Math.abs(currentPrice - primaryInvalidation.price);

  const config = getInstrumentConfig(symbol);
  const pipValue = config.pipValue;
  const lotSize = config.lotSize;

  if (pipValue <= 0 || riskDistance <= 0) return null;

  const riskDistanceInPips = riskDistance / pipValue;
  const positionSizeUnits = riskAmount / riskDistanceInPips;
  const positionSizeLots = lotSize > 0 ? positionSizeUnits / lotSize : 0;

  return {
    riskAmount: Math.round(riskAmount * 100) / 100,
    riskDistanceInPips: Math.round(riskDistanceInPips * 100) / 100,
    positionSizeUnits: Math.round(positionSizeUnits * 100) / 100,
    positionSizeLots: Math.round(positionSizeLots * 10000) / 10000,
    basedOnInvalidation: primaryInvalidation.price,
    unusuallyHighRisk,
  };
}
