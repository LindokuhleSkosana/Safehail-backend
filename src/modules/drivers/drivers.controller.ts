import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as driversService from './drivers.service';
import { ok, badRequest } from '../../shared/utils/response';
import { AuthRequest } from '../../shared/types';

function handleValidation(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    badRequest(res, 'Validation failed', errors.array());
    return false;
  }
  return true;
}

export async function upsertProfile(req: Request, res: Response): Promise<void> {
  if (!handleValidation(req, res)) return;
  const user = (req as AuthRequest).user;
  const profile = await driversService.upsertProfile({ userId: user.id, ...req.body });
  ok(res, profile);
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  const profile = await driversService.getProfile(user.id);
  ok(res, profile);
}

export async function registerDeviceToken(req: Request, res: Response): Promise<void> {
  if (!handleValidation(req, res)) return;
  const user = (req as AuthRequest).user;
  await driversService.registerDeviceToken(user.id, req.body.token, req.body.platform);
  ok(res, null, 'Device token registered');
}
