-- Shared merchant AI configuration, monthly usage, idempotency and abuse controls.
-- Historical usage is retained by (merchant_id, period_month); no monthly reset job is required.
CREATE TABLE IF NOT EXISTS merchant_ai_settings (
  merchant_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0, 1)),
  monthly_reply_limit INTEGER NOT NULL DEFAULT 60 CHECK(monthly_reply_limit >= 0),
  model TEXT NOT NULL,
  max_output_tokens INTEGER NOT NULL DEFAULT 300 CHECK(max_output_tokens BETWEEN 64 AND 2000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_ai_usage (
  merchant_id TEXT NOT NULL,
  period_month TEXT NOT NULL,
  total_used INTEGER NOT NULL DEFAULT 0 CHECK(total_used >= 0),
  line_used INTEGER NOT NULL DEFAULT 0 CHECK(line_used >= 0),
  website_used INTEGER NOT NULL DEFAULT 0 CHECK(website_used >= 0),
  reserved_count INTEGER NOT NULL DEFAULT 0 CHECK(reserved_count >= 0),
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK(input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK(output_tokens >= 0),
  estimated_cost REAL NOT NULL DEFAULT 0 CHECK(estimated_cost >= 0),
  low_quota_alerted INTEGER NOT NULL DEFAULT 0 CHECK(low_quota_alerted IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (merchant_id, period_month),
  FOREIGN KEY (merchant_id) REFERENCES merchant_ai_settings(merchant_id)
);

CREATE TABLE IF NOT EXISTS merchant_ai_logs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('line', 'website', 'system', 'admin')),
  request_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'AI_REPLY',
  status TEXT NOT NULL DEFAULT 'received',
  success INTEGER NOT NULL DEFAULT 0 CHECK(success IN (0, 1)),
  deducted INTEGER NOT NULL DEFAULT 0 CHECK(deducted IN (0, 1)),
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost REAL NOT NULL DEFAULT 0,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (merchant_id, channel, request_id)
);

CREATE TABLE IF NOT EXISTS merchant_ai_rate_limits (
  rate_key TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK(request_count >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rate_key, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_merchant_ai_usage_period
  ON merchant_ai_usage(period_month, merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_ai_logs_merchant_created
  ON merchant_ai_logs(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_ai_logs_status
  ON merchant_ai_logs(merchant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_ai_rate_limits_updated
  ON merchant_ai_rate_limits(updated_at);

INSERT OR IGNORE INTO merchant_ai_settings (
  merchant_id, enabled, monthly_reply_limit, model, max_output_tokens
) VALUES (
  'meiling_patchwork', 1, 60, 'gpt-5.6-luna', 300
);

