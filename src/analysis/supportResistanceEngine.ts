import { Candle } from '../../shared/types/market';
import { SupportResistanceResponse, SupportResistanceLevel } from '../../shared/types/supportResistance';

const DEFAULT_SWING_WINDOW = 2;
const ZONE_TOLERANCE_PERCENT = 0.002; // 0.2% tolerance for clustering
const MIN_LEVEL_DISTANCE_PERCENT = 0.0015; // minimum distance between returned levels
const MAX_LEVELS = 3;

export function detectSupportResistance(
  candles: Candle[],
  swingWindow = DEFAULT_SWING_WINDOW
): SupportResistanceResponse {
  if (candles.length < swingWindow * 2 + 1) {
    return {
      symbol: '',
      timeframe: '',
      supports: [],
      resistances: [],
    };
  }

  const swingHighs = findSwingHighs(candles, swingWindow);
  const swingLows = findSwingLows(candles, swingWindow);

  const resistanceZones = clusterAndScore(swingHighs, 'resistance', candles);
  const supportZones = clusterAndScore(swingLows, 'support', candles);

  const resistances = pruneCloseLevels(
    resistanceZones
      .sort((a, b) => b.strength - a.strength)
  );

  const supports = pruneCloseLevels(
    supportZones
      .sort((a, b) => b.strength - a.strength)
  );

  return {
    symbol: '',
    timeframe: '',
    supports: supports.slice(0, MAX_LEVELS),
    resistances: resistances.slice(0, MAX_LEVELS),
  };
}

function findSwingHighs(candles: Candle[], window: number): { price: number; timestamp: string; index: number }[] {
  const swings: { price: number; timestamp: string; index: number }[] = [];
  const len = candles.length;

  for (let i = window; i < len - window; i++) {
    const currentHigh = candles[i].high;
    let isSwingHigh = true;

    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (candles[j].high >= currentHigh) {
        isSwingHigh = false;
        break;
      }
    }

    if (isSwingHigh) {
      swings.push({
        price: currentHigh,
        timestamp: candles[i].timestamp,
        index: i,
      });
    }
  }

  return swings;
}

function findSwingLows(candles: Candle[], window: number): { price: number; timestamp: string; index: number }[] {
  const swings: { price: number; timestamp: string; index: number }[] = [];
  const len = candles.length;

  for (let i = window; i < len - window; i++) {
    const currentLow = candles[i].low;
    let isSwingLow = true;

    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (candles[j].low <= currentLow) {
        isSwingLow = false;
        break;
      }
    }

    if (isSwingLow) {
      swings.push({
        price: currentLow,
        timestamp: candles[i].timestamp,
        index: i,
      });
    }
  }

  return swings;
}

function clusterAndScore(
  swings: { price: number; timestamp: string; index: number }[],
  type: 'support' | 'resistance',
  candles: Candle[]
): SupportResistanceLevel[] {
  if (swings.length === 0) return [];

  const sorted = [...swings].sort((a, b) => a.price - b.price);
  const zones: { price: number; zoneLow: number; zoneHigh: number; swings: typeof sorted }[] = [];

  const priceMin = sorted[0].price;
  const priceMax = sorted[sorted.length - 1].price;
  const priceRange = priceMax - priceMin || 0.0001;
  const tolerance = priceRange * ZONE_TOLERANCE_PERCENT;

  for (const swing of sorted) {
    const cluster = zones.find((z) => Math.abs(swing.price - z.price) <= tolerance);
    if (cluster) {
      cluster.swings.push(swing);
      cluster.price = cluster.swings.reduce((sum, s) => sum + s.price, 0) / cluster.swings.length;
      cluster.zoneLow = Math.min(...cluster.swings.map((s) => s.price));
      cluster.zoneHigh = Math.max(...cluster.swings.map((s) => s.price));
    } else {
      zones.push({
        price: swing.price,
        zoneLow: swing.price,
        zoneHigh: swing.price,
        swings: [swing],
      });
    }
  }

  for (const zone of zones) {
    const clusterRange = zone.zoneHigh - zone.zoneLow || 0.0001;
    const padding = Math.max(clusterRange * 0.1, tolerance * 0.5);
    zone.zoneLow = zone.zoneLow - padding;
    zone.zoneHigh = zone.zoneHigh + padding;
  }

  return zones
    .map((zone) => {
      const touches = zone.swings.length;
      const lastReactionTime = zone.swings.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp;
      const strength = calculateStrength(touches, lastReactionTime, candles);

      return {
        price: zone.price,
        zoneLow: zone.zoneLow,
        zoneHigh: zone.zoneHigh,
        type,
        strength,
        touches,
        lastReactionTime,
      } as SupportResistanceLevel;
    })
    .filter((level) => level.touches >= 1);
}

function pruneCloseLevels(levels: SupportResistanceLevel[]): SupportResistanceLevel[] {
  if (levels.length <= 1) return levels;

  const priceMin = Math.min(...levels.map((l) => l.price));
  const priceMax = Math.max(...levels.map((l) => l.price));
  const priceRange = priceMax - priceMin || 0.0001;
  const minDistance = priceRange * MIN_LEVEL_DISTANCE_PERCENT;

  const pruned: SupportResistanceLevel[] = [];

  for (const level of levels) {
    const tooClose = pruned.some((existing) => {
      const overlap = Math.min(existing.zoneHigh, level.zoneHigh) - Math.max(existing.zoneLow, level.zoneLow);
      return overlap > 0 || Math.abs(existing.price - level.price) < minDistance;
    });

    if (!tooClose) {
      pruned.push(level);
    }
  }

  return pruned;
}

function calculateStrength(touches: number, lastReactionTime: string, candles: Candle[]): number {
  let score = 0;

  score += Math.min(touches * 15, 45);

  const lastReactionDate = new Date(lastReactionTime).getTime();
  const lastCandleDate = new Date(candles[candles.length - 1].timestamp).getTime();
  const hoursSinceLastReaction = (lastCandleDate - lastReactionDate) / (1000 * 60 * 60);

  if (hoursSinceLastReaction < 24) {
    score += 25;
  } else if (hoursSinceLastReaction < 72) {
    score += 15;
  } else if (hoursSinceLastReaction < 168) {
    score += 5;
  }

  if (touches >= 3) {
    score += 15;
  } else if (touches >= 2) {
    score += 10;
  }

  if (touches >= 2 && hoursSinceLastReaction < 72) {
    score += 15;
  }

  return Math.min(Math.max(score, 1), 100);
}
