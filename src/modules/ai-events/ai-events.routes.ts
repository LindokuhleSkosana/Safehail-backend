import { Router } from 'express';
import { body } from 'express-validator';
import * as controller from './ai-events.controller';
import { requireAuth, requireVerified } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(requireAuth, requireVerified);

router.post(
  '/ingest',
  [
    body('eventType').isIn(['voice_trigger', 'gesture_trigger', 'anomaly']).withMessage('Invalid event type'),
    body('confidence').optional().isFloat({ min: 0, max: 1 }),
    body('rawSignal').optional().isObject(),
    body('actionTaken').optional().isString().trim(),
  ],
  controller.ingest
);

router.get('/flags', controller.getFlags);

export default router;
