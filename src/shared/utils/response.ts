import { Response } from 'express';

interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function ok<T>(res: Response, data: T, message?: string, meta?: Record<string, unknown>): void {
  const body: SuccessResponse<T> = { success: true, data };
  if (message) body.message = message;
  if (meta) body.meta = meta;
  res.status(200).json(body);
}

export function created<T>(res: Response, data: T, message?: string): void {
  res.status(201).json({ success: true, data, message } as SuccessResponse<T>);
}

export function noContent(res: Response): void {
  res.status(204).send();
}

export function badRequest(res: Response, message: string, details?: unknown): void {
  res.status(400).json({
    success: false,
    error: { code: 'BAD_REQUEST', message, details },
  } as ErrorResponse);
}

export function unauthorized(res: Response, message = 'Unauthorized'): void {
  res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message },
  } as ErrorResponse);
}

export function forbidden(res: Response, message = 'Forbidden'): void {
  res.status(403).json({
    success: false,
    error: { code: 'FORBIDDEN', message },
  } as ErrorResponse);
}

export function notFound(res: Response, message = 'Not found'): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message },
  } as ErrorResponse);
}

export function conflict(res: Response, message: string): void {
  res.status(409).json({
    success: false,
    error: { code: 'CONFLICT', message },
  } as ErrorResponse);
}

export function tooManyRequests(res: Response, message = 'Rate limit exceeded'): void {
  res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message },
  } as ErrorResponse);
}

export function internalError(res: Response, message = 'Internal server error'): void {
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message },
  } as ErrorResponse);
}
