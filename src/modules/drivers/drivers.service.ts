import { query } from '../../config/db';
import { AppError } from '../../shared/middleware/error.middleware';
import { Platform, RidePlatform } from '../../shared/types';
import { logger } from '../../shared/utils/logger';

export interface UpsertProfileInput {
  userId: string;
  fullName: string;
  idNumber?: string;
  avatarUrl?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  licensePlate?: string;
  platform?: RidePlatform;
}

export interface DriverProfile {
  id: string;
  userId: string;
  fullName: string;
  idNumber: string | null;
  avatarUrl: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  licensePlate: string | null;
  platform: RidePlatform;
  onboardingComplete: boolean;
  createdAt: string;
}

export async function upsertProfile(input: UpsertProfileInput): Promise<DriverProfile> {
  const {
    userId, fullName, idNumber, avatarUrl,
    vehicleMake, vehicleModel, vehicleColor,
    licensePlate, platform = 'other',
  } = input;

  const onboardingComplete = !!(
    fullName && vehicleMake && vehicleModel && vehicleColor && licensePlate
  );

  const result = await query<{
    id: string; user_id: string; full_name: string; id_number: string | null;
    avatar_url: string | null; vehicle_make: string | null; vehicle_model: string | null;
    vehicle_color: string | null; license_plate: string | null; platform: RidePlatform;
    onboarding_complete: boolean; created_at: string;
  }>(
    `INSERT INTO driver_profiles
       (user_id, full_name, id_number, avatar_url, vehicle_make, vehicle_model,
        vehicle_color, license_plate, platform, onboarding_complete)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (user_id) DO UPDATE SET
       full_name           = EXCLUDED.full_name,
       id_number           = COALESCE(EXCLUDED.id_number, driver_profiles.id_number),
       avatar_url          = COALESCE(EXCLUDED.avatar_url, driver_profiles.avatar_url),
       vehicle_make        = COALESCE(EXCLUDED.vehicle_make, driver_profiles.vehicle_make),
       vehicle_model       = COALESCE(EXCLUDED.vehicle_model, driver_profiles.vehicle_model),
       vehicle_color       = COALESCE(EXCLUDED.vehicle_color, driver_profiles.vehicle_color),
       license_plate       = COALESCE(EXCLUDED.license_plate, driver_profiles.license_plate),
       platform            = EXCLUDED.platform,
       onboarding_complete = EXCLUDED.onboarding_complete
     RETURNING *`,
    [
      userId, fullName, idNumber ?? null, avatarUrl ?? null,
      vehicleMake ?? null, vehicleModel ?? null, vehicleColor ?? null,
      licensePlate ?? null, platform, onboardingComplete,
    ]
  );

  return mapProfile(result.rows[0]);
}

export async function getProfile(userId: string): Promise<DriverProfile> {
  const result = await query<{
    id: string; user_id: string; full_name: string; id_number: string | null;
    avatar_url: string | null; vehicle_make: string | null; vehicle_model: string | null;
    vehicle_color: string | null; license_plate: string | null; platform: RidePlatform;
    onboarding_complete: boolean; created_at: string;
  }>('SELECT * FROM driver_profiles WHERE user_id = $1', [userId]);

  if (!result.rows[0]) {
    throw new AppError(404, 'PROFILE_NOT_FOUND', 'Driver profile not found');
  }
  return mapProfile(result.rows[0]);
}

export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: Platform
): Promise<void> {
  // Remove any existing token entry for this token (could be from another user after re-install)
  await query('DELETE FROM device_tokens WHERE token = $1 AND user_id != $2', [token, userId]);

  await query(
    `INSERT INTO device_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE SET platform = EXCLUDED.platform`,
    [userId, token, platform]
  );
  logger.debug('Device token registered', { userId, platform });
}

function mapProfile(row: {
  id: string; user_id: string; full_name: string; id_number: string | null;
  avatar_url: string | null; vehicle_make: string | null; vehicle_model: string | null;
  vehicle_color: string | null; license_plate: string | null; platform: RidePlatform;
  onboarding_complete: boolean; created_at: string;
}): DriverProfile {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    idNumber: row.id_number,
    avatarUrl: row.avatar_url,
    vehicleMake: row.vehicle_make,
    vehicleModel: row.vehicle_model,
    vehicleColor: row.vehicle_color,
    licensePlate: row.license_plate,
    platform: row.platform,
    onboardingComplete: row.onboarding_complete,
    createdAt: row.created_at,
  };
}
