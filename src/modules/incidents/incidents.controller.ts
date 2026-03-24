import { Request, Response } from 'express';
import * as incidentsService from './incidents.service';
import { ok } from '../../shared/utils/response';
import { AuthRequest } from '../../shared/types';

export async function list(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  const result = await incidentsService.listIncidents(user.id, req.query as Record<string, unknown>);
  ok(res, result.incidents, undefined, {
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  const incident = await incidentsService.getIncidentById(req.params.id, user.id);
  ok(res, incident);
}
