import { Candle } from '../../shared/types/market';
import {
  MarketStructureResult,
  MarketStructureResponse,
  SwingPoint,
  StructureEvent,
  StructureEventType,
  MarketStructureTrend,
} from '../../shared/types/marketStructure';

const DEFAULT_SWING_WINDOW = 2;

export function detectMarketStructure(
  candles: Candle[],
  swingWindow = DEFAULT_SWING_WINDOW
): MarketStructureResponse {
  if (candles.length < swingWindow * 2 + 1) {
    return {
      symbol: '',
      timeframe: '',
      structure: {
        trend: 'unclear',
        swingHighs: [],
        swingLows: [],
        events: [],
        lastSwingHigh: null,
        lastSwingLow: null,
        higherHighsCount: 0,
        higherLowsCount: 0,
        lowerHighsCount: 0,
        lowerLowsCount: 0,
      },
    };
  }

  const swingHighs = findSwingHighs(candles, swingWindow);
  const swingLows = findSwingLows(candles, swingWindow);

  const classifiedHighs = classifySwingHighs(swingHighs);
  const classifiedLows = classifySwingLows(swingLows);

  const trend = determineTrend(classifiedHighs, classifiedLows);

  const bosChochEvents = detectBosAndChoch(candles, swingHighs, swingLows, trend);

  const allEvents = [...classifiedHighs.events, ...classifiedLows.events, ...bosChochEvents];
  allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    symbol: '',
    timeframe: '',
    structure: {
      trend,
      swingHighs,
      swingLows,
      events: allEvents,
      lastSwingHigh: swingHighs.length > 0 ? swingHighs[swingHighs.length - 1] : null,
      lastSwingLow: swingLows.length > 0 ? swingLows[swingLows.length - 1] : null,
      higherHighsCount: classifiedHighs.higherHighsCount,
      higherLowsCount: classifiedLows.higherLowsCount,
      lowerHighsCount: classifiedHighs.lowerHighsCount,
      lowerLowsCount: classifiedLows.lowerLowsCount,
    },
  };
}

export function detectStructureEvents(
  candles: Candle[],
  swingWindow = DEFAULT_SWING_WINDOW
): StructureEvent[] {
  const result = detectMarketStructure(candles, swingWindow);
  return result.structure.events;
}

function findSwingHighs(candles: Candle[], window: number): SwingPoint[] {
  const swings: SwingPoint[] = [];
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
        type: 'high',
        timestamp: candles[i].timestamp,
        price: currentHigh,
        index: i,
      });
    }
  }

  return swings;
}

function findSwingLows(candles: Candle[], window: number): SwingPoint[] {
  const swings: SwingPoint[] = [];
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
        type: 'low',
        timestamp: candles[i].timestamp,
        price: currentLow,
        index: i,
      });
    }
  }

  return swings;
}

function classifySwingHighs(swingHighs: SwingPoint[]): {
  events: StructureEvent[];
  higherHighsCount: number;
  lowerHighsCount: number;
} {
  const events: StructureEvent[] = [];
  let higherHighsCount = 0;
  let lowerHighsCount = 0;

  if (swingHighs.length < 2) {
    return { events, higherHighsCount, lowerHighsCount };
  }

  for (let i = 1; i < swingHighs.length; i++) {
    const prev = swingHighs[i - 1];
    const curr = swingHighs[i];

    if (curr.price > prev.price) {
      higherHighsCount++;
      events.push({
        type: 'higher_high',
        timestamp: curr.timestamp,
        price: curr.price,
        description: `Higher High at ${curr.price} (previous: ${prev.price})`,
      });
    } else if (curr.price < prev.price) {
      lowerHighsCount++;
      events.push({
        type: 'lower_high',
        timestamp: curr.timestamp,
        price: curr.price,
        description: `Lower High at ${curr.price} (previous: ${prev.price})`,
      });
    }
  }

  return { events, higherHighsCount, lowerHighsCount };
}

function classifySwingLows(swingLows: SwingPoint[]): {
  events: StructureEvent[];
  higherLowsCount: number;
  lowerLowsCount: number;
} {
  const events: StructureEvent[] = [];
  let higherLowsCount = 0;
  let lowerLowsCount = 0;

  if (swingLows.length < 2) {
    return { events, higherLowsCount, lowerLowsCount };
  }

  for (let i = 1; i < swingLows.length; i++) {
    const prev = swingLows[i - 1];
    const curr = swingLows[i];

    if (curr.price > prev.price) {
      higherLowsCount++;
      events.push({
        type: 'higher_low',
        timestamp: curr.timestamp,
        price: curr.price,
        description: `Higher Low at ${curr.price} (previous: ${prev.price})`,
      });
    } else if (curr.price < prev.price) {
      lowerLowsCount++;
      events.push({
        type: 'lower_low',
        timestamp: curr.timestamp,
        price: curr.price,
        description: `Lower Low at ${curr.price} (previous: ${prev.price})`,
      });
    }
  }

  return { events, higherLowsCount, lowerLowsCount };
}

function determineTrend(
  classifiedHighs: { higherHighsCount: number; lowerHighsCount: number },
  classifiedLows: { higherLowsCount: number; lowerLowsCount: number }
): MarketStructureTrend {
  const bullish =
    classifiedHighs.higherHighsCount > classifiedHighs.lowerHighsCount &&
    classifiedLows.higherLowsCount > classifiedLows.lowerLowsCount;

  const bearish =
    classifiedHighs.lowerHighsCount > classifiedHighs.higherHighsCount &&
    classifiedLows.lowerLowsCount > classifiedLows.higherLowsCount;

  if (bullish) return 'bullish';
  if (bearish) return 'bearish';
  if (
    classifiedHighs.higherHighsCount > 0 ||
    classifiedHighs.lowerHighsCount > 0 ||
    classifiedLows.higherLowsCount > 0 ||
    classifiedLows.lowerLowsCount > 0
  ) {
    return 'range';
  }
  return 'unclear';
}

function detectBosAndChoch(
  candles: Candle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  trend: MarketStructureTrend
): StructureEvent[] {
  const events: StructureEvent[] = [];
  const lastCandle = candles[candles.length - 1];
  const lastClose = lastCandle.close;

  if (trend === 'unclear' || trend === 'range') {
    return events;
  }

  const lastHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1] : null;
  const lastLow = swingLows.length > 0 ? swingLows[swingLows.length - 1] : null;

  if (trend === 'bullish') {
    if (lastHigh && lastClose > lastHigh.price) {
      events.push({
        type: 'break_of_structure',
        timestamp: lastCandle.timestamp,
        price: lastClose,
        description: `Bullish Break of Structure: close ${lastClose} above recent swing high ${lastHigh.price}`,
      });
    }
    if (lastLow && lastClose < lastLow.price) {
      events.push({
        type: 'change_of_character',
        timestamp: lastCandle.timestamp,
        price: lastClose,
        description: `Bullish Change of Character: close ${lastClose} below recent swing low ${lastLow.price}`,
      });
    }
  }

  if (trend === 'bearish') {
    if (lastLow && lastClose < lastLow.price) {
      events.push({
        type: 'break_of_structure',
        timestamp: lastCandle.timestamp,
        price: lastClose,
        description: `Bearish Break of Structure: close ${lastClose} below recent swing low ${lastLow.price}`,
      });
    }
    if (lastHigh && lastClose > lastHigh.price) {
      events.push({
        type: 'change_of_character',
        timestamp: lastCandle.timestamp,
        price: lastClose,
        description: `Bearish Change of Character: close ${lastClose} above recent swing high ${lastHigh.price}`,
      });
    }
  }

  return events;
}
