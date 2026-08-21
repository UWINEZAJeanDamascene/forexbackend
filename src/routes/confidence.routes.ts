import { Router } from 'express';
import { getConfidenceEndpoint } from '../controllers/confidence.controller';

const router = Router();

router.get('/confidence', getConfidenceEndpoint);

export default router;
