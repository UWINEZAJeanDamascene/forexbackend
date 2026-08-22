import { describe, expect, it, vi } from 'vitest';
import { buildAnalysisContext } from './analysisContextService';

vi.mock('../services/marketDataService', () => ({
  getValidatedCandles: vi.fn().mockResolvedValue({
    candles: [{ timestamp: new Date().toISOString(), close: 1.16 }],
    analysisCandles: [{ timestamp: new Date().toISOString(), close: 1.16 }],
    provider: 'test-provider', fallbackUsed: false,
  }),
}));
vi.mock('./trendAnalysisService', () => ({ getTrendAnalysis: vi.fn().mockResolvedValue({ trend: { currentPrice: 1.16, trend: 'neutral', score: 0, strength: 'weak', factors: {}, ema: {}, analyzedAt: new Date().toISOString() } }) }));
vi.mock('./marketStructureService', () => ({ getMarketStructure: vi.fn().mockReturnValue({ structure: { trend: 'range', swingHighs: [], swingLows: [], events: [], candlestickPatterns: [] } }) }));
vi.mock('./supportResistanceService', () => ({ getSupportResistance: vi.fn().mockReturnValue({ supports: [], resistances: [], tested: [] }) }));
vi.mock('./momentumAnalysisService', () => ({ getMomentumAnalysis: vi.fn().mockResolvedValue({ momentum: { score: 0, components: { macd: { explanation: 'flat' } } } }) }));
vi.mock('./volatilityAnalysisService', () => ({ getVolatilityAnalysis: vi.fn().mockResolvedValue({ volatility: { currentAtr: 0.001 } }) }));
vi.mock('./multiTimeframeAnalysisService', () => ({ getMultiTimeframeAnalysis: vi.fn().mockResolvedValue({ multiTimeframe: { alignment: 'aligned_neutral' } }) }));
vi.mock('./setupDetectionService', () => ({ getSetupDetection: vi.fn().mockResolvedValue({ setups: [] }) }));
vi.mock('./confidenceAnalysisService', () => ({ getConfidenceAnalysis: vi.fn().mockResolvedValue({ confidence: { overallScore: 20 } }) }));
vi.mock('./riskAnalysisService', () => ({ getRiskAnalysis: vi.fn().mockResolvedValue({ risk: { tradeQuality: 'wait', tradeQualityReasons: [], nearbySupport: null, nearbyResistance: null, atr: 0.001, invalidationCandidates: [], riskRewardScenarios: [] } }) }));

describe('buildAnalysisContext', () => {
  it('assembles deterministic panel data without raw candles or account fields', async () => {
    const context = await buildAnalysisContext('EUR/USD', '1H');
    const serialized = JSON.stringify(context);

    expect(context.identity.symbol).toBe('EUR/USD');
    expect(context.marketBias.analysis.trend).toBe('neutral');
    expect(context.multiTimeframe.alignment).toBe('aligned_neutral');
    expect(context.tradeQuality.verdict).toBe('wait');
    expect(serialized).not.toContain('accountSize');
    expect(serialized).not.toContain('analysisCandles');
  });
});
