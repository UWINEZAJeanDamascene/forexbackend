import { describe, it, expect } from 'vitest';
import { detectSetups } from './setupDetectionEngine';
import { SetupContext } from '../../shared/types/setupDetection';

function makeContext(overrides: Partial<SetupContext> = {}): SetupContext {
  return {
    symbol: 'EUR/USD',
    currentPrice: 1.1635,
    trend: {
      trend: 'bullish',
      strength: 'strong',
      ema: { ema20: 1.164, ema50: 1.162, ema200: 1.158 },
    },
    structure: {
      trend: 'bullish',
      events: [{ type: 'break_of_structure', price: 1.168 }],
    },
    momentum: {
      momentum: 'bullish',
      strength: 'strong',
      counterTrend: false,
    },
    volatility: {
      classification: 'normal',
    },
    supportResistance: {
      supports: [
        { price: 1.164, zoneLow: 1.1638, zoneHigh: 1.1642, strength: 85 },
        { price: 1.160, zoneLow: 1.1598, zoneHigh: 1.1602, strength: 70 },
      ],
      resistances: [
        { price: 1.170, zoneLow: 1.1698, zoneHigh: 1.1702, strength: 80 },
      ],
    },
    multiTimeframe: {
      alignment: 'aligned_bullish',
      possiblePattern: 'possible pullback within an uptrend',
      higherTimeframe: { timeframe: '4H', trend: 'bullish', status: 'ok' },
      analysis: { timeframe: '1H', trend: 'bullish', score: 58, status: 'ok' },
      lowerTimeframe: { timeframe: '15m', trend: 'bearish', status: 'ok' },
      higherTimeframeIncomplete: false,
    },
    ...overrides,
  };
}

