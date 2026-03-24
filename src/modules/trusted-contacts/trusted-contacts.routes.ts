import { Router } from 'express';
import { body } from 'express-validator';
import * as controller from './trusted-contacts.controller';
import { requireAuth, requireVerified } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(requireAuth, requireVerified);

router.get('/', controller.list);

router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('relationship').optional().isString().trim(),
    body('notifyOnEmergency').optional().isBoolean(),
  ],
  controller.create
);

router.put(
  '/:contactId',
  [
    body('name').optional().notEmpty(),
    body('phone').optional().notEmpty(),
    body('relationship').optional().isString().trim(),
    body('notifyOnEmergency').optional().isBoolean(),
  ],
  controller.update
);

router.delete('/:contactId', controller.remove);

export default router;
