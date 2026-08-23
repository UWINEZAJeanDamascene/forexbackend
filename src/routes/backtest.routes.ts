import { Router } from 'express';
import {
  startBacktestEndpoint,
  listBacktestsEndpoint,
  getBacktestStatusEndpoint,
  getBacktestResultsEndpoint,
  getBacktestTradeEndpoint,
  cancelBacktestEndpoint,
} from '../controllers/backtest.controller';

const router = Router();

router.post('/', startBacktestEndpoint);
router.get('/', listBacktestsEndpoint);
router.get('/:id/status', getBacktestStatusEndpoint);
router.delete('/:id', cancelBacktestEndpoint);
router.get('/:id/trades/:tradeId', getBacktestTradeEndpoint);
router.get('/:id', getBacktestResultsEndpoint);

export default router;