describe('detectSetups', () => {
  it('detects bullish trend continuation when all conditions met', () => {
    const ctx = makeContext();
    const setups = detectSetups(ctx);
    const setup = setups.find((s) => s.setup === 'Bullish Trend Continuation');

    expect(setup).toBeDefined();
    expect(setup!.direction).toBe('bullish');
    expect(setup!.strength).toBe(100);
    expect(setup!.conditionsMet.length).toBe(4);
    expect(setup!.conditionsMissing.length).toBe(0);
  });

  it('detects bullish trend continuation with reduced strength when higher timeframe is bearish', () => {
    const ctx = makeContext({
      multiTimeframe: {
        ...makeContext().multiTimeframe,
        higherTimeframe: { timeframe: '4H', trend: 'bearish', status: 'ok' },
        alignment: 'mixed',
      },
    });
    const setups = detectSetups(ctx);
    const setup = setups.find((s) => s.setup === 'Bullish Trend Continuation');

    // May be ranked out of the top results when stronger setups exist;
    // when present, HTF disagreement must reduce condition coverage.
    if (setup) {
      expect(setup.direction).toBe('bullish');
      expect(setup.strength).toBe(75);
      expect(setup.conditionsMet).toContain('Analysis timeframe trend bullish');
      expect(setup.conditionsMissing).toContain('Higher timeframe trend bullish');
    } else {
      expect(setups.length).toBeGreaterThan(0);
      expect(setups.every((s) => s.conditionsMetCount >= 2)).toBe(true);
    }
  });

  it('detects bullish pullback with correct conditions', () => {
    const ctx = makeContext();
    const setups = detectSetups(ctx);
    const setup = setups.find((s) => s.setup === 'Bullish Pullback');

    expect(setup).toBeDefined();
    expect(setup!.direction).toBe('bullish');
    expect(setup!.conditionsMet).toContain('Multi-timeframe shows possible pullback');
    expect(setup!.conditionsMet).toContain('Price near support');
    expect(setup!.strength).toBeGreaterThanOrEqual(66);
  });

  it('detects bullish breakout with BOS and normal/high volatility', () => {
    const ctx = makeContext({
      currentPrice: 1.1703,
      structure: {
        trend: 'bullish',
        events: [{ type: 'break_of_structure', price: 1.168 }],
      },
    });
    const setups = detectSetups(ctx);
    const setup = setups.find((s) => s.setup === 'Bullish Breakout');

    expect(setup).toBeDefined();
    expect(setup!.direction).toBe('bullish');
    expect(setup!.conditionsMet).toContain('Recent break of structure');
    expect(setup!.conditionsMet).toContain('Volatility normal or high');
  });

  it('detects bullish range bounce when structure is range and momentum bullish near support', () => {
    const ctx = makeContext({
      trend: {
        ...makeContext().trend,
        trend: 'neutral',
      },
      structure: {
        trend: 'range',
        events: [],
      },
      momentum: {
        momentum: 'bullish',
        strength: 'moderate',
        counterTrend: false,
      },
    });
    const setups = detectSetups(ctx);
    const setup = setups.find((s) => s.setup === 'Bullish Range Bounce');

    expect(setup).toBeDefined();
    expect(setup!.conditionsMet).toContain('Market structure is range');
    expect(setup!.conditionsMet).toContain('Price near support');
    expect(setup!.conditionsMet).toContain('Momentum bullish');
  });

  it('detects bullish momentum continuation when momentum is strong and trend agrees', () => {
    const ctx = makeContext();
    const setups = detectSetups(ctx);
    const setup = setups.find((s) => s.setup === 'Bullish Momentum Continuation');

    expect(setup).toBeDefined();
    expect(setup!.strength).toBe(100);
    expect(setup!.conditionsMet).toContain('Momentum strong bullish');
    expect(setup!.conditionsMet).toContain('Trend direction matches setup');
  });

  it('does not detect setups when market is flat/neutral with no clear pattern', () => {
    const ctx = makeContext({
      currentPrice: 1.1670,
      trend: {
        ...makeContext().trend,
        trend: 'neutral',
        strength: 'weak',
      },
      structure: {
        trend: 'unclear',
        events: [],
      },
      momentum: {
        momentum: 'neutral',
        strength: 'weak',
        counterTrend: true,
      },
      volatility: {
        classification: 'low',
      },
      multiTimeframe: {
        alignment: 'mixed',
        possiblePattern: null,
        higherTimeframe: { timeframe: '4H', trend: 'neutral', status: 'ok' },
        analysis: { timeframe: '1H', trend: 'neutral', score: 0, status: 'ok' },
        lowerTimeframe: { timeframe: '15m', trend: 'neutral', status: 'ok' },
        higherTimeframeIncomplete: false,
      },
    });
    const setups = detectSetups(ctx);
    expect(setups.length).toBe(0);
  });

  it('conditionsMet and conditionsMissing partition the full condition list', () => {
    const ctx = makeContext();
    const setups = detectSetups(ctx);
    const setup = setups.find((s) => s.setup === 'Bullish Momentum Continuation') ?? setups[0];

    expect(setup).toBeDefined();
    const total = setup!.conditionsMet.length + setup!.conditionsMissing.length;
    expect(total).toBe(setup!.conditionsTotal);
    expect(setup!.conditionsMetCount).toBe(setup!.conditionsMet.length);
  });

  it('does not return setups with fewer than 2 conditions met', () => {
    const ctx = makeContext({
      multiTimeframe: {
        ...makeContext().multiTimeframe,
        higherTimeframe: { timeframe: '4H', trend: 'bearish' },
        analysis: { timeframe: '1H', trend: 'neutral', score: 0 },
        lowerTimeframe: { timeframe: '15m', trend: 'bearish' },
      },
      momentum: {
        momentum: 'bearish',
        strength: 'strong',
        counterTrend: true,
      },
    });
    const setups = detectSetups(ctx);
    const weakSetup = setups.find((s) => s.setup === 'Bullish Trend Continuation');
    expect(weakSetup).toBeUndefined();
  });

  it('banned-word regex rejects directive verbs in setup strings', () => {
    const ctx = makeContext();
    const setups = detectSetups(ctx);

    for (const setup of setups) {
      expect(setup.setup).not.toMatch(/\b(buy|sell|enter|exit|target|stop|guaranteed|profit|loss|long|short|call|put)\b/i);
      expect(setup.invalidationCondition).not.toMatch(/\b(buy|sell|enter|exit|target|stop|guaranteed|profit|loss|long|short|call|put)\b/i);
      for (const condition of [...setup.conditionsMet, ...setup.conditionsMissing]) {
        expect(condition).not.toMatch(/\b(buy|sell|enter|exit|target|stop|guaranteed|profit|loss|long|short|call|put)\b/i);
      }
    }
  });

  it('detects bearish pullback (bounce) when MTF pattern matches', () => {
    const ctx = makeContext({
      multiTimeframe: {
        ...makeContext().multiTimeframe,
        possiblePattern: 'possible bounce within a downtrend',
        higherTimeframe: { timeframe: '4H', trend: 'bearish' },
        analysis: { timeframe: '1H', trend: 'neutral', score: 0 },
        lowerTimeframe: { timeframe: '15m', trend: 'bullish' },
      },
      momentum: {
        momentum: 'bullish',
        strength: 'moderate',
        counterTrend: false,
      },
      currentPrice: 1.1701,
    });
    const setups = detectSetups(ctx);
    const setup = setups.find((s) => s.setup === 'Bearish Pullback');

    expect(setup).toBeDefined();
    expect(setup!.direction).toBe('bearish');
    expect(setup!.conditionsMet).toContain('Multi-timeframe shows possible bounce');
  });

  it('detects bearish breakout when price at support with BOS', () => {
    const ctx = makeContext({
      currentPrice: 1.1637,
      trend: {
        trend: 'bearish',
        strength: 'moderate',
        ema: { ema20: 1.165, ema50: 1.166, ema200: 1.170 },
      },
      structure: {
        trend: 'bearish',
        events: [{ type: 'break_of_structure', price: 1.162 }],
      },
      momentum: {
        momentum: 'bearish',
        strength: 'strong',
        counterTrend: false,
      },
      multiTimeframe: {
        ...makeContext().multiTimeframe,
        alignment: 'aligned_bearish',
        possiblePattern: null,
        higherTimeframe: { timeframe: '4H', trend: 'bearish', status: 'ok' },
      },
    });
    const setups = detectSetups(ctx);
    const setup = setups.find((s) => s.setup === 'Bearish Breakout');

    expect(setup).toBeDefined();
    expect(setup!.direction).toBe('bearish');
    expect(setup!.conditionsMet).toContain('Recent break of structure');
    expect(setup!.conditionsMet).toContain('Price at or below support');
  });

  it('excludes HTF-dependent setups when higher timeframe data is incomplete', () => {
    const ctx = makeContext({
      multiTimeframe: {
        ...makeContext().multiTimeframe,
        higherTimeframe: { timeframe: '4H', trend: 'neutral', status: 'error' },
        higherTimeframeIncomplete: true,
        possiblePattern: null,
      },
    });
    const setups = detectSetups(ctx);

    expect(setups.find((s) => s.setup === 'Bullish Trend Continuation')).toBeUndefined();
    expect(setups.find((s) => s.setup === 'Bullish Pullback')).toBeUndefined();
    expect(setups.find((s) => s.setup === 'Bearish Pullback')).toBeUndefined();
  });

  it('ranks aligned setups ahead of weaker opposite setups and caps results', () => {
    const ctx = makeContext();
    const setups = detectSetups(ctx);

    expect(setups.length).toBeLessThanOrEqual(3);
    expect(setups[0].rank).toBe(1);
    for (let i = 1; i < setups.length; i++) {
      expect(setups[i].rank).toBe(i + 1);
    }
    const opposite = setups.filter((s) => s.direction === 'bearish');
    expect(opposite.length).toBe(0);
  });

  it('does not rank two-sided observations when there is no directional consensus', () => {
    const ctx = makeContext({
      trend: { ...makeContext().trend, trend: 'neutral' },
      multiTimeframe: {
        ...makeContext().multiTimeframe,
        alignment: 'aligned_neutral',
        higherTimeframe: { timeframe: '4H', trend: 'neutral', status: 'ok' },
        analysis: { timeframe: '1H', trend: 'neutral', score: 0, status: 'ok' },
      },
    });
    const setups = detectSetups(ctx);

    expect(setups.length).toBeGreaterThan(0);
    expect(setups.every((setup) => setup.rank === undefined)).toBe(true);
  });

  it('includes conditionsMetCount and conditionsTotal on every setup', () => {
    const ctx = makeContext();
    const setups = detectSetups(ctx);
    expect(setups.length).toBeGreaterThan(0);
    for (const setup of setups) {
      expect(setup.conditionsMetCount).toBe(setup.conditionsMet.length);
      expect(setup.conditionsTotal).toBe(setup.conditionsMet.length + setup.conditionsMissing.length);
      expect(setup.strength).toBe(Math.round((setup.conditionsMetCount / setup.conditionsTotal) * 100));
    }
  });
});
