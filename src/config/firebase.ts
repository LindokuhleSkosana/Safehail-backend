import admin from 'firebase-admin';
import { env } from './env';
import { logger } from '../shared/utils/logger';

let firebaseInitialized = false;

export function initFirebase(): void {
  if (firebaseInitialized) return;

  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications disabled');
    return;
  }

  try {
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as admin.ServiceAccount;
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseInitialized = true;
    logger.info('Firebase Admin SDK initialized');
  } catch (err) {
    logger.error('Failed to initialize Firebase', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function sendPushNotification(params: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: 'high' | 'normal';
}): Promise<string | null> {
  if (!firebaseInitialized) {
    logger.warn('Firebase not initialized — skipping push notification');
    return null;
  }

  try {
    const messageId = await admin.messaging().send({
      token: params.token,
      notification: { title: params.title, body: params.body },
      data: params.data ?? {},
      android: {
        priority: params.priority === 'high' ? 'high' : 'normal',
        notification: { channelId: 'safehail_alerts', sound: 'default' },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true,
          },
        },
        headers: {
          'apns-priority': params.priority === 'high' ? '10' : '5',
        },
      },
    });
    return messageId;
  } catch (err) {
    logger.error('FCM send error', {
      token: params.token.slice(0, 20) + '...',
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function sendMulticastPush(params: {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: 'high' | 'normal';
}): Promise<{ successCount: number; failureCount: number }> {
  if (!firebaseInitialized || params.tokens.length === 0) {
    return { successCount: 0, failureCount: params.tokens.length };
  }

  const chunkSize = 500;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < params.tokens.length; i += chunkSize) {
    const chunk = params.tokens.slice(i, i + chunkSize);
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title: params.title, body: params.body },
        data: params.data ?? {},
        android: {
          priority: params.priority === 'high' ? 'high' : 'normal',
          notification: { channelId: 'safehail_alerts', sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
          headers: { 'apns-priority': params.priority === 'high' ? '10' : '5' },
        },
      });
      successCount += response.successCount;
      failureCount += response.failureCount;
    } catch (err) {
      failureCount += chunk.length;
      logger.error('Multicast FCM error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { successCount, failureCount };
}
