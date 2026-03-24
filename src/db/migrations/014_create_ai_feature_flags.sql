-- 014_create_ai_feature_flags.sql
CREATE TABLE ai_feature_flags (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flag_key            VARCHAR(100) UNIQUE NOT NULL,
  enabled             BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage  INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  description         TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default flags
INSERT INTO ai_feature_flags (flag_key, enabled, rollout_percentage, description) VALUES
  ('voice_trigger_detection',   false, 0,   'AI voice command detection for emergency trigger'),
  ('gesture_detection',         false, 0,   'Motion gesture detection for silent emergency trigger'),
  ('anomaly_detection',         false, 0,   'Route and behaviour anomaly detection'),
  ('ai_emergency_auto_trigger', false, 0,   'Automatically trigger emergency based on AI confidence');
