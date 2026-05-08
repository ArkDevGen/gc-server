-- Migration 013: Audit Log (SOC 2)
-- Immutable record of security-relevant actions across the system

CREATE TABLE audit_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  username      VARCHAR(50),
  action        VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id   UUID,
  ip_address    INET,
  metadata      JSONB
);

-- Fast lookups by user, time, and action type for audit reports
CREATE INDEX idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action     ON audit_logs(action);
