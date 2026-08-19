import { Candle } from '../../shared/types/market';
import { IndicatorValues } from '../../shared/types/indicators';
import { MarketStructureResult } from '../../shared/types/marketStructure';
import { TrendAnalysisResult, TrendDirection, TrendFactor } from '../../shared/types/trendAnalysis';

const TREND_WEIGHTS = {
  emaAlignment: 30,
  marketStructure: 35,
  priceVsEma: 20,
  recentHighsLows: 15,
} as const;

const BULLISH_THRESHOLD = 60;
const BEARISH_THRESHOLD = -60;

export function analyzeTrend(
  candles: Candle[],
  indicators: IndicatorValues,
  structure: MarketStructureResult
): TrendAnalysisResult {
  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : null;

  const ema20 = lastNonNil(indicators.ema20);
  const ema50 = lastNonNil(indicators.ema50);
  const ema200 = lastNonNil(indicators.ema200);

  const emaAlignment = analyzeEmaAlignment(ema20, ema50, ema200);
  const priceVsEma = analyzePriceVsEma(currentPrice, ema20, ema50, ema200);
  const marketStructure = analyzeMarketStructureFactor(structure);
  const recentHighsLows = analyzeRecentHighsLows(structure);

  const factors = {
    emaAlignment,
    marketStructure,
    priceVsEma,
    recentHighsLows,
  };

  let totalScore = 0;
  totalScore += emaAlignment.score;
  totalScore += marketStructure.score;
  totalScore += priceVsEma.score;
  totalScore += recentHighsLows.score;

  let trend: TrendDirection;
  if (totalScore >= BULLISH_THRESHOLD) {
    trend = 'bullish';
  } else if (totalScore <= BEARISH_THRESHOLD) {
    trend = 'bearish';
  } else {
    trend = 'neutral';
  }

  const strength = deriveStrength(totalScore, factors);

  return {
    trend,
    strength,
    score: totalScore,
    factors,
    currentPrice: currentPrice ?? 0,
    ema: {
      ema20,
      ema50,
      ema200,
    },
    analyzedAt: new Date().toISOString(),
  };
}

function lastNonNil(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] !== null && values[i] !== undefined) {
      return values[i];
    }
  }
  return null;
}

function analyzeEmaAlignment(ema20: number | null, ema50: number | null, ema200: number | null): TrendFactor {
  if (ema20 === null || ema50 === null) {
    return {
      direction: 'neutral',
      score: 0,
      explanation: 'Insufficient EMA data for alignment analysis.',
    };
  }

  if (ema200 !== null) {
    if (ema20 > ema50 && ema50 > ema200) {
      return {
        direction: 'bullish',
        score: TREND_WEIGHTS.emaAlignment,
        explanation: 'EMA20 is above EMA50 and EMA50 is above EMA200.',
      };
    }

    if (ema20 < ema50 && ema50 < ema200) {
      return {
        direction: 'bearish',
        score: -TREND_WEIGHTS.emaAlignment,
        explanation: 'EMA20 is below EMA50 and EMA50 is below EMA200.',
      };
    }
  }

  if (ema20 > ema50) {
    return {
      direction: 'bullish',
      score: Math.round(TREND_WEIGHTS.emaAlignment * 0.6),
      explanation: 'EMA20 is above EMA50. EMA200 is unavailable for full alignment assessment.',
    };
  }

  if (ema20 < ema50) {
    return {
      direction: 'bearish',
      score: Math.round(-TREND_WEIGHTS.emaAlignment * 0.6),
      explanation: 'EMA20 is below EMA50. EMA200 is unavailable for full alignment assessment.',
    };
  }

  return {
    direction: 'neutral',
    score: 0,
    explanation: 'EMA20 and EMA50 are closely aligned with no clear direction.',
  };
}

