import { Router } from 'express';
import { requestLogin, verifyLogin } from '../controllers/auth.controller';

const router = Router();
router.post('/request-login', requestLogin);
router.post('/verify-login', verifyLogin);
export default router;