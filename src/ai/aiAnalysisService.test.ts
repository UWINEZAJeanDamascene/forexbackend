import { describe, expect, it, vi } from 'vitest';
import { AnalysisContext } from '../../../shared/types/aiAnalysis';
import { AiAnalysisService } from './aiAnalysisService';
import { AiProvider } from './aiProvider';

function context(): AnalysisContext {
  return {
    identity: {
      symbol: 'EUR/USD', timeframe: '1H', currentPrice: 1.16, latestCandleAt: null,
      latestCandleClosed: true, candleStatus: 'fresh', candleAgeMs: 0, provider: 'test', fallbackUsed: false,
    },
    marketBias: { analysis: {} as AnalysisContext['marketBias']['analysis'], impulse: 'flat' },
    momentum: {} as AnalysisContext['momentum'],
    marketStructure: {} as AnalysisContext['marketStructure'],
    supportResistance: [], volatility: {} as AnalysisContext['volatility'],
    multiTimeframe: {} as AnalysisContext['multiTimeframe'],
    evidenceAgreement: {} as AnalysisContext['evidenceAgreement'], setups: [],
    tradeQuality: { verdict: 'wait', reasons: ['neutral trend'] },
    risk: { nearbySupport: null, nearbyResistance: null, atr: 0.001, invalidationCandidates: [], riskRewardScenarios: [] },
  };
}

function validJson(extra: Partial<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    summary: 'Technical conditions currently show a cautious neutral context; wait for confirmation.',
    trend: 'Neutral trend with weak directional agreement.',
    momentum: 'Momentum is neutral and does not confirm a directional move.',
    marketStructure: 'Structure is mixed and should be treated cautiously.',
    keyLevels: ['Support and resistance are supplied by the deterministic analysis.'],
    bullishScenario: 'One possible scenario is a bullish continuation after confirmation.',
    bearishScenario: 'One possible scenario is a bearish move after confirmation.',
    confirmationNeeded: ['Confirmation would strengthen this interpretation.'],
    invalidationConditions: ['Use the deterministic invalidation levels for each scenario.'],
    riskFactors: ['The Trade Quality verdict is WAIT because evidence is not aligned.'],
    confidence: 0,
    ...extra,
  });
}

describe('AiAnalysisService', () => {
  it('falls back to the secondary provider and caches unchanged context', async () => {
    const primary: AiProvider = { name: 'primary', generate: vi.fn().mockRejectedValue(new Error('down')) };
    const fallback: AiProvider = { name: 'fallback', generate: vi.fn().mockResolvedValue(validJson()) };
    const service = new AiAnalysisService([primary, fallback]);

    const first = await service.explain(context());
    const second = await service.explain(context());

    expect(first.available).toBe(true);
    expect(first.provider).toBe('fallback');
    expect(second.cached).toBe(true);
    expect(fallback.generate).toHaveBeenCalledTimes(1);
  });

  it('returns a richer deterministic fallback when providers fail', async () => {
    const provider: AiProvider = { name: 'test', generate: vi.fn().mockResolvedValue(validJson({ summary: 'Guaranteed profit.' })) };
    const service = new AiAnalysisService([provider]);

    const result = await service.explain(context());

    expect(result.available).toBe(false);
    expect(result.structured?.summary).toMatch(/WAIT|Trade Quality/i);
    expect(result.structured?.confirmationNeeded[0]).toMatch(/WAIT/i);
    expect(provider.generate).toHaveBeenCalledTimes(2);
  });

  it('keeps the cache key stable when only volatile timestamps change', async () => {
    const provider: AiProvider = { name: 'test', generate: vi.fn().mockResolvedValue(validJson()) };
    const service = new AiAnalysisService([provider]);
    const firstContext = context();
    const secondContext = context();
    secondContext.identity.candleAgeMs = 30_000;
    secondContext.marketBias.analysis.analyzedAt = new Date(Date.now() + 60_000).toISOString();

    await service.explain(firstContext);
    const cached = await service.explain(secondContext);

    expect(cached.cached).toBe(true);
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });
});
