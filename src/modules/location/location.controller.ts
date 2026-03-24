import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as locationService from './location.service';
import { ok, badRequest } from '../../shared/utils/response';
import { AuthRequest } from '../../shared/types';

export async function updateLocation(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    badRequest(res, 'Validation failed', errors.array());
    return;
  }

  const user = (req as AuthRequest).user;
  await locationService.updateLocation({ userId: user.id, ...req.body });
  ok(res, null, 'Location updated');
}
