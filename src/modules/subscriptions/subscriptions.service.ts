import { query } from '../../config/db';
import { AppError } from '../../shared/middleware/error.middleware';
import { logger } from '../../shared/utils/logger';
import { timingSafeEqual } from '../../shared/utils/crypto';
import { env } from '../../config/env';
import { SubscriptionPlan, SubscriptionStatus } from '../../shared/types';

export interface SubscriptionStatus_ {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  entitlementActive: boolean;
  revenuecatCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getStatus(userId: string): Promise<SubscriptionStatus_> {
  const result = await query<{
    id: string; user_id: string; plan: SubscriptionPlan; status: SubscriptionStatus;
    trial_ends_at: string | null; current_period_end: string | null;
    entitlement_active: boolean; revenuecat_customer_id: string | null;
    created_at: string; updated_at: string;
  }>(
    'SELECT * FROM subscriptions WHERE user_id = $1',
    [userId]
  );

  if (!result.rows[0]) {
    throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'No subscription found');
  }

  return mapSubscription(result.rows[0]);
}

// ── RevenueCat webhook handler ──────────────────────────────────────────────

export interface RevenueCatWebhookEvent {
  event: {
    type: string;
    app_user_id: string;
    product_id: string;
    period_type: string;
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    store: string;
    environment: string;
    entitlement_ids: string[] | null;
  };
}

export function validateRevenueCatSignature(
  rawBody: string,
  signature: string
): boolean {
  if (!env.REVENUECAT_WEBHOOK_SECRET) return true; // Not configured — skip in dev
  const expected = require('crypto')
    .createHmac('sha256', env.REVENUECAT_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return timingSafeEqual(expected, signature);
}

export async function handleRevenueCatEvent(event: RevenueCatWebhookEvent): Promise<void> {
  const { type, app_user_id, expiration_at_ms, period_type } = event.event;

  logger.info('RevenueCat webhook received', { type, appUserId: app_user_id });

  // Resolve user by RevenueCat customer ID (or fall back to user ID stored as app_user_id)
  let user = await query<{ id: string }>(
    'SELECT id FROM subscriptions WHERE revenuecat_customer_id = $1',
    [app_user_id]
  );

  // If not found by customer ID, try treating app_user_id as our internal user ID
  if (!user.rows[0]) {
    user = await query<{ id: string }>(
      'SELECT id FROM users WHERE id = $1',
      [app_user_id]
    );
    if (!user.rows[0]) {
      logger.warn('RevenueCat webhook: user not found', { appUserId: app_user_id });
      return;
    }
  }

  const userId = user.rows[0].id;
  const currentPeriodEnd = expiration_at_ms
    ? new Date(expiration_at_ms).toISOString()
    : null;

  const plan: SubscriptionPlan = period_type === 'ANNUAL' ? 'annual' : 'monthly';

  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
      await upsertSubscription(userId, {
        plan,
        status: 'active',
        currentPeriodEnd,
        entitlementActive: true,
        revenuecatCustomerId: app_user_id,
      });
      break;

    case 'CANCELLATION':
      // Keep active until period end; just mark cancelled
      await upsertSubscription(userId, {
        plan,
        status: 'cancelled',
        currentPeriodEnd,
        entitlementActive: currentPeriodEnd
          ? new Date(currentPeriodEnd) > new Date()
          : false,
        revenuecatCustomerId: app_user_id,
      });
      break;

    case 'BILLING_ISSUE':
    case 'PRODUCT_CHANGE':
      await upsertSubscription(userId, {
        plan,
        status: 'past_due',
        currentPeriodEnd,
        entitlementActive: false,
        revenuecatCustomerId: app_user_id,
      });
      break;

    case 'EXPIRATION':
      await upsertSubscription(userId, {
        plan,
        status: 'cancelled',
        currentPeriodEnd,
        entitlementActive: false,
        revenuecatCustomerId: app_user_id,
      });
      break;

    default:
      logger.debug('RevenueCat event type ignored', { type });
  }
}

async function upsertSubscription(
  userId: string,
  data: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
    entitlementActive: boolean;
    revenuecatCustomerId: string;
  }
): Promise<void> {
  await query(
    `INSERT INTO subscriptions
       (user_id, plan, status, current_period_end, entitlement_active, revenuecat_customer_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       plan                   = EXCLUDED.plan,
       status                 = EXCLUDED.status,
       current_period_end     = EXCLUDED.current_period_end,
       entitlement_active     = EXCLUDED.entitlement_active,
       revenuecat_customer_id = EXCLUDED.revenuecat_customer_id,
       updated_at             = NOW()`,
    [
      userId,
      data.plan,
      data.status,
      data.currentPeriodEnd,
      data.entitlementActive,
      data.revenuecatCustomerId,
    ]
  );
}

function mapSubscription(row: {
  id: string; user_id: string; plan: SubscriptionPlan; status: SubscriptionStatus;
  trial_ends_at: string | null; current_period_end: string | null;
  entitlement_active: boolean; revenuecat_customer_id: string | null;
  created_at: string; updated_at: string;
}): SubscriptionStatus_ {
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan,
    status: row.status,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    entitlementActive: row.entitlement_active,
    revenuecatCustomerId: row.revenuecat_customer_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
