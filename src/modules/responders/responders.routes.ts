import { Router } from 'express';
import * as controller from './responders.controller';
import { requireAuth, requireVerified } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(requireAuth, requireVerified);

router.post('/:sessionId/accept', controller.accept);
router.post('/:sessionId/decline', controller.decline);
router.post('/:sessionId/arrived', controller.arrived);

export default router;
