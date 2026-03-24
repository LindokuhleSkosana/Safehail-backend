import { query, withTransaction } from '../../config/db';
import { AppError } from '../../shared/middleware/error.middleware';
import { logger } from '../../shared/utils/logger';
import { generateSessionCode } from '../../shared/utils/crypto';
import { sendMulticastPush } from '../../config/firebase';
import { emitToUser, emitToRoom, getIO } from '../../sockets/socket.server';
import { scheduleEmergencyTimeout, cancelEmergencyTimeout } from '../../jobs/emergency.job';
import { EmergencyTriggerType, EmergencyStatus } from '../../shared/types';

const DEFAULT_RADIUS_KM = 5;
const MAX_RESPONDERS = 5;

export interface TriggerEmergencyInput {
  userId: string;
  triggerType: EmergencyTriggerType;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface EmergencySession {
  id: string;
  sessionCode: string;
  userId: string;
  triggerType: EmergencyTriggerType;
  status: EmergencyStatus;
  latitude: number | null;
  longitude: number | null;
  addressAtTrigger: string | null;
  startedAt: string;
  resolvedAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
  responders: EmergencyResponder[];
}

export interface EmergencyResponder {
  id: string;
  responderUserId: string;
  status: string;
  notifiedAt: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
}

export async function triggerEmergency(input: TriggerEmergencyInput): Promise<EmergencySession> {
  const { userId, triggerType, latitude, longitude, address } = input;

  // Check for already-active session
  const existing = await query<{ id: string }>(
    `SELECT id FROM emergency_sessions
     WHERE user_id = $1
       AND status IN ('pending','broadcasting','responder_joined','en_route','arrived')
     LIMIT 1`,
    [userId]
  );
  if (existing.rows.length > 0) {
    throw new AppError(409, 'ACTIVE_EMERGENCY', 'You already have an active emergency session.');
  }

  const sessionCode = generateSessionCode();

  const session = await withTransaction(async (client) => {
    // 1. Create emergency session
    const locationSql =
      latitude && longitude
        ? `ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`
        : 'NULL';

    const { rows } = await client.query<{
      id: string; session_code: string; user_id: string;
      trigger_type: string; status: string; started_at: string;
    }>(
      `INSERT INTO emergency_sessions
         (session_code, user_id, trigger_type, status, location_at_trigger, address_at_trigger)
       VALUES ($1, $2, $3, 'broadcasting', ${locationSql}, $4)
       RETURNING id, session_code, user_id, trigger_type, status, started_at`,
      [sessionCode, userId, triggerType, address ?? null]
    );

    const newSession = rows[0];

    // 2. Find nearby online drivers using PostGIS
    let nearbyDrivers: { user_id: string }[] = [];
    if (latitude && longitude) {
      const nearbyResult = await client.query<{ user_id: string }>(
        `SELECT dcl.user_id
         FROM driver_current_locations dcl
         JOIN driver_presence dp ON dp.user_id = dcl.user_id
         WHERE dp.is_online = true
           AND dcl.user_id != $1
           AND ST_DWithin(
                 dcl.location::geography,
                 ST_MakePoint($2, $3)::geography,
                 $4
               )
         LIMIT $5`,
        [userId, longitude, latitude, DEFAULT_RADIUS_KM * 1000, MAX_RESPONDERS]
      );
      nearbyDrivers = nearbyResult.rows;
    }

    // 3. Create responder records
    for (const driver of nearbyDrivers) {
      await client.query(
        `INSERT INTO emergency_responders (session_id, responder_user_id, status)
         VALUES ($1, $2, 'notified')
         ON CONFLICT DO NOTHING`,
        [newSession.id, driver.user_id]
      );
    }

    // 4. Audit log
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'emergency.triggered', 'emergency_sessions', $2, $3)`,
      [
        userId,
        newSession.id,
        JSON.stringify({ triggerType, sessionCode, nearbyCount: nearbyDrivers.length }),
      ]
    );

    return { session: newSession, nearbyDrivers };
  });

  // 5. Send FCM high-priority push to each nearby driver (outside transaction)
  const { session: sess, nearbyDrivers } = session;

  if (nearbyDrivers.length > 0) {
    const responderUserIds = nearbyDrivers.map((d) => d.user_id);

    // Fetch their FCM tokens
    if (responderUserIds.length > 0) {
      const tokenResult = await query<{ user_id: string; token: string }>(
        `SELECT user_id, token FROM device_tokens WHERE user_id = ANY($1::uuid[])`,
        [responderUserIds]
      );

      const tokens = tokenResult.rows.map((r) => r.token);
      if (tokens.length > 0) {
        const { successCount, failureCount } = await sendMulticastPush({
          tokens,
          title: '🚨 Emergency Alert — Driver Needs Help',
          body: `A driver near you has triggered an emergency. Tap to respond.`,
          data: {
            type: 'emergency_new',
            sessionId: sess.id,
            sessionCode: sess.session_code,
          },
          priority: 'high',
        });
        logger.info('FCM sent to responders', { successCount, failureCount, sessionId: sess.id });
      }
    }

    // 6. Emit socket event to nearby online drivers
    const io = getIO();
    for (const driver of nearbyDrivers) {
      io.to(`driver:${driver.user_id}`).emit('emergency:new', {
        sessionId: sess.id,
        sessionCode: sess.session_code,
        userId,
        triggerType: sess.trigger_type,
        latitude: latitude ?? 0,
        longitude: longitude ?? 0,
        address,
        startedAt: sess.started_at,
      });
    }
  }

  // 7. Notify trusted contacts via FCM
  const trustedContacts = await query<{ name: string; phone: string }>(
    `SELECT name, phone FROM trusted_contacts WHERE user_id = $1 AND notify_on_emergency = true`,
    [userId]
  );

  if (trustedContacts.rows.length > 0) {
    // Get their FCM tokens if they're registered users
    for (const contact of trustedContacts.rows) {
      const contactUser = await query<{ id: string }>(
        'SELECT id FROM users WHERE phone = $1',
        [contact.phone]
      );
      if (contactUser.rows[0]) {
        const tokens = await query<{ token: string }>(
          'SELECT token FROM device_tokens WHERE user_id = $1',
          [contactUser.rows[0].id]
        );
        if (tokens.rows.length > 0) {
          await sendMulticastPush({
            tokens: tokens.rows.map((r) => r.token),
            title: '🚨 Emergency Alert',
            body: `Your contact triggered an emergency. Session: ${sess.session_code}`,
            data: { type: 'trusted_contact_emergency', sessionId: sess.id },
            priority: 'high',
          });
        }
      }
    }
  }

  // 8. Schedule session timeout
  await scheduleEmergencyTimeout(sess.id);

  // 9. Store initial location history if provided
  if (latitude && longitude) {
    await query(
      `INSERT INTO emergency_location_history (session_id, location, recorded_at)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, NOW())`,
      [sess.id, longitude, latitude]
    );
  }

  logger.info('Emergency triggered', {
    sessionId: sess.id,
    sessionCode: sess.session_code,
    userId,
    nearbyResponders: nearbyDrivers.length,
  });

  return getSessionById(sess.id);
}

export async function cancelSession(sessionId: string, userId: string): Promise<EmergencySession> {
  const result = await query<{ id: string; status: EmergencyStatus; user_id: string }>(
    'SELECT id, status, user_id FROM emergency_sessions WHERE id = $1',
    [sessionId]
  );

  const sess = result.rows[0];
  if (!sess) throw new AppError(404, 'SESSION_NOT_FOUND', 'Emergency session not found');
  if (sess.user_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Not your emergency session');

  const cancellableStatuses: EmergencyStatus[] = ['broadcasting', 'pending', 'responder_joined'];
  if (!cancellableStatuses.includes(sess.status)) {
    throw new AppError(409, 'CANNOT_CANCEL', `Cannot cancel a session with status: ${sess.status}`);
  }

  await query(
    `UPDATE emergency_sessions
     SET status = 'cancelled', cancelled_at = NOW()
     WHERE id = $1`,
    [sessionId]
  );

  await cancelEmergencyTimeout(sessionId);

  emitToRoom(`emergency:${sessionId}`, 'emergency:status_changed', {
    sessionId,
    status: 'cancelled',
    updatedAt: new Date().toISOString(),
  });

  await query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id)
     VALUES ($1, 'emergency.cancelled', 'emergency_sessions', $2)`,
    [userId, sessionId]
  );

