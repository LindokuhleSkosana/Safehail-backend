import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { unauthorized } from '../utils/response';
import { AuthUser, AuthRequest } from '../types';

interface JwtPayload {
  sub: string;
  phone: string;
  role: string;
  isVerified: boolean;
  iat: number;
  exp: number;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    unauthorized(res, 'Missing authorization header');
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    (req as AuthRequest).user = {
      id: decoded.sub,
      phone: decoded.phone,
      role: decoded.role as AuthUser['role'],
      isVerified: decoded.isVerified,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      unauthorized(res, 'Token expired');
    } else {
      unauthorized(res, 'Invalid token');
    }
  }
}

export function requireVerified(req: Request, res: Response, next: NextFunction): void {
  const user = (req as AuthRequest).user;
  if (!user.isVerified) {
    unauthorized(res, 'Phone number not verified');
    return;
  }
  next();
}
