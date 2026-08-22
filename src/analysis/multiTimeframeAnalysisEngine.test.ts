import { describe, it, expect, vi, afterEach } from 'vitest';
import { Candle } from '../../shared/types/market';
import {
  analyzeMultiTimeframe,
  TIMEFRAME_HIERARCHY,
  classifyAlignment,
  detectPattern,
  generateExplanation,
  BANNED_WORDS,
  clearMultiTimeframeCache,
} from './multiTimeframeAnalysisEngine';
import { Symbol, Timeframe, ENABLED_TIMEFRAMES } from '../../../shared/constants/instruments';

vi.mock('./trendAnalysisService', () => ({
  getTrendAnalysis: vi.fn(),
  clearTrendAnalysisCache: vi.fn(),
}));

import { getTrendAnalysis, clearTrendAnalysisCache } from './trendAnalysisService';

const mockedGetTrendAnalysis = vi.mocked(getTrendAnalysis);
const mockedClearTrendAnalysisCache = vi.mocked(clearTrendAnalysisCache);

function makeTrendResponse(trend: 'bullish' | 'bearish' | 'neutral', score: number) {
  return {
    symbol: 'EUR/USD',
    timeframe: '1H',
    trend: {
      trend,
      strength: 'moderate' as const,
      score,
      factors: {
        emaAlignment: { direction: trend as 'bullish' | 'bearish' | 'neutral', score: score / 4, explanation: '' },
        marketStructure: { direction: trend as 'bullish' | 'bearish' | 'neutral', score: score / 4, explanation: '' },
        priceVsEma: { direction: trend as 'bullish' | 'bearish' | 'neutral', score: score / 4, explanation: '' },
        recentHighsLows: { direction: trend as 'bullish' | 'bearish' | 'neutral', score: score / 4, explanation: '' },
      },
      currentPrice: 1.16,
      ema: { ema20: 1.16, ema50: 1.15, ema200: 1.14 },
      analyzedAt: new Date().toISOString(),
    },
  };
}

afterEach(() => {
  clearMultiTimeframeCache();
  mockedClearTrendAnalysisCache.mockClear();
  mockedGetTrendAnalysis.mockClear();
});

describe('TIMEFRAME_HIERARCHY', () => {
  it('has correct pairings for every enabled timeframe', () => {
    expect(TIMEFRAME_HIERARCHY['5m']).toEqual({ higher: '1H', lower: null });
    expect(TIMEFRAME_HIERARCHY['15m']).toEqual({ higher: '4H', lower: '5m' });
    expect(TIMEFRAME_HIERARCHY['30m']).toEqual({ higher: '4H', lower: '15m' });
    expect(TIMEFRAME_HIERARCHY['1H']).toEqual({ higher: '4H', lower: '15m' });
    expect(TIMEFRAME_HIERARCHY['4H']).toEqual({ higher: '1D', lower: '1H' });
    expect(TIMEFRAME_HIERARCHY['1D']).toEqual({ higher: null, lower: '4H' });
  });

  it('handles 5m having no lower timeframe', () => {
    expect(TIMEFRAME_HIERARCHY['5m'].lower).toBeNull();
  });

  it('handles 1D having no higher timeframe', () => {
    expect(TIMEFRAME_HIERARCHY['1D'].higher).toBeNull();
  });
});

describe('classifyAlignment', () => {
  it('returns aligned_bullish when higher and analysis are bullish', () => {
    const higher = { timeframe: '4H' as Timeframe, trend: 'bullish' as const, score: 72, strength: 'strong' as const, status: 'ok' as const };
    const analysis = { timeframe: '1H' as Timeframe, trend: 'bullish' as const, score: 58, strength: 'moderate' as const, status: 'ok' as const };
    expect(classifyAlignment(higher, analysis)).toBe('aligned_bullish');
  });

  it('returns aligned_bearish when higher and analysis are bearish', () => {
    const higher = { timeframe: '4H' as Timeframe, trend: 'bearish' as const, score: -72, strength: 'strong' as const, status: 'ok' as const };
    const analysis = { timeframe: '1H' as Timeframe, trend: 'bearish' as const, score: -58, strength: 'moderate' as const, status: 'ok' as const };
    expect(classifyAlignment(higher, analysis)).toBe('aligned_bearish');
  });

  it('returns mixed when higher and analysis disagree', () => {
    const higher = { timeframe: '4H' as Timeframe, trend: 'bullish' as const, score: 72, strength: 'strong' as const, status: 'ok' as const };
    const analysis = { timeframe: '1H' as Timeframe, trend: 'bearish' as const, score: -58, strength: 'moderate' as const, status: 'ok' as const };
    expect(classifyAlignment(higher, analysis)).toBe('mixed');
  });

  it('returns insufficient_data when analysis timeframe has error status', () => {
    const higher = { timeframe: '4H' as Timeframe, trend: 'bullish' as const, score: 72, strength: 'strong' as const, status: 'ok' as const };
    const analysis = { timeframe: '1H' as Timeframe, trend: 'neutral' as const, score: 0, strength: 'weak' as const, status: 'insufficient_data' as const, errorReason: 'Not enough candles' };
    expect(classifyAlignment(higher, analysis)).toBe('insufficient_data');
  });
});

