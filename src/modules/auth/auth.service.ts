import jwt from 'jsonwebtoken';
import AfricasTalking from 'africastalking';
import { query, withTransaction } from '../../config/db';
import { redisClient, RedisKeys } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../shared/utils/logger';
import { hashPassword, verifyPassword, generateOtp, generateSecureToken } from '../../shared/utils/crypto';
import { AppError } from '../../shared/middleware/error.middleware';
import {
  RegisterInput,
  VerifyOtpInput,
  LoginInput,
  RefreshInput,
  TokenPair,
  OtpRecord,
} from './auth.types';
import { UserRole } from '../../shared/types';

const OTP_EXPIRES_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 3;

// ── Africa's Talking SMS client ────────────────────────────────────────────
let smsClient: ReturnType<typeof AfricasTalking>['SMS'] | null = null;
if (env.AFRICAS_TALKING_API_KEY) {
  const at = AfricasTalking({
    apiKey: env.AFRICAS_TALKING_API_KEY,
    username: env.AFRICAS_TALKING_USERNAME,
  });
  smsClient = at.SMS;
}

async function sendOtpSms(phone: string, otp: string): Promise<void> {
  if (!smsClient) {
    // Dev mode — log OTP to console instead
    logger.info(`[DEV] OTP for ${phone}: ${otp}`);
    return;
  }
  try {
    await smsClient.send({
      to: [phone],
      message: `Your SafeHail verification code is: ${otp}. Valid for ${OTP_EXPIRES_MINUTES} minutes. Do not share this code.`,
      from: env.AFRICAS_TALKING_SENDER_ID,
    });
    logger.info('OTP SMS sent', { phone: phone.slice(0, -4) + '****' });
    if (env.AFRICAS_TALKING_USERNAME === 'sandbox') {
      logger.info(`[SANDBOX] OTP for ${phone}: ${otp}`);
    }
  } catch (err) {
    logger.error('Failed to send OTP SMS', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new AppError(503, 'SMS_FAILED', 'Failed to send OTP. Please try again.');
  }
}

function issueTokens(userId: string, phone: string, role: UserRole, isVerified: boolean): TokenPair {
  const payload = { sub: userId, phone, role, isVerified };
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  const refreshToken = jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  // expiresIn in seconds — parse "15m" → 900
  const expiresIn = parseExpiry(env.JWT_EXPIRES_IN);
  return { accessToken, refreshToken, expiresIn };
}

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] ?? 60);
}

async function storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
  const expirySeconds = parseExpiry(env.JWT_REFRESH_EXPIRES_IN);
  await redisClient.set(RedisKeys.refreshToken(userId), refreshToken, { EX: expirySeconds });
}

async function storeOtp(userId: string, phone: string, otp: string): Promise<void> {
  const record: OtpRecord = {
    code: otp,
    expiresAt: Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000,
    userId,
  };
  await redisClient.set(RedisKeys.otp(phone), JSON.stringify(record), {
    EX: OTP_EXPIRES_MINUTES * 60,
  });
  // Reset attempt counter
  await redisClient.del(RedisKeys.otpAttempts(phone));
}

// ── Public service methods ─────────────────────────────────────────────────