function analyzePriceVsEma(
  price: number | null,
  ema20: number | null,
  ema50: number | null,
  ema200: number | null
): TrendFactor {
  if (price === null) {
    return {
      direction: 'neutral',
      score: 0,
      explanation: 'Current price is unavailable.',
    };
  }

  const aboveCount = [ema20, ema50, ema200].filter((ema) => ema !== null && price > ema).length;
  const belowCount = [ema20, ema50, ema200].filter((ema) => ema !== null && price < ema).length;
  const total = aboveCount + belowCount;

  if (total === 0) {
    return {
      direction: 'neutral',
      score: 0,
      explanation: 'Insufficient EMA data for price comparison.',
    };
  }

  if (aboveCount === total) {
    return {
      direction: 'bullish',
      score: TREND_WEIGHTS.priceVsEma,
      explanation: 'Current price is above all available major EMA levels.',
    };
  }

  if (belowCount === total) {
    return {
      direction: 'bearish',
      score: -TREND_WEIGHTS.priceVsEma,
      explanation: 'Current price is below all available major EMA levels.',
    };
  }

  if (aboveCount > belowCount) {
    return {
      direction: 'bullish',
      score: Math.round(TREND_WEIGHTS.priceVsEma * 0.5),
      explanation: 'Current price is above some, but not all, major EMA levels.',
    };
  }

  if (belowCount > aboveCount) {
    return {
      direction: 'bearish',
      score: Math.round(-TREND_WEIGHTS.priceVsEma * 0.5),
      explanation: 'Current price is below some, but not all, major EMA levels.',
    };
  }

  return {
    direction: 'neutral',
    score: 0,
    explanation: 'Current price is mixed relative to available EMA levels.',
  };
}

function analyzeMarketStructureFactor(structure: MarketStructureResult): TrendFactor {
  const trend = structure.trend;

  if (trend === 'bullish') {
    return {
      direction: 'bullish',
      score: TREND_WEIGHTS.marketStructure,
      explanation: 'Recent structure contains higher highs and higher lows.',
    };
  }

  if (trend === 'bearish') {
    return {
      direction: 'bearish',
      score: -TREND_WEIGHTS.marketStructure,
      explanation: 'Recent structure contains lower highs and lower lows.',
    };
  }

  if (trend === 'range') {
    return {
      direction: 'neutral',
      score: 0,
      explanation: 'Market structure is ranging with mixed swing behavior.',
    };
  }

  return {
    direction: 'neutral',
    score: 0,
    explanation: 'Insufficient swing points to determine market structure.',
  };
}

function analyzeRecentHighsLows(structure: MarketStructureResult): TrendFactor {
  const hh = structure.higherHighsCount;
  const hl = structure.higherLowsCount;
  const lh = structure.lowerHighsCount;
  const ll = structure.lowerLowsCount;
  const total = hh + hl + lh + ll;

  if (total === 0) {
    return {
      direction: 'neutral',
      score: 0,
      explanation: 'Insufficient recent swing data for highs/lows analysis.',
    };
  }

  const bullishCount = hh + hl;
  const bearishCount = lh + ll;

  if (bullishCount > bearishCount) {
    return {
      direction: 'bullish',
      score: TREND_WEIGHTS.recentHighsLows,
      explanation: 'Recent swing highs and lows are trending higher.',
    };
  }

  if (bearishCount > bullishCount) {
    return {
      direction: 'bearish',
      score: -TREND_WEIGHTS.recentHighsLows,
      explanation: 'Recent swing highs and lows are trending lower.',
    };
  }

  return {
    direction: 'neutral',
    score: 0,
    explanation: 'Recent swing highs and lows show mixed behavior.',
  };
}

function deriveStrength(score: number, factors: {
  emaAlignment: TrendFactor;
  marketStructure: TrendFactor;
  priceVsEma: TrendFactor;
  recentHighsLows: TrendFactor;
}): TrendStrength {
  const directions = [factors.emaAlignment.direction, factors.marketStructure.direction, factors.priceVsEma.direction, factors.recentHighsLows.direction];
  const bullishCount = directions.filter((d) => d === 'bullish').length;
  const bearishCount = directions.filter((d) => d === 'bearish').length;

  if (bullishCount === 4 || bearishCount === 4) {
    return 'strong';
  }

  if (bullishCount >= 2 || bearishCount >= 2) {
    return 'moderate';
  }

  return 'weak';
}
