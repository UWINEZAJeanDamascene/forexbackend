import { Request, Response } from 'express';
import { ENABLED_SYMBOLS, ENABLED_TIMEFRAMES, Symbol, Timeframe } from '../../../shared/constants/instruments';
import { getValidatedCandles } from '../services/marketDataService';
import { getMarketStructure } from '../analysis/marketStructureService';
import { createLogger } from '../utils/logger';

const logger = createLogger('market-structure.controller');

function isEnabledSymbol(value: string): value is Symbol {
  return (ENABLED_SYMBOLS as string[]).includes(value);
}

function isEnabledTimeframe(value: string): value is Timeframe {
  return (ENABLED_TIMEFRAMES as string[]).includes(value);
}

export async function getMarketStructureEndpoint(req: Request, res: Response): Promise<void> {
  const symbol = String(req.query.symbol || '');
  const timeframe = String(req.query.timeframe || '');
  const swingWindowRaw = req.query.swingWindow;
  const swingWindow = swingWindowRaw !== undefined ? Number(swingWindowRaw) : undefined;

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

  if (swingWindow !== undefined && (!Number.isInteger(swingWindow) || swingWindow < 1 || swingWindow > 10)) {
    res.status(400).json({ error: 'swingWindow must be an integer between 1 and 10.' });
    return;
  }

  try {
    const { candles } = await getValidatedCandles(symbol, timeframe);
    const result = getMarketStructure(candles, { swingWindow });
    res.status(200).json({
      symbol,
      timeframe,
      structure: result.structure,
    });
  } catch (err) {
    logger.error('Failed to compute market structure', {
      message: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}
