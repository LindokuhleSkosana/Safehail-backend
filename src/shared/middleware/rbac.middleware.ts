import { Request, Response, NextFunction } from 'express';
import { forbidden } from '../utils/response';
import { UserRole, AuthRequest } from '../types';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthRequest).user;
    if (!roles.includes(user.role)) {
      forbidden(res, 'Insufficient permissions');
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole('admin');
export const requireSupport = requireRole('admin', 'support');
