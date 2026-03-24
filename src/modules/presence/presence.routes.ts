import { Router } from 'express';
import * as controller from './presence.controller';
import { requireAuth, requireVerified } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(requireAuth, requireVerified);

router.post('/online', controller.goOnline);
router.post('/offline', controller.goOffline);
router.get('/nearby', controller.getNearby);

export default router;
