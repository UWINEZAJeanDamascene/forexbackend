import { Request, Response } from 'express';
import { ENABLED_SYMBOLS, ENABLED_TIMEFRAMES, Symbol, Timeframe } from '../../../shared/constants/instruments';
import { getSetupDetection } from '../analysis/setupDetectionService';
import { createLogger } from '../utils/logger';

const logger = createLogger('setupDetection.controller');

function isEnabledSymbol(value: string): value is Symbol {
  return (ENABLED_SYMBOLS as string[]).includes(value);
}

function isEnabledTimeframe(value: string): value is Timeframe {
  return (ENABLED_TIMEFRAMES as string[]).includes(value);
}

export async function getSetupsEndpoint(req: Request, res: Response): Promise<void> {
  const symbol = String(req.query.symbol || '');
  const timeframe = String(req.query.timeframe || '');

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

  try {
    const result = await getSetupDetection(symbol, timeframe);
    res.status(200).json(result);
  } catch (err) {
    logger.error('Failed to compute setup detection', {
      message: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}
