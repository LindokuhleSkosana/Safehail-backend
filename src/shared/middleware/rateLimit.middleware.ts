import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { tooManyRequests } from '../utils/response';
import { Response, Request } from 'express';

const handler = (_req: Request, res: Response): void => {
  tooManyRequests(res);
};

export const generalRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_GENERAL,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

export const authRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_AUTH,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  keyGenerator: (req) => req.ip ?? 'unknown',
});

export const emergencyRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: env.RATE_LIMIT_MAX_EMERGENCY,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  keyGenerator: (req) => {
    // Rate limit per user ID if authenticated, fall back to IP
    const userId = (req as { user?: { id?: string } }).user?.id;
    return userId ?? req.ip ?? 'unknown';
  },
});
