import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as authService from './auth.service';
import { ok, created, badRequest } from '../../shared/utils/response';
import { AuthRequest } from '../../shared/types';

function handleValidation(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    badRequest(res, 'Validation failed', errors.array());
    return false;
  }
  return true;
}

export async function register(req: Request, res: Response): Promise<void> {
  if (!handleValidation(req, res)) return;
  const result = await authService.register(req.body);
  created(res, result, result.message);
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  if (!handleValidation(req, res)) return;
  const tokens = await authService.verifyOtp(req.body);
  ok(res, tokens, 'Phone verified successfully');
}

export async function login(req: Request, res: Response): Promise<void> {
  if (!handleValidation(req, res)) return;
  const result = await authService.login(req.body);
  ok(res, result, result.message);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  if (!handleValidation(req, res)) return;
  const tokens = await authService.refreshTokens(req.body);
  ok(res, tokens);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  await authService.logout(user.id);
  ok(res, null, 'Logged out successfully');
}
