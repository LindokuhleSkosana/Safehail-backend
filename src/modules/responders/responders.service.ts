import { query } from '../../config/db';
import { AppError } from '../../shared/middleware/error.middleware';
import { emitToUser, emitToRoom, getIO } from '../../sockets/socket.server';
import { logger } from '../../shared/utils/logger';

async function getResponderRecord(
  sessionId: string,
  responderUserId: string
): Promise<{ id: string; status: string; session_status: string; session_user_id: string }> {
  const result = await query<{
    id: string; status: string; session_status: string; session_user_id: string;
  }>(
    `SELECT er.id, er.status, es.status AS session_status, es.user_id AS session_user_id
     FROM emergency_responders er
     JOIN emergency_sessions es ON es.id = er.session_id
     WHERE er.session_id = $1 AND er.responder_user_id = $2`,
    [sessionId, responderUserId]
  );

  if (!result.rows[0]) {
    throw new AppError(404, 'RESPONDER_NOT_FOUND', 'You are not a responder for this session');
  }
  return result.rows[0];
}

export async function acceptSession(sessionId: string, responderUserId: string): Promise<void> {
  const record = await getResponderRecord(sessionId, responderUserId);

  if (!['notified'].includes(record.status)) {
    throw new AppError(409, 'ALREADY_RESPONDED', `Already responded: ${record.status}`);
  }

  const activeSessionStatuses = ['broadcasting', 'pending'];
  if (!activeSessionStatuses.includes(record.session_status)) {
    throw new AppError(409, 'SESSION_INACTIVE', 'Emergency session is no longer accepting responders');
  }

  await query(
    `UPDATE emergency_responders
     SET status = 'accepted', accepted_at = NOW()
     WHERE session_id = $1 AND responder_user_id = $2`,
    [sessionId, responderUserId]
  );

  // Update session status to responder_joined if still broadcasting
  await query(
    `UPDATE emergency_sessions
     SET status = 'responder_joined'
     WHERE id = $1 AND status = 'broadcasting'`,
    [sessionId]
  );

  // Join the session room for real-time updates
  const io = getIO();
  const sockets = await io.in(`driver:${responderUserId}`).fetchSockets();
  for (const socket of sockets) {
    socket.join(`emergency:${sessionId}`);
  }

  // Notify the driver in emergency
  emitToUser(record.session_user_id, 'emergency:responder_accepted', {
    sessionId,
    responderUserId,
    acceptedAt: new Date().toISOString(),
  });

  // Broadcast status change
  emitToRoom(`emergency:${sessionId}`, 'emergency:status_changed', {
    sessionId,
    status: 'responder_joined',
    updatedAt: new Date().toISOString(),
  });

  logger.info('Responder accepted emergency', { sessionId, responderUserId });
}

export async function declineSession(sessionId: string, responderUserId: string): Promise<void> {
  const record = await getResponderRecord(sessionId, responderUserId);

  if (!['notified', 'accepted'].includes(record.status)) {
    throw new AppError(409, 'CANNOT_DECLINE', `Cannot decline from status: ${record.status}`);
  }

  await query(
    `UPDATE emergency_responders
     SET status = 'declined'
     WHERE session_id = $1 AND responder_user_id = $2`,
    [sessionId, responderUserId]
  );

  logger.info('Responder declined emergency', { sessionId, responderUserId });
}

export async function markArrived(sessionId: string, responderUserId: string): Promise<void> {
  const record = await getResponderRecord(sessionId, responderUserId);

  if (!['accepted', 'en_route'].includes(record.status)) {
    throw new AppError(409, 'CANNOT_MARK_ARRIVED', `Cannot mark arrived from status: ${record.status}`);
  }

  await query(
    `UPDATE emergency_responders
     SET status = 'arrived', arrived_at = NOW()
     WHERE session_id = $1 AND responder_user_id = $2`,
    [sessionId, responderUserId]
  );

  await query(
    `UPDATE emergency_sessions SET status = 'arrived' WHERE id = $1`,
    [sessionId]
  );

  emitToRoom(`emergency:${sessionId}`, 'emergency:status_changed', {
    sessionId,
    status: 'arrived',
    updatedAt: new Date().toISOString(),
  });

  logger.info('Responder arrived at emergency', { sessionId, responderUserId });
}
