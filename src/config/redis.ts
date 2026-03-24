import { createClient } from 'redis';
import { env } from './env';
import { logger } from '../shared/utils/logger';

const redisClient = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Redis max retries exceeded');
      return Math.min(retries * 100, 3000);
    },
  },
});

redisClient.on('error', (err) => {
  logger.error('Redis client error', { error: err.message });
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis reconnecting...');
});

export async function connectRedis(): Promise<void> {
  await redisClient.connect();
  logger.info('Redis connected');
}

export { redisClient };

// ── Typed key helpers ──────────────────────────────────────────────────────

export const RedisKeys = {
  refreshToken: (userId: string) => `refresh_token:${userId}`,
  otp: (phone: string) => `otp:${phone}`,
  otpAttempts: (phone: string) => `otp_attempts:${phone}`,
  emergencyRateLimit: (userId: string) => `emergency_rl:${userId}`,
  userSession: (userId: string) => `user_session:${userId}`,
} as const;
