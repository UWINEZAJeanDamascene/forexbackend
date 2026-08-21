import { Request, Response } from 'express';
import { ENABLED_SYMBOLS, ENABLED_TIMEFRAMES, Symbol, Timeframe } from '../../../shared/constants/instruments';
import { getRiskAnalysis } from '../analysis/riskAnalysisService';
import { RiskAnalysisRequest } from '../../../shared/types/riskAnalysis';
import { createLogger } from '../utils/logger';

const logger = createLogger('risk.controller');

function isEnabledSymbol(value: string): value is Symbol {
  return (ENABLED_SYMBOLS as string[]).includes(value);
}

function isEnabledTimeframe(value: string): value is Timeframe {
  return (ENABLED_TIMEFRAMES as string[]).includes(value);
}

export async function getRiskEndpoint(req: Request, res: Response): Promise<void> {
  const symbol = String(req.query.symbol || '');
  const timeframe = String(req.query.timeframe || '');
  const accountSizeRaw = req.query.accountSize;
  const maxRiskPercentRaw = req.query.maxRiskPercent;

  if (!isEnabledSymbol(symbol)) {
    res.status(400).json({
      error: `Symbol must be one of: ${ENABLED_SYMBOLS.join(', ')}.`,
    });
    return;
  }

  if (!isEnabledTimeframe(timeframe)) {
    res.status(400).json({
      error: `Timeframe must be one of: ${ENABLED_TIMEFRAMES.join(', ')}.`,
    });
    return;
  }

  const request: RiskAnalysisRequest = { symbol, timeframe };

  if (accountSizeRaw !== undefined) {
    const parsed = Number(accountSizeRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      res.status(400).json({ error: 'accountSize must be a positive number.' });
      return;
    }
    request.accountSize = parsed;
  }

  if (maxRiskPercentRaw !== undefined) {
    const parsed = Number(maxRiskPercentRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      res.status(400).json({ error: 'maxRiskPercent must be a positive number.' });
      return;
    }
    request.maxRiskPercent = parsed;
  }

  try {
    const result = await getRiskAnalysis(symbol, timeframe, request);
    res.status(200).json(result);
  } catch (err) {
    logger.error('Failed to compute risk analysis', {
      message: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}
