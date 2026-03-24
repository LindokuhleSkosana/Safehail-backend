-- 016_create_app_settings.sql
CREATE TABLE app_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         VARCHAR(255) UNIQUE NOT NULL,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO app_settings (key, value, description) VALUES
  ('emergency_timeout_minutes',    '30',    'Minutes before an unresolved emergency session is timed out'),
  ('nearby_responder_radius_km',   '5',     'Default radius (km) to search for nearby drivers on emergency trigger'),
  ('max_responders_per_emergency', '5',     'Maximum number of drivers notified per emergency'),
  ('otp_expires_minutes',          '5',     'OTP validity window in minutes'),
  ('otp_max_attempts',             '3',     'Max wrong OTP attempts before lockout'),
  ('trial_days',                   '14',    'Free trial period in days for new registrations');
