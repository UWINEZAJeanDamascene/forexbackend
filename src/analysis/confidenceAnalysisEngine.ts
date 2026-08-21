import {
  TrendAnalysisResult,
  MarketStructureResult,
  MomentumAnalysisResult,
  VolatilityAnalysisResult,
  SupportResistanceResponse,
  MultiTimeframeAnalysis,
  DetectedSetup,
} from '../../shared/types';
import { ConfidenceAnalysisResult, ConfidenceBand, ConfidenceFactor, ConfidenceWarning } from '../../shared/types/confidenceAnalysis';

const TREND_WEIGHT = 0.20;
const STRUCTURE_WEIGHT = 0.20;
const MOMENTUM_WEIGHT = 0.15;
const SUPPORT_RESISTANCE_WEIGHT = 0.15;
const VOLATILITY_WEIGHT = 0.10;
const MULTI_TIMEFRAME_WEIGHT = 0.20;

const STRUCTURE_CONTRADICTION_PENALTY = 20;
const OPPOSING_SETUPS_CAP = 70;
const OPPOSING_SETUPS_THRESHOLD = 10;
const PRICE_INSIDE_ZONE_SCORE = 30;
const BAND_THRESHOLDS = { low: 40, moderate: 70 } as const;

const VOLATILITY_BANDS = [
  { max: 20, label: 'Very Low', score: 100 },
  { max: 40, label: 'Low', score: 90 },
  { max: 60, label: 'Normal', score: 100 },
  { max: 80, label: 'High', score: 60 },
  { max: 100, label: 'Very High', score: 40 },
] as const;

export function computeConfidence(params: {
  trend: TrendAnalysisResult;
  structure: MarketStructureResult;
  momentum: MomentumAnalysisResult;
  volatility: VolatilityAnalysisResult;
  supportResistance: SupportResistanceResponse;
  multiTimeframe: MultiTimeframeAnalysis;
  setups: DetectedSetup[];
  currentPrice: number;
}): ConfidenceAnalysisResult {
  const warnings: ConfidenceWarning[] = [];
  const factors: ConfidenceFactor[] = [];

  const trendScore = computeTrendAlignment(params.trend);
  factors.push({
    name: 'Trend Alignment',
    score: trendScore.score,
    weight: TREND_WEIGHT,
    contribution: trendScore.score * TREND_WEIGHT,
    explanation: trendScore.explanation,
  });

  const structureScore = computeMarketStructure(params.structure, warnings);
  factors.push({
    name: 'Market Structure',
    score: structureScore.score,
    rawScore: structureScore.rawScore,
    weight: STRUCTURE_WEIGHT,
    contribution: structureScore.score * STRUCTURE_WEIGHT,
    explanation: structureScore.explanation,
  });

  const momentumScore = computeMomentumAgreement(params.momentum, params.trend);
  factors.push({
    name: 'Momentum',
    score: momentumScore.score,
    weight: MOMENTUM_WEIGHT,
    contribution: momentumScore.score * MOMENTUM_WEIGHT,
    explanation: momentumScore.explanation,
  });

  const srScore = computeSupportResistance(params.supportResistance, params.currentPrice, warnings);
  factors.push({
    name: 'Support/Resistance',
    score: srScore.score,
    weight: SUPPORT_RESISTANCE_WEIGHT,
    contribution: srScore.score * SUPPORT_RESISTANCE_WEIGHT,
    explanation: srScore.explanation,
  });

  const volatilityScore = computeVolatility(params.volatility);
  factors.push({
    name: 'Volatility',
    score: volatilityScore.score,
    weight: VOLATILITY_WEIGHT,
    contribution: volatilityScore.score * VOLATILITY_WEIGHT,
    explanation: volatilityScore.explanation,
  });

  const mtfScore = computeMultiTimeframe(params.multiTimeframe, warnings);
  factors.push({
    name: 'Multi-Timeframe Alignment',
    score: mtfScore.score,
    weight: MULTI_TIMEFRAME_WEIGHT,
    contribution: mtfScore.score * MULTI_TIMEFRAME_WEIGHT,
    explanation: mtfScore.explanation,
  });

  const unroundedTotal = factors.reduce((sum, f) => sum + f.contribution, 0);

  const hasOpposingSetups = checkOpposingSetups(params.setups);
  const cappedTotal = hasOpposingSetups ? Math.min(unroundedTotal, OPPOSING_SETUPS_CAP) : unroundedTotal;
  let overallScore = Math.round(cappedTotal);

  if (hasOpposingSetups) {
    warnings.push({
      type: 'opposing_setups',
      message: `Opposing setups detected — confidence capped at ${OPPOSING_SETUPS_CAP}/100.`,
      severity: 'warning',
    });
  }

  overallScore = Math.max(0, Math.min(100, overallScore));
  const band = deriveBand(overallScore);

  const explanation = buildExplanation(overallScore, band, factors, warnings, unroundedTotal);

  return {
    symbol: params.trend.symbol,
    timeframe: params.trend.timeframe,
    overallScore,
    band,
    factors,
    warnings,
    explanation,
    compositeBreakdown: factors.map((f) => ({
      name: f.name,
      score: f.score,
      rawScore: f.rawScore,
      weight: f.weight,
      contribution: f.contribution,
    })),
    analyzedAt: new Date().toISOString(),
  };
}

