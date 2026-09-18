ALTER TABLE owner_documents ADD COLUMN size INTEGER NOT NULL DEFAULT 0 CHECK(size >= 0);

ALTER TABLE owner_system_monitors ADD COLUMN response_latency_ms INTEGER;
ALTER TABLE owner_system_monitors ADD COLUMN last_success_at TEXT;
ALTER TABLE owner_system_monitors ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS owner_monitor_checks (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  http_status INTEGER,
  response_latency_ms INTEGER,
  ssl_status TEXT NOT NULL CHECK(ssl_status IN ('VALID','EXPIRING','INVALID','UNKNOWN')),
  health_status TEXT NOT NULL CHECK(health_status IN ('HEALTHY','WARNING','DOWN','UNKNOWN')),
  error_code TEXT,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_owner_monitor_checks_merchant ON owner_monitor_checks(merchant_id,checked_at DESC);
