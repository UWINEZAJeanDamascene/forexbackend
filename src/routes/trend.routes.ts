import { Router } from 'express';
import { getTrendEndpoint } from '../controllers/trend.controller';

const router = Router();

router.get('/market/trend', getTrendEndpoint);

export default router;