function computeTrendAlignment(trend: TrendAnalysisResult): { score: number; explanation: string } {
  const factors = [
    trend.factors.emaAlignment.direction,
    trend.factors.marketStructure.direction,
    trend.factors.priceVsEma.direction,
    trend.factors.recentHighsLows.direction,
  ];

  if (trend.trend === 'neutral') {
    return {
      score: 50,
      explanation: 'Overall trend is neutral; no directional alignment to measure.',
    };
  }

  const agreeing = factors.filter((d) => d === trend.trend).length;
  const score = (agreeing / factors.length) * 100;

  return {
    score: Math.round(score),
    explanation: `${agreeing}/${factors.length} trend factors align with overall ${trend.trend} trend.`,
  };
}

function computeMarketStructure(
  structure: MarketStructureResult,
  warnings: ConfidenceWarning[]
): { score: number; explanation: string } {
  const total = structure.higherHighsCount + structure.higherLowsCount + structure.lowerHighsCount + structure.lowerLowsCount;

  if (total === 0) {
    return { score: 50, explanation: 'Insufficient swing data for market structure scoring.' };
  }

  const rawRatio = ((structure.higherHighsCount + structure.higherLowsCount) / total) * 100;
  let score = rawRatio;

  let recencyAdjustment = 0;
  let recencyNote = 'No recent event adjustment.';
  if (structure.events.length > 0) {
    const latestEvent = structure.events[structure.events.length - 1].type;
    const contradicts =
      (structure.trend === 'bullish' && (latestEvent === 'lower_high' || latestEvent === 'lower_low')) ||
      (structure.trend === 'bearish' && (latestEvent === 'higher_high' || latestEvent === 'higher_low'));

    if (contradicts) {
      recencyAdjustment = -STRUCTURE_CONTRADICTION_PENALTY;
      recencyNote = `Latest event (${latestEvent.replace(/_/g, ' ')}) contradicts ${structure.trend} trend — penalized ${STRUCTURE_CONTRADICTION_PENALTY} points.`;
      warnings.push({
        type: 'structure_contradiction',
        message: recencyNote,
        severity: 'warning',
      });
    } else if (
      (structure.trend === 'bullish' && (latestEvent === 'higher_high' || latestEvent === 'higher_low')) ||
      (structure.trend === 'bearish' && (latestEvent === 'lower_high' || latestEvent === 'lower_low'))
    ) {
      recencyNote = `Latest event (${latestEvent.replace(/_/g, ' ')}) confirms ${structure.trend} trend — recency bonus applied.`;
    }
  }

  score = Math.max(0, Math.min(100, score + recencyAdjustment));

  return {
    score: Math.round(score),
    rawScore: Math.round(rawRatio),
    explanation: `Market Structure: ${Math.round(rawRatio)}% (raw HH/HL ratio)${recencyAdjustment !== 0 ? ` + ${recencyAdjustment > 0 ? '+' : ''}${recencyAdjustment} (recency)` : ''} = ${Math.round(score)}/100. ${recencyNote}`,
  };
}