  return getSessionById(sessionId);
}

export async function resolveSession(
  sessionId: string,
  userId: string,
  notes?: string
): Promise<EmergencySession> {
  const result = await query<{ id: string; status: EmergencyStatus; user_id: string }>(
    'SELECT id, status, user_id FROM emergency_sessions WHERE id = $1',
    [sessionId]
  );

  const sess = result.rows[0];
  if (!sess) throw new AppError(404, 'SESSION_NOT_FOUND', 'Emergency session not found');
  if (sess.user_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Not your emergency session');

  const resolvableStatuses: EmergencyStatus[] = [
    'broadcasting', 'responder_joined', 'en_route', 'arrived',
  ];
  if (!resolvableStatuses.includes(sess.status)) {
    throw new AppError(409, 'CANNOT_RESOLVE', `Cannot resolve session with status: ${sess.status}`);
  }

  await query(
    `UPDATE emergency_sessions
     SET status = 'resolved', resolved_at = NOW(), notes = COALESCE($2, notes)
     WHERE id = $1`,
    [sessionId, notes ?? null]
  );

  await cancelEmergencyTimeout(sessionId);

  emitToRoom(`emergency:${sessionId}`, 'emergency:status_changed', {
    sessionId,
    status: 'resolved',
    updatedAt: new Date().toISOString(),
  });

  await query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id)
     VALUES ($1, 'emergency.resolved', 'emergency_sessions', $2)`,
    [userId, sessionId]
  );

  return getSessionById(sessionId);
}

export async function getSessionById(sessionId: string): Promise<EmergencySession> {
  const sessionResult = await query<{
    id: string; session_code: string; user_id: string; trigger_type: string;
    status: string; latitude: number | null; longitude: number | null;
    address_at_trigger: string | null; started_at: string;
    resolved_at: string | null; cancelled_at: string | null; notes: string | null;
  }>(
    `SELECT
       id, session_code, user_id, trigger_type, status,
       ST_Y(location_at_trigger::geometry) AS latitude,
       ST_X(location_at_trigger::geometry) AS longitude,
       address_at_trigger, started_at, resolved_at, cancelled_at, notes
     FROM emergency_sessions WHERE id = $1`,
    [sessionId]
  );

  if (!sessionResult.rows[0]) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Emergency session not found');
  }

  const respondersResult = await query<{
    id: string; responder_user_id: string; status: string;
    notified_at: string; accepted_at: string | null; arrived_at: string | null;
  }>(
    'SELECT id, responder_user_id, status, notified_at, accepted_at, arrived_at FROM emergency_responders WHERE session_id = $1',
    [sessionId]
  );

  const s = sessionResult.rows[0];
  return {
    id: s.id,
    sessionCode: s.session_code,
    userId: s.user_id,
    triggerType: s.trigger_type as EmergencyTriggerType,
    status: s.status as EmergencyStatus,
    latitude: s.latitude,
    longitude: s.longitude,
    addressAtTrigger: s.address_at_trigger,
    startedAt: s.started_at,
    resolvedAt: s.resolved_at,
    cancelledAt: s.cancelled_at,
    notes: s.notes,
    responders: respondersResult.rows.map((r) => ({
      id: r.id,
      responderUserId: r.responder_user_id,
      status: r.status,
      notifiedAt: r.notified_at,
      acceptedAt: r.accepted_at,
      arrivedAt: r.arrived_at,
    })),
  };
}

export async function pushLocationUpdate(
  sessionId: string,
  userId: string,
  latitude: number,
  longitude: number
): Promise<void> {
  const session = await query<{ status: string; user_id: string }>(
    'SELECT status, user_id FROM emergency_sessions WHERE id = $1',
    [sessionId]
  );

  if (!session.rows[0]) throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
  if (session.rows[0].user_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Not your session');

  const activeStatuses = ['broadcasting', 'responder_joined', 'en_route', 'arrived'];
  if (!activeStatuses.includes(session.rows[0].status)) {
    throw new AppError(409, 'SESSION_INACTIVE', 'Session is not active');
  }

  await query(
    `INSERT INTO emergency_location_history (session_id, location, recorded_at)
     VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, NOW())`,
    [sessionId, longitude, latitude]
  );

  emitToRoom(`emergency:${sessionId}`, 'emergency:location_update', {
    sessionId,
    latitude,
    longitude,
    recordedAt: new Date().toISOString(),
  });
}
