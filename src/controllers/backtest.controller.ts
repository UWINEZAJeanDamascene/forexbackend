import { Request, Response } from 'express';
import { validateBacktestConfig } from '../validation/backtestValidator';
import { startBacktest } from '../services/backtestService';
import { cancelBacktest, getBacktestRun, getBacktestTrade, listBacktestRuns } from '../services/backtestPersistenceService';

function userId(req: Request): string {
  return req.historyUserId!;
}

export async function startBacktestEndpoint(req: Request, res: Response): Promise<void> {
  const input = req.body?.config ?? req.body;
  const validation = validateBacktestConfig(input);
  if (!validation.config) {
    res.status(400).json({ error: 'Invalid backtest configuration.', issues: validation.errors });
    return;
  }

  try {
    const result = await startBacktest(validation.config, userId(req));
    res.status(202).json({ id: result.id, status: 'queued', message: 'Backtest queued.' });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Could not queue backtest.' });
  }
}

export async function listBacktestsEndpoint(req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json({ backtests: await listBacktestRuns(userId(req)) });
  } catch {
    res.status(500).json({ error: 'Could not load backtests.' });
  }
}

export async function getBacktestStatusEndpoint(req: Request, res: Response): Promise<void> {
  try {
    const run = await getBacktestRun(req.params.id, userId(req));
    if (!run) {
      res.status(404).json({ error: 'Backtest not found.' });
      return;
    }
    res.status(200).json({ id: run.id, status: run.status, error: run.error, createdAt: run.createdAt, completedAt: run.completedAt });
  } catch {
    res.status(500).json({ error: 'Could not load backtest status.' });
  }
}

export async function getBacktestResultsEndpoint(req: Request, res: Response): Promise<void> {
  try {
    const run = await getBacktestRun(req.params.id, userId(req));
    if (!run) {
      res.status(404).json({ error: 'Backtest not found.' });
      return;
    }
    res.status(200).json(run);
  } catch {
    res.status(500).json({ error: 'Could not load backtest results.' });
  }
}

export async function getBacktestTradeEndpoint(req: Request, res: Response): Promise<void> {
  try {
    const trade = await getBacktestTrade(req.params.tradeId, userId(req));
    if (!trade || trade.backtestId !== req.params.id) {
      res.status(404).json({ error: 'Backtest trade not found.' });
      return;
    }
    res.status(200).json(trade);
  } catch {
    res.status(500).json({ error: 'Could not load backtest trade.' });
  }
}

export async function cancelBacktestEndpoint(req: Request, res: Response): Promise<void> {
  try {
    const cancelled = await cancelBacktest(req.params.id, userId(req));
    res.status(cancelled ? 200 : 409).json({ id: req.params.id, status: cancelled ? 'cancelled' : 'Not cancellable.' });
  } catch {
    res.status(500).json({ error: 'Could not cancel backtest.' });
  }
}
