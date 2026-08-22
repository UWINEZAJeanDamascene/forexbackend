import { Router } from 'express';
import { getCandles, getQuote, getSymbols, getTimeframes } from '../controllers/market.controller';

const router = Router();

router.get('/market/candles', getCandles);
router.get('/market/quote', getQuote);
router.get('/market/symbols', getSymbols);
router.get('/market/timeframes', getTimeframes);

export default router;
