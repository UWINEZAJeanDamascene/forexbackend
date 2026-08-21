import { Router } from 'express';
import { getVolatilityEndpoint } from '../controllers/volatility.controller';

const router = Router();

router.get('/analysis/volatility', getVolatilityEndpoint);

export default router;