function computeSupportResistance(
  sr: SupportResistanceResponse,
  currentPrice: number,
  warnings: ConfidenceWarning[]
): { score: number; explanation: string } {
  const allLevels = [...sr.supports, ...sr.resistances, ...sr.tested];

  if (allLevels.length === 0) {
    return { score: 50, explanation: 'No support/resistance levels detected.' };
  }

  let insideZone: SupportResistanceLevel | null = null;
  for (const level of allLevels) {
    if (currentPrice >= level.zoneLow && currentPrice <= level.zoneHigh) {
      insideZone = level;
      break;
    }
  }

  if (insideZone) {
    warnings.push({
      type: 'price_inside_zone',
      message: `Price is inside a ${insideZone.type} zone (${insideZone.zoneLow.toFixed(5)}–${insideZone.zoneHigh.toFixed(5)}) — reduced confidence.`,
      severity: 'warning',
    });
    return {
      score: PRICE_INSIDE_ZONE_SCORE,
      explanation: `Support/Resistance: ${PRICE_INSIDE_ZONE_SCORE}/100 — price is inside a ${insideZone.type} zone (${insideZone.zoneLow.toFixed(5)}–${insideZone.zoneHigh.toFixed(5)}); level not currently being tested.`,
    };
  }

  let nearestLevel = allLevels[0];
  let nearestDistance = Math.abs(currentPrice - allLevels[0].price);
  for (const level of allLevels) {
    const distance = Math.abs(currentPrice - level.price);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestLevel = level;
    }
  }

  return {
    score: nearestLevel.strength,
    explanation: `Support/Resistance: ${nearestLevel.strength}/100 — nearest zone at ${nearestLevel.price.toFixed(5)} (${nearestLevel.type}, ${nearestLevel.strength}/100 base${nearestLevel.touches === 0 ? ', untested' : ''}).`,
  };
}

function computeMomentumAgreement(
  momentum: MomentumAnalysisResult,
  trend: TrendAnalysisResult
): { score: number; explanation: string } {
  const trendDirection = trend.trend;
  const momentumDirection = momentum.momentum;

  if (trendDirection === 'neutral' || momentumDirection === 'neutral') {
    return {
      score: 50,
      explanation: `Momentum agreement: 50/100 — trend is ${trendDirection}, momentum is ${momentumDirection} (neutral, no strong signal).`,
    };
  }

  const strength = Math.abs(momentum.score);
  let score: number;
  let note: string;

  if (momentumDirection === trendDirection) {
    score = 50 + strength * 0.5;
    note = `momentum agrees with ${trendDirection} trend`;
  } else {
    score = 50 - strength * 0.5;
    note = `momentum is counter-trend (${momentumDirection}) against ${trendDirection} structure`;
  }

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    explanation: `Momentum agreement: ${Math.round(Math.max(0, Math.min(100, score)))}/100 — ${note}.`,
  };
}

function computeVolatility(volatility: VolatilityAnalysisResult): { score: number; explanation: string } {
  const percentile = volatility.atrPercentile;
  let band = 'Normal';
  let score = 100;

  if (volatility.bandDisagreement) {
    score = 40;
    band = 'Mixed signal';
  } else if (percentile <= 20) {
    band = 'Very Low';
    score = 100;
  } else if (percentile <= 40) {
    band = 'Low';
    score = 90;
  } else if (percentile <= 60) {
    band = 'Normal';
    score = 100;
  } else if (percentile <= 80) {
    band = 'High';
    score = 60;
  } else {
    band = 'Very High';
    score = 40;
  }

  return {
    score,
    explanation: `Volatility: ${percentile}th percentile (${band}) → confidence contribution ${score}/100${volatility.bandDisagreement ? ' (mixed ATR/BB signal)' : ''}.`,
  };
}

