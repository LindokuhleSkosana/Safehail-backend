import { Router } from 'express';
import * as controller from './subscriptions.controller';
import { requireAuth, requireVerified } from '../../shared/middleware/auth.middleware';

const router = Router();

// Webhook does not require auth — signed by RevenueCat secret
router.post('/revenuecat-webhook', controller.revenuecatWebhook);

router.use(requireAuth, requireVerified);
router.get('/status', controller.getStatus);

export default router;
