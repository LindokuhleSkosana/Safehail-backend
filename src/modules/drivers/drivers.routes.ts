import { Router } from 'express';
import { body } from 'express-validator';
import * as controller from './drivers.controller';
import { requireAuth, requireVerified } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(requireAuth, requireVerified);

router.post(
  '/profile',
  [
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('platform').optional().isIn(['uber', 'bolt', 'other']),
  ],
  controller.upsertProfile
);

router.get('/profile', controller.getProfile);

router.post(
  '/device-token',
  [
    body('token').notEmpty().withMessage('FCM token is required'),
    body('platform').isIn(['android', 'ios']).withMessage('Platform must be android or ios'),
  ],
  controller.registerDeviceToken
);

export default router;
