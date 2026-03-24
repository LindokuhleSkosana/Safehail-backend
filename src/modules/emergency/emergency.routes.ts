import { Router } from 'express';
import { body } from 'express-validator';
import * as controller from './emergency.controller';
import { requireAuth, requireVerified } from '../../shared/middleware/auth.middleware';
import { emergencyRateLimit } from '../../shared/middleware/rateLimit.middleware';

const router = Router();
router.use(requireAuth, requireVerified);

router.post(
  '/trigger',
  emergencyRateLimit,
  [
    body('triggerType').optional().isIn(['manual', 'voice', 'gesture', 'hidden']),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('address').optional().isString().trim(),
  ],
  controller.trigger
);

router.post('/:sessionId/cancel', controller.cancel);
router.post('/:sessionId/resolve', controller.resolve);
router.get('/:sessionId', controller.getSession);

router.post(
  '/:sessionId/location',
  [
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  ],
  controller.pushLocation
);

export default router;
