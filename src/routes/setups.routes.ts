import { Router } from 'express';
import { getSetupsEndpoint } from '../controllers/setups.controller';

const router = Router();

router.get('/setups', getSetupsEndpoint);

export default router;