function computeMultiTimeframe(
  mtf: MultiTimeframeAnalysis,
  warnings: ConfidenceWarning[]
): { score: number; explanation: string } {
  const snapshots: { snapshot: typeof mtf.analysis; weight: number; label: string }[] = [];

  if (mtf.higherTimeframe && mtf.higherTimeframe.status === 'ok') {
    snapshots.push({ snapshot: mtf.higherTimeframe, weight: 0.5, label: `${mtf.higherTimeframe.timeframe} (weight 50%)` });
  }
  snapshots.push({ snapshot: mtf.analysis, weight: 0.3, label: `${mtf.analysisTimeframe} (weight 30%)` });
  if (mtf.lowerTimeframe && mtf.lowerTimeframe.status === 'ok') {
    snapshots.push({ snapshot: mtf.lowerTimeframe, weight: 0.2, label: `${mtf.lowerTimeframe.timeframe} (weight 20%)` });
  }

  if (snapshots.length === 0) {
    return { score: 50, explanation: 'No valid timeframe data for multi-timeframe scoring.' };
  }

  const totalWeight = snapshots.reduce((sum, s) => sum + s.weight, 0);
  const normalizedSnapshots = snapshots.map((s) => ({ ...s, weight: s.weight / totalWeight }));

  let alignedWeight = 0;
  const breakdown: string[] = [];
  for (const item of normalizedSnapshots) {
    const agrees = item.snapshot.trend === mtf.analysis.trend;
    const contribution = agrees ? item.weight * Math.abs(item.snapshot.score) : 0;
    alignedWeight += contribution;
    breakdown.push(`${item.label}: ${item.snapshot.trend} → ${contribution.toFixed(0)}`);
  }

  const score = Math.round(alignedWeight);

  if (mtf.higherTimeframe && mtf.higherTimeframe.status === 'ok' && mtf.higherTimeframe.trend !== mtf.analysis.trend) {
    warnings.push({
      type: 'mtf_mismatch',
      message: `Higher timeframe (${mtf.higherTimeframe.timeframe}) is ${mtf.higherTimeframe.trend}, not confirming ${mtf.analysis.trend} trend on ${mtf.analysisTimeframe}.`,
      severity: 'warning',
    });
  }

  return {
    score,
    explanation: `Multi-Timeframe Alignment: ${score}/100. Weighted formula: ${breakdown.join('; ')}.`,
  };
}

function checkOpposingSetups(setups: DetectedSetup[]): boolean {
  const bullish = setups.filter((s) => s.direction === 'bullish');
  const bearish = setups.filter((s) => s.direction === 'bearish');

  if (bullish.length === 0 || bearish.length === 0) return false;

  const hasSignificantBullish = bullish.some((s) => {
    const total = s.conditionsMet.length + s.conditionsMissing.length;
    return total > 0 && s.conditionsMet.length / total >= 0.5;
  });

  const hasSignificantBearish = bearish.some((s) => {
    const total = s.conditionsMet.length + s.conditionsMissing.length;
    return total > 0 && s.conditionsMet.length / total >= 0.5;
  });

  return hasSignificantBullish && hasSignificantBearish;
}

function deriveBand(score: number): ConfidenceBand {
  if (score <= BAND_THRESHOLDS.low) return 'Low';
  if (score <= BAND_THRESHOLDS.moderate) return 'Moderate';
  return 'High';
}

function buildExplanation(
  score: number,
  band: ConfidenceBand,
  factors: ConfidenceFactor[],
  warnings: ConfidenceWarning[],
  unroundedTotal: number
): string {
  const parts = [`Analysis Confidence: ${score}/100 — ${band}.`];

  const breakdown = factors
    .map((f) => `${f.name}: ${f.score} × ${(f.weight * 100).toFixed(0)}% = ${f.contribution.toFixed(2)}`)
    .join('; ');
  parts.push(`Composite: ${breakdown} = ${unroundedTotal.toFixed(2)} → rounded to ${score}.`);

  if (warnings.length > 0) {
    parts.push('Active warnings: ' + warnings.map((w) => w.message).join(' '));
  }

  parts.push('This reflects how well current indicators agree with each other. It is not a probability of profit and does not predict future price movement.');

  return parts.join(' ');
}
