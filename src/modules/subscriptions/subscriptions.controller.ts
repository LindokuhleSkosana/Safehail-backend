import { Request, Response } from 'express';
import * as subscriptionsService from './subscriptions.service';
import { ok, badRequest, unauthorized } from '../../shared/utils/response';
import { AuthRequest } from '../../shared/types';
import { logger } from '../../shared/utils/logger';

export async function getStatus(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  const status = await subscriptionsService.getStatus(user.id);
  ok(res, status);
}

export async function revenuecatWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-revenuecat-signature'] as string;
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);

  if (signature) {
    const valid = subscriptionsService.validateRevenueCatSignature(rawBody, signature);
    if (!valid) {
      logger.warn('RevenueCat webhook signature mismatch');
      unauthorized(res, 'Invalid webhook signature');
      return;
    }
  }

  try {
    await subscriptionsService.handleRevenueCatEvent(req.body);
    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('RevenueCat webhook processing error', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Always return 200 to prevent RevenueCat from retrying indefinitely
    res.status(200).json({ received: true, note: 'Processing error logged' });
  }
}
