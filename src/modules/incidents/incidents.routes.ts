import { Router } from 'express';
import * as controller from './incidents.controller';
import { requireAuth, requireVerified } from '../../shared/middleware/auth.middleware';

const router = Router();
router.use(requireAuth, requireVerified);

router.get('/', controller.list);
router.get('/:id', controller.getById);

export default router;
