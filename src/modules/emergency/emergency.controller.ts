import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as emergencyService from './emergency.service';
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

export async function trigger(req: Request, res: Response): Promise<void> {
  if (!handleValidation(req, res)) return;
  const user = (req as AuthRequest).user;
  const session = await emergencyService.triggerEmergency({
    userId: user.id,
    triggerType: req.body.triggerType ?? 'manual',
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    address: req.body.address,
  });
  created(res, session, 'Emergency session created');
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  const session = await emergencyService.cancelSession(req.params.sessionId, user.id);
  ok(res, session, 'Emergency session cancelled');
}

export async function resolve(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  const session = await emergencyService.resolveSession(
    req.params.sessionId,
    user.id,
    req.body.notes
  );
  ok(res, session, 'Emergency session resolved');
}

export async function getSession(req: Request, res: Response): Promise<void> {
  const session = await emergencyService.getSessionById(req.params.sessionId);
  ok(res, session);
}

export async function pushLocation(req: Request, res: Response): Promise<void> {
  if (!handleValidation(req, res)) return;
  const user = (req as AuthRequest).user;
  await emergencyService.pushLocationUpdate(
    req.params.sessionId,
    user.id,
    req.body.latitude,
    req.body.longitude
  );
  ok(res, null, 'Location updated');
}
