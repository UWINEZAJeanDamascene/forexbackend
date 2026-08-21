import { Router } from 'express';
import { getMomentumEndpoint } from '../controllers/momentum.controller';

const router = Router();

router.get('/analysis/momentum', getMomentumEndpoint);

export default router;
