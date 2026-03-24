import { Router } from 'express';
import { body } from 'express-validator';
import * as controller from './auth.controller';
import { authRateLimit } from '../../shared/middleware/rateLimit.middleware';
import { requireAuth } from '../../shared/middleware/auth.middleware';

const router = Router();

// All auth routes are rate-limited
router.use(authRateLimit);

router.post(
  '/register',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('email').optional().isEmail().withMessage('Invalid email address'),
  ],
  controller.register
);

router.post(
  '/verify-otp',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('otp').isLength({ min: 4, max: 8 }).withMessage('Invalid OTP format'),
  ],
  controller.verifyOtp
);

router.post(
  '/login',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  controller.login
);

router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  controller.refresh
);

router.post('/logout', requireAuth, controller.logout);

export default router;
