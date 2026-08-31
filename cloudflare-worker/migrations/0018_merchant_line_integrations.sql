-- Merchant-owned LINE OA configuration.  This migration intentionally stores
-- no provider access token and never treats an add-friend click as a friend.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS merchant_line_integrations (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  basic_id TEXT,
  display_name TEXT,
  add_friend_url TEXT,
  liff_id TEXT,
  line_login_channel_id TEXT,
  integration_mode TEXT NOT NULL DEFAULT 'add_friend_link'
    CHECK(integration_mode IN ('add_friend_link','linked_line_login','future_multi_account_liff')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS merchant_line_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('line_cta_impression','line_cta_click')),
  source TEXT NOT NULL CHECK(source IN ('menu_banner','checkout_reminder','order_success')),
  qr_context TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

-- Reserved for a future verified LINE Login link. line_user_id_hash is a
-- one-way identifier; raw LINE access tokens must never be persisted here.
CREATE TABLE IF NOT EXISTS member_line_links (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  platform_member_id TEXT NOT NULL,
  line_user_id_hash TEXT NOT NULL,
  verification_method TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,platform_member_id),
  UNIQUE(merchant_id,line_user_id_hash),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  FOREIGN KEY(platform_member_id) REFERENCES platform_members(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_merchant_line_events_merchant_created
  ON merchant_line_events(merchant_id,created_at);

CREATE TRIGGER IF NOT EXISTS trg_merchant_line_integration_updated_at
AFTER UPDATE ON merchant_line_integrations
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE merchant_line_integrations SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id;
END;
