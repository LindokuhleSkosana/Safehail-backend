import { Request, Response } from 'express';
import * as respondersService from './responders.service';
import { ok } from '../../shared/utils/response';
import { AuthRequest } from '../../shared/types';

export async function accept(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  await respondersService.acceptSession(req.params.sessionId, user.id);
  ok(res, null, 'Emergency accepted — joining session');
}

export async function decline(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  await respondersService.declineSession(req.params.sessionId, user.id);
  ok(res, null, 'Emergency declined');
}

export async function arrived(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  await respondersService.markArrived(req.params.sessionId, user.id);
  ok(res, null, 'Marked as arrived');
}
