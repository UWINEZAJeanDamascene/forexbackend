import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { RiskResponse, RiskAnalysisRequest } from '../../../shared/types/riskAnalysis';
import { getTrendAnalysis } from './trendAnalysisService';
import { getMarketStructure } from './marketStructureService';
import { getVolatilityAnalysis } from './volatilityAnalysisService';
import { getSupportResistance } from './supportResistanceService';
import { getSetupDetection } from './setupDetectionService';
import { getMomentumAnalysis } from './momentumAnalysisService';
import { analyzeMultiTimeframe } from './multiTimeframeAnalysisEngine';
import { getValidatedCandles } from '../services/marketDataService';
import { computeRiskAnalysis } from './riskAnalysisEngine';
import { createLogger } from '../utils/logger';
import { getCachedQuote } from '../services/quoteService';

const logger = createLogger('riskAnalysis');

export async function getRiskAnalysis(symbol: Symbol, timeframe: Timeframe, request?: RiskAnalysisRequest): Promise<RiskResponse> {
  try {
    const { analysisCandles: candles } = await getValidatedCandles(symbol, timeframe, { limit: 500 });

    const [trend, volatility, sr, setups, momentum, multiTimeframe] = await Promise.all([
      getTrendAnalysis(symbol, timeframe, {}),
      getVolatilityAnalysis(symbol, timeframe),
      getSupportResistance(candles, { swingWindow: 2 }),
      getSetupDetection(symbol, timeframe),
      getMomentumAnalysis(symbol, timeframe),
      analyzeMultiTimeframe(symbol, timeframe),
    ]);

    const structure = getMarketStructure(candles, { swingWindow: 2 });
    const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

    let quoteToAccountRate: number | undefined;
    if (request?.accountSize !== undefined && request.maxRiskPercent !== undefined) {
      try {
        quoteToAccountRate = await getQuoteToUsdRate(symbol);
      } catch (conversionError) {
        logger.warn('Position sizing skipped because quote-currency conversion is unavailable', {
          symbol,
          message: conversionError instanceof Error ? conversionError.message : String(conversionError),
        });
      }
    }

    const sizingInputs = quoteToAccountRate === undefined
      ? { accountSize: undefined, maxRiskPercent: undefined }
      : { accountSize: request?.accountSize, maxRiskPercent: request?.maxRiskPercent };

    const risk = computeRiskAnalysis({
      trend: trend.trend,
      structure: structure.structure,
      volatility: volatility.volatility,
      supportResistance: sr,
      setups: setups.setups,
      momentum: momentum.momentum,
      multiTimeframe,
      currentPrice,
      accountSize: sizingInputs.accountSize,
      maxRiskPercent: sizingInputs.maxRiskPercent,
      quoteToAccountRate,
      accountCurrency: 'USD',
    });

    return {
      symbol,
      timeframe,
      risk,
    };
  } catch (err) {
    logger.error('Failed to compute risk analysis', {
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function getQuoteToUsdRate(symbol: Symbol): Promise<number | undefined> {
  const quoteCurrency = symbol.split('/')[1];
  if (quoteCurrency === 'USD') return 1;

  const conversionSymbol = `USD/${quoteCurrency}` as Symbol;
  const quote = await getCachedQuote(conversionSymbol);
  if (!Number.isFinite(quote.price) || quote.price <= 0) return undefined;
  return 1 / quote.price;
}