describe('detectPattern', () => {
  it('detects possible pullback within an uptrend', () => {
    const higher = { timeframe: '4H' as Timeframe, trend: 'bullish' as const, score: 72, strength: 'strong' as const, status: 'ok' as const };
    const analysis = { timeframe: '1H' as Timeframe, trend: 'bullish' as const, score: 58, strength: 'moderate' as const, status: 'ok' as const };
    const lower = { timeframe: '15m' as Timeframe, trend: 'bearish' as const, score: -30, strength: 'weak' as const, status: 'ok' as const };
    expect(detectPattern(higher, analysis, lower)).toBe('possible pullback within an uptrend');
  });

  it('detects possible bounce within a downtrend', () => {
    const higher = { timeframe: '4H' as Timeframe, trend: 'bearish' as const, score: -72, strength: 'strong' as const, status: 'ok' as const };
    const analysis = { timeframe: '1H' as Timeframe, trend: 'bearish' as const, score: -58, strength: 'moderate' as const, status: 'ok' as const };
    const lower = { timeframe: '15m' as Timeframe, trend: 'bullish' as const, score: 30, strength: 'weak' as const, status: 'ok' as const };
    expect(detectPattern(higher, analysis, lower)).toBe('possible bounce within a downtrend');
  });

  it('detects conflicting higher and analysis timeframe trends', () => {
    const higher = { timeframe: '4H' as Timeframe, trend: 'bullish' as const, score: 72, strength: 'strong' as const, status: 'ok' as const };
    const analysis = { timeframe: '1H' as Timeframe, trend: 'bearish' as const, score: -58, strength: 'moderate' as const, status: 'ok' as const };
    const lower = { timeframe: '15m' as Timeframe, trend: 'bullish' as const, score: 30, strength: 'weak' as const, status: 'ok' as const };
    expect(detectPattern(higher, analysis, lower)).toBe('conflicting higher and analysis timeframe trends');
  });

  it('returns null when fully aligned across all three', () => {
    const higher = { timeframe: '4H' as Timeframe, trend: 'bullish' as const, score: 72, strength: 'strong' as const, status: 'ok' as const };
    const analysis = { timeframe: '1H' as Timeframe, trend: 'bullish' as const, score: 58, strength: 'moderate' as const, status: 'ok' as const };
    const lower = { timeframe: '15m' as Timeframe, trend: 'bullish' as const, score: 45, strength: 'moderate' as const, status: 'ok' as const };
    expect(detectPattern(higher, analysis, lower)).toBeNull();
  });

  it('returns null when higher or lower is missing', () => {
    const analysis = { timeframe: '1H' as Timeframe, trend: 'bullish' as const, score: 58, strength: 'moderate' as const, status: 'ok' as const };
    expect(detectPattern(null, analysis, null)).toBeNull();
  });
});

describe('generateExplanation', () => {
  it('includes pattern when detected', () => {
    const higher = { timeframe: '4H' as Timeframe, trend: 'bullish' as const, score: 72, strength: 'strong' as const, status: 'ok' as const };
    const analysis = { timeframe: '1H' as Timeframe, trend: 'bullish' as const, score: 58, strength: 'moderate' as const, status: 'ok' as const };
    const lower = { timeframe: '15m' as Timeframe, trend: 'bearish' as const, score: -30, strength: 'weak' as const, status: 'ok' as const };
    const text = generateExplanation('aligned_bullish', higher, analysis, lower, 'possible pullback within an uptrend');
    expect(text).toContain('possible pullback within an uptrend');
    expect(text).toContain('not a trading signal');
  });

  it('reports insufficient data with reasons', () => {
    const analysis = { timeframe: '1H' as Timeframe, trend: 'neutral' as const, score: 0, strength: 'weak' as const, status: 'insufficient_data' as const, errorReason: 'Only 3 candles available' };
    const text = generateExplanation('insufficient_data', null, analysis, null, null);
    expect(text).toContain('Insufficient data');
    expect(text).toContain('1H timeframe: Only 3 candles available');
  });
});

