-- 012_create_notification_logs.sql
CREATE TYPE notification_delivery_status AS ENUM ('sent', 'failed', 'delivered');

CREATE TABLE notification_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(100) NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  delivery_status notification_delivery_status NOT NULL DEFAULT 'sent',
  fcm_message_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_user_id    ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX idx_notification_logs_type       ON notification_logs(type);
