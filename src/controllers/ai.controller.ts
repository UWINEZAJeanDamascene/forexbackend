import { Request, Response } from 'express';
import { ENABLED_SYMBOLS, ENABLED_TIMEFRAMES, Symbol, Timeframe } from '../../../shared/constants/instruments';
import { buildAnalysisContext } from '../analysis/analysisContextService';
import { aiAnalysisService } from '../ai/aiServiceFactory';
import { createLogger } from '../utils/logger';

const logger = createLogger('ai.controller');

function isEnabledSymbol(value: unknown): value is Symbol {
  return typeof value === 'string' && (ENABLED_SYMBOLS as string[]).includes(value);
}

function isEnabledTimeframe(value: unknown): value is Timeframe {
  return typeof value === 'string' && (ENABLED_TIMEFRAMES as string[]).includes(value);
}

export async function postAiAnalysis(req: Request, res: Response): Promise<void> {
  const symbol = req.body?.symbol;
  const timeframe = req.body?.timeframe;
  if (!isEnabledSymbol(symbol) || !isEnabledTimeframe(timeframe)) {
    res.status(400).json({ error: 'A supported symbol and timeframe are required.' });
    return;
  }

  try {
    const context = await buildAnalysisContext(symbol, timeframe);
    const result = await aiAnalysisService.explain(context);
    res.status(200).json(result);
  } catch (error) {
    logger.error('AI analysis failed', { message: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'AI analysis is temporarily unavailable. Deterministic analysis remains available.' });
  }
}

export function getAiUsage(_req: Request, res: Response): void {
  res.status(200).json(aiAnalysisService.getUsage());
}
