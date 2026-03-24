import { query } from '../../config/db';
import { logger } from '../../shared/utils/logger';

export interface NearbyDriver {
  userId: string;
  distanceMeters: number;
  latitude: number;
  longitude: number;
  lastSeenAt: string | null;
}

export async function setOnline(userId: string, socketId?: string): Promise<void> {
  await query(
    `INSERT INTO driver_presence (user_id, is_online, last_seen_at, socket_id)
     VALUES ($1, true, NOW(), $2)
     ON CONFLICT (user_id) DO UPDATE SET
       is_online    = true,
       last_seen_at = NOW(),
       socket_id    = COALESCE($2, driver_presence.socket_id),
       updated_at   = NOW()`,
    [userId, socketId ?? null]
  );
  logger.debug('Driver went online', { userId });
}

export async function setOffline(userId: string): Promise<void> {
  await query(
    `INSERT INTO driver_presence (user_id, is_online, last_seen_at)
     VALUES ($1, false, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       is_online    = false,
       last_seen_at = NOW(),
       socket_id    = NULL,
       updated_at   = NOW()`,
    [userId]
  );
  logger.debug('Driver went offline', { userId });
}

export async function updateSocketId(userId: string, socketId: string): Promise<void> {
  await query(
    `INSERT INTO driver_presence (user_id, is_online, socket_id, last_seen_at)
     VALUES ($1, true, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       socket_id  = $2,
       updated_at = NOW()`,
    [userId, socketId]
  );
}

export async function getNearbyOnlineDrivers(
  latitude: number,
  longitude: number,
  radiusKm: number
): Promise<NearbyDriver[]> {
  const radiusMeters = radiusKm * 1000;

  const result = await query<{
    user_id: string;
    distance_meters: number;
    latitude: number;
    longitude: number;
    last_seen_at: string | null;
  }>(
    `SELECT
       dcl.user_id,
       ST_Distance(dcl.location::geography, ST_MakePoint($1, $2)::geography) AS distance_meters,
       ST_Y(dcl.location::geometry) AS latitude,
       ST_X(dcl.location::geometry) AS longitude,
       dp.last_seen_at
     FROM driver_current_locations dcl
     JOIN driver_presence dp ON dp.user_id = dcl.user_id
     WHERE dp.is_online = true
       AND ST_DWithin(
             dcl.location::geography,
             ST_MakePoint($1, $2)::geography,
             $3
           )
     ORDER BY distance_meters`,
    [longitude, latitude, radiusMeters]
  );

  return result.rows.map((r) => ({
    userId: r.user_id,
    distanceMeters: r.distance_meters,
    latitude: r.latitude,
    longitude: r.longitude,
    lastSeenAt: r.last_seen_at,
  }));
}