describe('BANNED_WORDS', () => {
  it('rejects explanations containing prohibited trade-instruction language', () => {
    const text = 'Possible pullback. Buy the dip here.';
    expect(BANNED_WORDS.test(text)).toBe(true);
  });

  it('allows descriptive explanations without trade-instruction language', () => {
    const text = 'Possible pullback within an uptrend. This is a description of current conditions, not a trading signal.';
    expect(BANNED_WORDS.test(text)).toBe(false);
  });
});

describe('analyzeMultiTimeframe', () => {
  it('returns aligned_bullish with pullback pattern for bullish/bullish/bearish', async () => {
    mockedGetTrendAnalysis
      .mockReturnValueOnce(makeTrendResponse('bullish', 72))
      .mockReturnValueOnce(makeTrendResponse('bullish', 72))
      .mockReturnValueOnce(makeTrendResponse('bearish', -30));

    const result = await analyzeMultiTimeframe('EUR/USD', '1H');

    expect(result.alignment).toBe('aligned_bullish');
    expect(result.possiblePattern).toBe('possible pullback within an uptrend');
    expect(result.higherTimeframe?.trend).toBe('bullish');
    expect(result.analysis.trend).toBe('bullish');
    expect(result.lowerTimeframe?.trend).toBe('bearish');
  });

  it('returns aligned_neutral when all available timeframes are neutral', async () => {
    mockedGetTrendAnalysis
      .mockReturnValueOnce(makeTrendResponse('neutral', 0))
      .mockReturnValueOnce(makeTrendResponse('neutral', 22))
      .mockReturnValueOnce(makeTrendResponse('neutral', 16));

    const result = await analyzeMultiTimeframe('EUR/USD', '1H');

    expect(result.alignment).toBe('aligned_neutral');
  });

  it('returns insufficient_data when one timeframe fetch fails', async () => {
    mockedGetTrendAnalysis.mockRejectedValue(new Error('Provider error'));

    const result = await analyzeMultiTimeframe('EUR/USD', '1H');

    const failed = [result.higherTimeframe, result.analysis, result.lowerTimeframe].filter((s) => s?.status !== 'ok');
    expect(failed.length).toBeGreaterThanOrEqual(1);
    expect(result.alignment).toBe('insufficient_data');
  });

  it('shares cached trend results across repeated calls', async () => {
    clearMultiTimeframeCache();
    mockedClearTrendAnalysisCache.mockClear();

    mockedGetTrendAnalysis
      .mockReturnValueOnce(makeTrendResponse('bullish', 72))
      .mockReturnValueOnce(makeTrendResponse('bullish', 72))
      .mockReturnValueOnce(makeTrendResponse('bearish', -30));

    await analyzeMultiTimeframe('EUR/USD', '1H');
    await analyzeMultiTimeframe('EUR/USD', '1H');

    expect(mockedGetTrendAnalysis).toHaveBeenCalledTimes(3);
    expect(mockedClearTrendAnalysisCache).not.toHaveBeenCalled();
  });

  it('returns one canonical five-timeframe stack when requested', async () => {
    mockedGetTrendAnalysis
      .mockReturnValueOnce(makeTrendResponse('bearish', -17))
      .mockReturnValueOnce(makeTrendResponse('neutral', -15))
      .mockReturnValueOnce(makeTrendResponse('neutral', -1))
      .mockReturnValueOnce(makeTrendResponse('neutral', 28))
      .mockReturnValueOnce(makeTrendResponse('neutral', 27));

    const result = await analyzeMultiTimeframe('EUR/USD', '1H', true);

    expect(result.timeframeStack?.map((snapshot) => snapshot.timeframe)).toEqual(['1D', '4H', '1H', '15m', '5m']);
    expect(result.timeframeStack?.every((snapshot) => snapshot.status === 'ok')).toBe(true);
    expect(result.scoreRange).toEqual([-17, 28]);
    expect(result.snapshotAt).toEqual(expect.any(String));
    expect(result.timeframeStack?.every((snapshot) => snapshot.analyzedAt)).toBe(true);
  });

  it('includes zero-valued successful timeframes in the score spread', async () => {
    mockedGetTrendAnalysis
      .mockReturnValueOnce(makeTrendResponse('neutral', 0))
      .mockReturnValueOnce(makeTrendResponse('neutral', 31))
      .mockReturnValueOnce(makeTrendResponse('neutral', 19))
      .mockReturnValueOnce(makeTrendResponse('neutral', 0))
      .mockReturnValueOnce(makeTrendResponse('neutral', 0));

    const result = await analyzeMultiTimeframe('EUR/USD', '1H', true);

    expect(result.timeframeStack?.map((snapshot) => snapshot.score)).toEqual([0, 0, 31, 19, 0]);
    expect(result.scoreRange).toEqual([0, 31]);
  });
});
