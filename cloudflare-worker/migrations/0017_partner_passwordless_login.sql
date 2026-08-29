PRAGMA foreign_keys = ON;

CREATE TABLE partner_platform_member_links (
  partner_id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(partner_id) REFERENCES partners(id),
  FOREIGN KEY(member_id) REFERENCES platform_members(id)
);

CREATE TABLE partner_sessions (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  assurance_level TEXT NOT NULL CHECK(assurance_level IN ('activation_invite','verified_phone','trusted_existing_session')),
  issued_via TEXT NOT NULL CHECK(issued_via IN ('activation_invite','staging_otp','sms_otp','line_login','session_restore')),
  login_challenge_id TEXT UNIQUE,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(partner_id) REFERENCES partners(id),
  FOREIGN KEY(login_challenge_id) REFERENCES partner_login_challenges(id)
);

CREATE TABLE partner_login_challenges (
  id TEXT PRIMARY KEY,
  partner_id TEXT,
  phone_hash TEXT NOT NULL,
  code_hash TEXT,
  provider TEXT NOT NULL CHECK(provider IN ('staging_otp','sms_otp','line_login','disabled')),
  expires_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK(max_attempts BETWEEN 1 AND 10),
  ip_hash TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(partner_id) REFERENCES partners(id)
);

CREATE TABLE partner_login_rate_limits (
  scope TEXT NOT NULL,
  rate_key_hash TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(scope,rate_key_hash,bucket_start)
);

CREATE INDEX idx_partner_sessions_active ON partner_sessions(partner_id,expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_partner_login_challenges_active ON partner_login_challenges(phone_hash,expires_at) WHERE used_at IS NULL AND revoked_at IS NULL;
CREATE INDEX idx_partner_login_challenges_partner ON partner_login_challenges(partner_id,created_at);

INSERT OR IGNORE INTO partner_platform_member_links(partner_id,member_id)
SELECT i.partner_id,m.id
FROM partner_application_identities i
JOIN ordering_customers c ON c.phone_normalized=i.phone_normalized
JOIN platform_members m ON m.customer_id=c.id;

CREATE TRIGGER partner_platform_member_link_immutable_update
BEFORE UPDATE ON partner_platform_member_links
BEGIN SELECT RAISE(ABORT,'PARTNER_PLATFORM_MEMBER_LINK_IMMUTABLE'); END;

CREATE TRIGGER partner_platform_member_link_immutable_delete
BEFORE DELETE ON partner_platform_member_links
BEGIN SELECT RAISE(ABORT,'PARTNER_PLATFORM_MEMBER_LINK_IMMUTABLE'); END;
