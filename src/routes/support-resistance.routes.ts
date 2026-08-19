import { Router } from 'express';
import { getSupportResistanceEndpoint } from '../controllers/support-resistance.controller';

const router = Router();

router.get('/market/support-resistance', getSupportResistanceEndpoint);

export default router;
