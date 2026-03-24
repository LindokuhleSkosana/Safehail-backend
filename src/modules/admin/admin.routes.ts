import { Router } from 'express';
import * as controller from './admin.controller';
import { requireAuth } from '../../shared/middleware/auth.middleware';
import { requireAdmin } from '../../shared/middleware/rbac.middleware';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/users', controller.listUsers);
router.post('/users/:id/suspend', controller.suspendUser);
router.get('/incidents', controller.listIncidents);
router.get('/ai-events', controller.listAiEvents);
router.get('/audit-logs', controller.listAuditLogs);

export default router;
