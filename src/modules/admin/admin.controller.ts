import { Request, Response } from 'express';
import * as adminService from './admin.service';
import { ok } from '../../shared/utils/response';
import { AuthRequest } from '../../shared/types';

export async function listUsers(req: Request, res: Response): Promise<void> {
  const result = await adminService.listUsers(req.query as Record<string, unknown>);
  ok(res, result.users, undefined, { total: result.total, page: result.page, limit: result.limit });
}

export async function listIncidents(req: Request, res: Response): Promise<void> {
  const result = await adminService.listIncidentsAdmin(req.query as Record<string, unknown>);
  ok(res, result.incidents, undefined, { total: result.total, page: result.page, limit: result.limit });
}

export async function listAiEvents(req: Request, res: Response): Promise<void> {
  const result = await adminService.listAiEvents(req.query as Record<string, unknown>);
  ok(res, result.events, undefined, { total: result.total, page: result.page, limit: result.limit });
}

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const result = await adminService.listAuditLogs(req.query as Record<string, unknown>);
  ok(res, result.logs, undefined, { total: result.total, page: result.page, limit: result.limit });
}

export async function suspendUser(req: Request, res: Response): Promise<void> {
  const actor = (req as AuthRequest).user;
  await adminService.suspendUser(req.params.id, actor.id);
  ok(res, null, 'User suspended');
}
