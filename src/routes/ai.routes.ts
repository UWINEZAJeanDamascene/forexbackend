import { Router } from 'express';
import { getAiUsage, postAiAnalysis } from '../controllers/ai.controller';

const router = Router();
router.post('/ai', postAiAnalysis);
router.get('/ai/usage', getAiUsage);

export default router;