export async function register(input: RegisterInput): Promise<{ message: string }> {
  const { phone, password, email } = input;

  // Normalize South African phone to E.164
  const normalizedPhone = normalizePhone(phone);

  const existing = await query<{ id: string }>(
    'SELECT id FROM users WHERE phone = $1',
    [normalizedPhone]
  );
  if (existing.rows.length > 0) {
    throw new AppError(409, 'PHONE_EXISTS', 'An account with this phone number already exists.');
  }

  if (email) {
    const emailExists = await query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (emailExists.rows.length > 0) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
    }
  }

  const passwordHash = await hashPassword(password);

  const result = await withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO users (phone, email, password_hash, role, is_verified, is_active)
       VALUES ($1, $2, $3, 'driver', false, true)
       RETURNING id`,
      [normalizedPhone, email ?? null, passwordHash]
    );
    const userId = rows[0].id;

    // Create trial subscription
    const trialDays = 14;
    const trialEndsAt = new Date(Date.now() + trialDays * 86400 * 1000).toISOString();
    await client.query(
      `INSERT INTO subscriptions (user_id, plan, status, trial_ends_at, entitlement_active)
       VALUES ($1, 'monthly', 'trialing', $2, true)`,
      [userId, trialEndsAt]
    );

    return userId;
  });

  const otp = generateOtp(6);
  await storeOtp(result, normalizedPhone, otp);
  await sendOtpSms(normalizedPhone, otp);

  logger.info('User registered', { userId: result, phone: normalizedPhone.slice(0, -4) + '****' });

  return { message: 'Registration successful. Please verify your phone number with the OTP sent.' };
}

export async function verifyOtp(input: VerifyOtpInput): Promise<TokenPair> {
  const normalizedPhone = normalizePhone(input.phone);
  const attemptsKey = RedisKeys.otpAttempts(normalizedPhone);

  // Check attempts
  const attempts = await redisClient.get(attemptsKey);
  if (attempts && parseInt(attempts, 10) >= OTP_MAX_ATTEMPTS) {
    throw new AppError(429, 'OTP_LOCKED', 'Too many failed attempts. Request a new OTP.');
  }

  const raw = await redisClient.get(RedisKeys.otp(normalizedPhone));
  if (!raw) {
    throw new AppError(400, 'OTP_NOT_FOUND', 'No OTP found. Please request a new one.');
  }

  const record: OtpRecord = JSON.parse(raw);

  if (Date.now() > record.expiresAt) {
    await redisClient.del(RedisKeys.otp(normalizedPhone));
    throw new AppError(400, 'OTP_EXPIRED', 'OTP has expired. Please request a new one.');
  }

  if (record.code !== input.otp.trim()) {
    const newAttempts = await redisClient.incr(attemptsKey);
    await redisClient.expire(attemptsKey, OTP_EXPIRES_MINUTES * 60);
    const remaining = OTP_MAX_ATTEMPTS - newAttempts;
    throw new AppError(
      400,
      'OTP_INVALID',
      `Invalid OTP. ${remaining} attempt(s) remaining.`
    );
  }

  // Mark user as verified
  await query(
    'UPDATE users SET is_verified = true, updated_at = NOW() WHERE id = $1',
    [record.userId]
  );

  // Clean up OTP
  await redisClient.del(RedisKeys.otp(normalizedPhone));
  await redisClient.del(attemptsKey);

  const user = await query<{ id: string; phone: string; role: UserRole }>(
    'SELECT id, phone, role FROM users WHERE id = $1',
    [record.userId]
  );

  const tokens = issueTokens(user.rows[0].id, user.rows[0].phone, user.rows[0].role, true);
  await storeRefreshToken(user.rows[0].id, tokens.refreshToken);

  logger.info('OTP verified', { userId: record.userId });
  return tokens;
}

export async function login(input: LoginInput): Promise<{ message: string }> {
  const normalizedPhone = normalizePhone(input.phone);

  const result = await query<{
    id: string;
    phone: string;
    password_hash: string;
    role: UserRole;
    is_verified: boolean;
    is_active: boolean;
  }>(
    'SELECT id, phone, password_hash, role, is_verified, is_active FROM users WHERE phone = $1',
    [normalizedPhone]
  );

  const user = result.rows[0];

  if (!user || !(await verifyPassword(input.password, user.password_hash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid phone number or password.');
  }

  if (!user.is_active) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.');
  }

  const otp = generateOtp(6);
  await storeOtp(user.id, normalizedPhone, otp);
  await sendOtpSms(normalizedPhone, otp);

  logger.info('Login OTP sent', { userId: user.id });
  return { message: 'OTP sent to your phone number. Please verify to continue.' };
}

export async function refreshTokens(input: RefreshInput): Promise<TokenPair> {
  let decoded: { sub: string };
  try {
    decoded = jwt.verify(input.refreshToken, env.JWT_REFRESH_SECRET) as { sub: string };
  } catch {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
  }

  const stored = await redisClient.get(RedisKeys.refreshToken(decoded.sub));
  if (!stored || stored !== input.refreshToken) {
    throw new AppError(401, 'REFRESH_TOKEN_REVOKED', 'Refresh token has been revoked.');
  }

  const user = await query<{
    id: string;
    phone: string;
    role: UserRole;
    is_verified: boolean;
    is_active: boolean;
  }>(
    'SELECT id, phone, role, is_verified, is_active FROM users WHERE id = $1',
    [decoded.sub]
  );

  if (!user.rows[0] || !user.rows[0].is_active) {
    throw new AppError(401, 'USER_NOT_FOUND', 'User not found or suspended.');
  }

  const u = user.rows[0];
  const tokens = issueTokens(u.id, u.phone, u.role, u.is_verified);
  await storeRefreshToken(u.id, tokens.refreshToken);
  return tokens;
}

export async function logout(userId: string): Promise<void> {
  await redisClient.del(RedisKeys.refreshToken(userId));
  logger.info('User logged out', { userId });
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function normalizePhone(phone: string): string {
  // Strip spaces/dashes
  let cleaned = phone.replace(/[\s\-().]/g, '');
  // South African: 0xx → +27xx
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '+27' + cleaned.slice(1);
  }
  // Already E.164
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}
