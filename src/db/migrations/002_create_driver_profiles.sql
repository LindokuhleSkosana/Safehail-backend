-- 002_create_driver_profiles.sql
CREATE TYPE ride_platform AS ENUM ('uber', 'bolt', 'other');

CREATE TABLE driver_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name           VARCHAR(255) NOT NULL,
  id_number           VARCHAR(20),
  avatar_url          TEXT,
  vehicle_make        VARCHAR(100),
  vehicle_model       VARCHAR(100),
  vehicle_color       VARCHAR(50),
  license_plate       VARCHAR(20),
  platform            ride_platform NOT NULL DEFAULT 'other',
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_driver_profiles_user_id ON driver_profiles(user_id);
