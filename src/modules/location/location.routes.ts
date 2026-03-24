import { Router } from 'express';
import { body } from 'express-validator';
import * as controller from './location.controller';
import { requireAuth, requireVerified } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(requireAuth, requireVerified);

router.post(
  '/update',
  [
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    body('accuracy').optional().isFloat({ min: 0 }),
    body('heading').optional().isFloat({ min: 0, max: 360 }),
    body('speed').optional().isFloat({ min: 0 }),
  ],
  controller.updateLocation
);

export default router;
