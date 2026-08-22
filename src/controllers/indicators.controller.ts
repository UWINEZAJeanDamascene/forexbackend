import { Request, Response } from 'express';
import { ENABLED_SYMBOLS, ENABLED_TIMEFRAMES, Symbol, Timeframe } from '../../../shared/constants/instruments';
import { getValidatedCandles } from '../services/marketDataService';
import { computeIndicators } from '../analysis/indicatorService';
import { createLogger } from '../utils/logger';

const logger = createLogger('indicators.controller');

function isEnabledSymbol(value: string): value is Symbol {
  return (ENABLED_SYMBOLS as string[]).includes(value);
}

function isEnabledTimeframe(value: string): value is Timeframe {
  return (ENABLED_TIMEFRAMES as string[]).includes(value);
}

/**
 * GET /api/market/indicators?symbol=EUR/USD&timeframe=1H
 *
 * Returns all computed technical indicators for the requested symbol and
 * timeframe. Each indicator array is aligned with the returned candles
 * (same length, same order), so the frontend can overlay them on the chart
 * or display the latest values.
 */
export async function getIndicators(req: Request, res: Response): Promise<void> {
  const symbol = String(req.query.symbol || '');
  const timeframe = String(req.query.timeframe || '');
  const limitRaw = req.query.limit;

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

  let limit: number | undefined;
  if (limitRaw !== undefined) {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
      res.status(400).json({ error: 'limit must be an integer between 1 and 500.' });
      return;
    }
    limit = parsed;
  }

  try {
    const validated = await getValidatedCandles(symbol, timeframe, { limit });
    const candles = validated.analysisCandles ?? validated.candles;
    const result = computeIndicators(candles, symbol, timeframe);
    res.status(200).json(result);
  } catch (err) {
    logger.error('Failed to compute indicators', {
      message: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}
