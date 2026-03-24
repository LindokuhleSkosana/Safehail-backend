import { query } from '../../config/db';

export interface LocationUpdateInput {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

export async function updateLocation(input: LocationUpdateInput): Promise<void> {
  const { userId, latitude, longitude, accuracy, heading, speed } = input;

  await query(
    `INSERT INTO driver_current_locations
       (user_id, location, accuracy, heading, speed, updated_at)
     VALUES (
       $1,
       ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
       $4, $5, $6, NOW()
     )
     ON CONFLICT (user_id) DO UPDATE SET
       location   = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
       accuracy   = $4,
       heading    = $5,
       speed      = $6,
       updated_at = NOW()`,
    [userId, longitude, latitude, accuracy ?? null, heading ?? null, speed ?? null]
  );
}
