import { Router } from 'express';
import { postSaveAnalysis, getHistoryList, getHistoryDetail, deleteHistoryItem } from '../controllers/history.controller';

const router = Router();

router.post('/history', postSaveAnalysis);
router.get('/history', getHistoryList);
router.get('/history/:id', getHistoryDetail);
router.delete('/history/:id', deleteHistoryItem);

export default router;
