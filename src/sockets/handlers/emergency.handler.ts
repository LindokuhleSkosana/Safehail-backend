import { Socket, Server } from 'socket.io';
import { query } from '../../config/db';
import { logger } from '../../shared/utils/logger';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../socket.types';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerEmergencyHandlers(socket: AppSocket, io: AppServer): void {
  const userId = socket.data.userId;

  socket.on('emergency:location_update', async (data, callback) => {
    try {
      const { sessionId, latitude, longitude } = data;

      if (typeof latitude !== 'number' || typeof longitude !== 'number' || !sessionId) {
        callback?.({ ok: false, error: 'Invalid data' });
        return;
      }

      // Verify this user owns the session and it's active
      const session = await query<{ id: string; status: string }>(
        `SELECT id, status FROM emergency_sessions
         WHERE id = $1 AND user_id = $2`,
        [sessionId, userId]
      );

      if (!session.rows[0]) {
        callback?.({ ok: false, error: 'Session not found' });
        return;
      }

      const activeStatuses = ['broadcasting', 'responder_joined', 'en_route', 'arrived'];
      if (!activeStatuses.includes(session.rows[0].status)) {
        callback?.({ ok: false, error: 'Session is not active' });
        return;
      }

      // Store location history
      await query(
        `INSERT INTO emergency_location_history (session_id, location, recorded_at)
         VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, NOW())`,
        [sessionId, longitude, latitude]
      );

      // Also update current location
      await query(
        `INSERT INTO driver_current_locations (user_id, location, updated_at)
         VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           location   = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
           updated_at = NOW()`,
        [userId, longitude, latitude]
      );

      // Broadcast to responders in the session room
      const now = new Date().toISOString();
      io.to(`emergency:${sessionId}`).emit('emergency:location_update', {
        sessionId,
        latitude,
        longitude,
        recordedAt: now,
      });

      callback?.({ ok: true });
    } catch (err) {
      logger.error('emergency:location_update error', { userId, error: (err as Error).message });
      callback?.({ ok: false, error: 'Failed to update emergency location' });
    }
  });
}
