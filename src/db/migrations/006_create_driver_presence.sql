-- 006_create_driver_presence.sql
CREATE TABLE driver_presence (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_online    BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  socket_id    VARCHAR(255),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_driver_presence_user_id   ON driver_presence(user_id);
CREATE INDEX idx_driver_presence_is_online ON driver_presence(is_online);
