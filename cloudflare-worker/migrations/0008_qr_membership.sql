-- Shared scan-to-membership module. All customer and merchant authorization is server-side.
CREATE TABLE IF NOT EXISTS platform_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_public_profiles (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  contact_url TEXT,
  enabled_actions TEXT NOT NULL DEFAULT '["MERCHANT_HOME"]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_admins (
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  user_id TEXT NOT NULL REFERENCES platform_users(id),
  role TEXT NOT NULL DEFAULT 'manager' CHECK(role IN ('owner','manager')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (merchant_id, user_id)
);

CREATE TABLE IF NOT EXISTS merchant_memberships (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  user_id TEXT NOT NULL REFERENCES platform_users(id),
  member_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  member_level TEXT NOT NULL DEFAULT 'standard',
  points INTEGER NOT NULL DEFAULT 0 CHECK(points >= 0),
  joined_via TEXT NOT NULL CHECK(joined_via IN ('QR_CODE','DIRECT','ADMIN')),
  joined_at TEXT NOT NULL,
  branch_id TEXT,
  campaign_id TEXT,
  consent_version TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (merchant_id, user_id)
);

CREATE TABLE IF NOT EXISTS merchant_qr_codes (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  branch_id TEXT,
  name TEXT NOT NULL,
  qr_type TEXT NOT NULL DEFAULT 'MEMBERSHIP' CHECK(qr_type IN ('MEMBERSHIP')),
  table_no TEXT,
  action TEXT NOT NULL CHECK(action IN ('ORDER','BOOKING','COUPON','SHOP','MEMBER_CARD','MERCHANT_HOME')),
  redirect_target TEXT NOT NULL CHECK(redirect_target IN ('ORDER','BOOKING','COUPON','SHOP','MEMBER_CARD','MERCHANT_HOME')),
  token_nonce TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  campaign_id TEXT,
  reward_points INTEGER NOT NULL DEFAULT 0 CHECK(reward_points >= 0),
  coupon_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  expires_at TEXT,
  created_by TEXT REFERENCES platform_users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_qr_scan_events (
  id TEXT PRIMARY KEY,
  qr_code_id TEXT NOT NULL REFERENCES merchant_qr_codes(id),
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  user_id TEXT REFERENCES platform_users(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('scan','joined','already_member','opened_target')),
  visitor_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_merchant_memberships_merchant ON merchant_memberships(merchant_id, status, joined_at);
CREATE INDEX IF NOT EXISTS idx_merchant_qr_codes_merchant ON merchant_qr_codes(merchant_id, is_active, created_at);
CREATE INDEX IF NOT EXISTS idx_merchant_qr_events_qr ON merchant_qr_scan_events(qr_code_id, created_at);
CREATE INDEX IF NOT EXISTS idx_merchant_qr_events_merchant ON merchant_qr_scan_events(merchant_id, created_at);

INSERT OR IGNORE INTO merchant_public_profiles (merchant_id, slug, enabled_actions)
VALUES ('merchant_meiling_001', 'meiling-patchwork', '["MERCHANT_HOME"]');
