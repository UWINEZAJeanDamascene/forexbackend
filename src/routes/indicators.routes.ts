import { Router } from 'express';
import { getIndicators } from '../controllers/indicators.controller';

const router = Router();

router.get('/market/indicators', getIndicators);

export default router;
