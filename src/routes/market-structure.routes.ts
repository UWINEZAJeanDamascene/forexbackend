import { Router } from 'express';
import { getMarketStructureEndpoint } from '../controllers/market-structure.controller';

const router = Router();

router.get('/market/structure', getMarketStructureEndpoint);

export default router;
