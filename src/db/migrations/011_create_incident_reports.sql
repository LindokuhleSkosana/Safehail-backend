-- 011_create_incident_reports.sql
CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE incident_reports (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES emergency_sessions(id) ON DELETE SET NULL,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary    TEXT NOT NULL,
  severity   incident_severity NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incident_reports_user_id    ON incident_reports(user_id);
CREATE INDEX idx_incident_reports_session_id ON incident_reports(session_id);
CREATE INDEX idx_incident_reports_severity   ON incident_reports(severity);
CREATE INDEX idx_incident_reports_created_at ON incident_reports(created_at DESC);
