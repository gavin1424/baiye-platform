PRAGMA foreign_keys = ON;

ALTER TABLE ordering_customers ADD COLUMN privacy_consent_version TEXT;
ALTER TABLE ordering_customers ADD COLUMN privacy_consented_at TEXT;

CREATE TABLE platform_members (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE,
  member_no TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','blocked','closed')),
  joined_source TEXT NOT NULL CHECK(joined_source IN ('phone','qr','partner_contract','merchant_contract','admin')),
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT,
  phone_verified INTEGER NOT NULL DEFAULT 0 CHECK(phone_verified IN (0,1)),
  membership_origin_verified INTEGER NOT NULL DEFAULT 0 CHECK(membership_origin_verified IN (0,1)),
  welcome_coupon_claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(customer_id) REFERENCES ordering_customers(id)
);

CREATE TABLE platform_member_sessions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  device_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(member_id) REFERENCES platform_members(id)
);

CREATE TABLE platform_coupon_campaigns (
  id TEXT PRIMARY KEY,
  campaign_type TEXT NOT NULL CHECK(campaign_type IN ('platform_welcome_member')),
  name TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'fixed_amount' CHECK(discount_type='fixed_amount'),
  discount_value_minor INTEGER NOT NULL CHECK(discount_value_minor=10000),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency='TWD'),
  valid_days INTEGER NOT NULL DEFAULT 30 CHECK(valid_days BETWEEN 1 AND 365),
  funding_source TEXT NOT NULL DEFAULT 'platform_marketing' CHECK(funding_source='platform_marketing'),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  redemption_enabled INTEGER NOT NULL DEFAULT 0 CHECK(redemption_enabled IN (0,1)),
  starts_at TEXT,
  ends_at TEXT,
  terms_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE platform_member_coupons (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'claimed' CHECK(status IN ('claimed','active','reserved','redeemed','expired','revoked')),
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activates_at TEXT,
  expires_at TEXT NOT NULL,
  reserved_at TEXT,
  redeemed_at TEXT,
  revoked_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(member_id,campaign_id),
  FOREIGN KEY(member_id) REFERENCES platform_members(id),
  FOREIGN KEY(campaign_id) REFERENCES platform_coupon_campaigns(id)
);

CREATE TABLE platform_coupon_funding_ledger (
  id TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  redeeming_merchant_id TEXT,
  discount_minor INTEGER NOT NULL CHECK(discount_minor >= 0),
  status TEXT NOT NULL CHECK(status IN ('reserved','redeemed','merchant_reimbursement_pending','settled','void')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settled_at TEXT,
  FOREIGN KEY(coupon_id) REFERENCES platform_member_coupons(id),
  FOREIGN KEY(member_id) REFERENCES platform_members(id),
  FOREIGN KEY(redeeming_merchant_id) REFERENCES merchants(id)
);

CREATE TABLE platform_member_welcome_events (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'platform_member_created' CHECK(event_type='platform_member_created'),
  source TEXT NOT NULL CHECK(source IN ('phone','qr','partner_contract','merchant_contract','admin')),
  acknowledged_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(member_id,event_type),
  FOREIGN KEY(member_id) REFERENCES platform_members(id)
);

CREATE TABLE platform_member_rate_limits (
  scope TEXT NOT NULL,
  rate_key_hash TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(scope,rate_key_hash,bucket_start)
);

CREATE INDEX idx_platform_member_sessions_member ON platform_member_sessions(member_id,expires_at);
CREATE INDEX idx_platform_member_sessions_device ON platform_member_sessions(device_hash,expires_at);
CREATE INDEX idx_platform_member_coupons_status ON platform_member_coupons(member_id,status,expires_at);
CREATE INDEX idx_platform_welcome_unacknowledged ON platform_member_welcome_events(member_id,acknowledged_at);
CREATE INDEX idx_platform_funding_member ON platform_coupon_funding_ledger(member_id,status,created_at);

CREATE TRIGGER platform_coupon_funding_immutable_update
BEFORE UPDATE ON platform_coupon_funding_ledger
BEGIN SELECT RAISE(ABORT,'PLATFORM_COUPON_FUNDING_LEDGER_IMMUTABLE'); END;

CREATE TRIGGER platform_coupon_funding_immutable_delete
BEFORE DELETE ON platform_coupon_funding_ledger
BEGIN SELECT RAISE(ABORT,'PLATFORM_COUPON_FUNDING_LEDGER_IMMUTABLE'); END;

CREATE TRIGGER platform_member_identity_immutable
BEFORE UPDATE OF customer_id,member_no,joined_source,joined_at ON platform_members
BEGIN SELECT RAISE(ABORT,'PLATFORM_MEMBER_IDENTITY_IMMUTABLE'); END;

INSERT OR IGNORE INTO platform_coupon_campaigns(
  id,campaign_type,name,discount_value_minor,currency,valid_days,funding_source,
  enabled,redemption_enabled,terms_version
) VALUES(
  'platform_welcome_member_v1','platform_welcome_member','創百業平台會員 NT$100 迎新禮券',
  10000,'TWD',30,'platform_marketing',1,0,'platform-welcome-v1'
);
