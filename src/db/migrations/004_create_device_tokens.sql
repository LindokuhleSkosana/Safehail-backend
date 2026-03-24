-- 004_create_device_tokens.sql
CREATE TYPE device_platform AS ENUM ('android', 'ios');

CREATE TABLE device_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   device_platform NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token)
);

CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);
