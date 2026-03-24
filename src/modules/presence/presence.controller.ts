import { Request, Response } from 'express';
import * as presenceService from './presence.service';
import { ok, badRequest } from '../../shared/utils/response';
import { AuthRequest } from '../../shared/types';

export async function goOnline(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  await presenceService.setOnline(user.id);
  ok(res, { isOnline: true }, 'You are now online');
}

export async function goOffline(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  await presenceService.setOffline(user.id);
  ok(res, { isOnline: false }, 'You are now offline');
}

export async function getNearby(req: Request, res: Response): Promise<void> {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radius = parseFloat((req.query.radius as string) ?? '5');

  if (isNaN(lat) || isNaN(lng)) {
    badRequest(res, 'lat and lng query parameters are required');
    return;
  }
  if (radius <= 0 || radius > 50) {
    badRequest(res, 'radius must be between 0 and 50 km');
    return;
  }

  const drivers = await presenceService.getNearbyOnlineDrivers(lat, lng, radius);
  ok(res, { drivers, count: drivers.length });
}
