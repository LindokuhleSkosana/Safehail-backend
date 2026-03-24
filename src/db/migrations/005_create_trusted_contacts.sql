-- 005_create_trusted_contacts.sql
CREATE TABLE trusted_contacts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                VARCHAR(255) NOT NULL,
  phone               VARCHAR(20) NOT NULL,
  relationship        VARCHAR(100),
  notify_on_emergency BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trusted_contacts_user_id ON trusted_contacts(user_id);
