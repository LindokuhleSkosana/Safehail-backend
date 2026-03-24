import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as service from './trusted-contacts.service';
import { ok, created, noContent, badRequest } from '../../shared/utils/response';
import { AuthRequest } from '../../shared/types';

function handleValidation(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    badRequest(res, 'Validation failed', errors.array());
    return false;
  }
  return true;
}

export async function list(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  const contacts = await service.listContacts(user.id);
  ok(res, contacts);
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!handleValidation(req, res)) return;
  const user = (req as AuthRequest).user;
  const contact = await service.createContact({ userId: user.id, ...req.body });
  created(res, contact);
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!handleValidation(req, res)) return;
  const user = (req as AuthRequest).user;
  const contact = await service.updateContact(req.params.contactId, user.id, req.body);
  ok(res, contact);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;
  await service.deleteContact(req.params.contactId, user.id);
  noContent(res);
}
