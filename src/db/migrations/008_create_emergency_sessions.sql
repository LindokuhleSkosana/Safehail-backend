-- 008_create_emergency_sessions.sql
CREATE TYPE emergency_trigger_type AS ENUM ('manual', 'voice', 'gesture', 'hidden');
CREATE TYPE emergency_status AS ENUM (
  'pending',
  'broadcasting',
  'responder_joined',
  'en_route',
  'arrived',
  'resolved',
  'cancelled',
  'timed_out'
);

CREATE TABLE emergency_sessions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_code         VARCHAR(10) UNIQUE NOT NULL,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_type         emergency_trigger_type NOT NULL DEFAULT 'manual',
  status               emergency_status NOT NULL DEFAULT 'broadcasting',
  location_at_trigger  GEOGRAPHY(POINT, 4326),
  address_at_trigger   TEXT,
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at          TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  notes                TEXT
);

CREATE INDEX idx_emergency_sessions_user_id      ON emergency_sessions(user_id);
CREATE INDEX idx_emergency_sessions_session_code ON emergency_sessions(session_code);
CREATE INDEX idx_emergency_sessions_status       ON emergency_sessions(status);
CREATE INDEX idx_emergency_sessions_location     ON emergency_sessions USING GIST(location_at_trigger);
