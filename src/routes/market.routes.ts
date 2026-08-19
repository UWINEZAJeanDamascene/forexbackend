import { Router } from 'express';
import { getCandles, getSymbols, getTimeframes } from '../controllers/market.controller';

const router = Router();

router.get('/market/candles', getCandles);
router.get('/market/symbols', getSymbols);
router.get('/market/timeframes', getTimeframes);

export default router;
