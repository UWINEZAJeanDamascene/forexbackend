import { Router } from 'express';
import { getRiskEndpoint } from '../controllers/risk.controller';

const router = Router();

router.get('/risk', getRiskEndpoint);

export default router;
