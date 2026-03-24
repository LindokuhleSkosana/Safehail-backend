-- 009_create_emergency_responders.sql
CREATE TYPE responder_status AS ENUM ('notified', 'accepted', 'declined', 'en_route', 'arrived', 'withdrew');

CREATE TABLE emergency_responders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES emergency_sessions(id) ON DELETE CASCADE,
  responder_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status            responder_status NOT NULL DEFAULT 'notified',
  notified_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at       TIMESTAMPTZ,
  arrived_at        TIMESTAMPTZ,
  UNIQUE(session_id, responder_user_id)
);

CREATE INDEX idx_emergency_responders_session_id        ON emergency_responders(session_id);
CREATE INDEX idx_emergency_responders_responder_user_id ON emergency_responders(responder_user_id);
CREATE INDEX idx_emergency_responders_status            ON emergency_responders(status);
