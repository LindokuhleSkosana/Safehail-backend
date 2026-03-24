import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as aiEventsService from './ai-events.service';
import { ok, created, badRequest } from '../../shared/utils/response';
import { AuthRequest } from '../../shared/types';

export async function ingest(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    badRequest(res, 'Validation failed', errors.array());
    return;
  }

  const user = (req as AuthRequest).user;
  const event = await aiEventsService.ingestEvent({ userId: user.id, ...req.body });
  created(res, event);
}

export async function getFlags(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  const flags = await aiEventsService.getFeatureFlags(user.id);
  ok(res, flags);
}
