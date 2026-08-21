import { Router } from 'express';
import { getMultiTimeframeEndpoint } from '../controllers/multi-timeframe.controller';

const router = Router();

router.get('/analysis/multi-timeframe', getMultiTimeframeEndpoint);

export default router;
