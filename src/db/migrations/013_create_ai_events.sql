-- 013_create_ai_events.sql
CREATE TYPE ai_event_type AS ENUM ('voice_trigger', 'gesture_trigger', 'anomaly');

CREATE TABLE ai_events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type          ai_event_type NOT NULL,
  raw_signal          JSONB,
  confidence          FLOAT,
  action_taken        TEXT,
  flagged_for_review  BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_events_user_id           ON ai_events(user_id);
CREATE INDEX idx_ai_events_event_type        ON ai_events(event_type);
CREATE INDEX idx_ai_events_flagged_for_review ON ai_events(flagged_for_review) WHERE flagged_for_review = true;
CREATE INDEX idx_ai_events_created_at        ON ai_events(created_at DESC);
