-- 007_create_driver_current_locations.sql
CREATE TABLE driver_current_locations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location   GEOGRAPHY(POINT, 4326) NOT NULL,
  accuracy   FLOAT,
  heading    FLOAT,
  speed      FLOAT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- GIST index for spatial queries (ST_DWithin, ST_Distance, etc.)
CREATE INDEX idx_driver_current_locations_location ON driver_current_locations USING GIST(location);
CREATE INDEX idx_driver_current_locations_user_id  ON driver_current_locations(user_id);
