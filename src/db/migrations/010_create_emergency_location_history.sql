-- 010_create_emergency_location_history.sql
CREATE TABLE emergency_location_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES emergency_sessions(id) ON DELETE CASCADE,
  location    GEOGRAPHY(POINT, 4326) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emergency_loc_history_session_id  ON emergency_location_history(session_id);
CREATE INDEX idx_emergency_loc_history_recorded_at ON emergency_location_history(recorded_at);
CREATE INDEX idx_emergency_loc_history_location    ON emergency_location_history USING GIST(location);
