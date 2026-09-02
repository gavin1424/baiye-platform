PRAGMA foreign_keys = ON;

ALTER TABLE merchant_users ADD COLUMN phone_normalized TEXT;
ALTER TABLE merchant_users ADD COLUMN platform_member_id TEXT REFERENCES platform_members(id);
ALTER TABLE merchant_users ADD COLUMN auth_mode TEXT NOT NULL DEFAULT 'password'
  CHECK(auth_mode IN ('password','passwordless_phone'));

ALTER TABLE merchant_user_sessions ADD COLUMN platform_member_id TEXT REFERENCES platform_members(id);
ALTER TABLE merchant_user_sessions ADD COLUMN assurance_level TEXT NOT NULL DEFAULT 'trusted_existing_session'
  CHECK(assurance_level IN ('activation_invite','verified_phone','trusted_existing_session'));
ALTER TABLE merchant_user_sessions ADD COLUMN issued_via TEXT NOT NULL DEFAULT 'legacy_password';

CREATE TABLE IF NOT EXISTS merchant_applications (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL UNIQUE,
  platform_member_id TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registration_started'
    CHECK(status IN ('registration_started','pending_contract','activated','rejected','closed')),
  consent_version TEXT NOT NULL,
  consented_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id) REFERENCES merchants(id),
  FOREIGN KEY(platform_member_id) REFERENCES platform_members(id)
);

CREATE TABLE IF NOT EXISTS merchant_owner_links (
  merchant_id TEXT NOT NULL,
  merchant_user_id TEXT NOT NULL,
  platform_member_id TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner' CHECK(role='owner'),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(merchant_id,merchant_user_id),
  UNIQUE(merchant_id,platform_member_id),
  UNIQUE(merchant_id,phone_normalized),
  FOREIGN KEY(merchant_id,merchant_user_id) REFERENCES merchant_users(merchant_id,id),
  FOREIGN KEY(platform_member_id) REFERENCES platform_members(id)
);

CREATE TABLE IF NOT EXISTS merchant_login_challenges (
  id TEXT PRIMARY KEY,
  platform_member_id TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('staging_otp','sms_otp','line_login')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 8),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(platform_member_id) REFERENCES platform_members(id)
);

CREATE INDEX IF NOT EXISTS idx_merchant_users_phone
  ON merchant_users(phone_normalized,status,merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_owner_member
  ON merchant_owner_links(platform_member_id,status,merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_login_challenge
  ON merchant_login_challenges(phone_hash,expires_at,used_at);
CREATE INDEX IF NOT EXISTS idx_merchant_session_assurance
  ON merchant_user_sessions(merchant_id,user_id,assurance_level,expires_at,revoked_at);

CREATE TRIGGER IF NOT EXISTS trg_merchant_owner_link_update_identity
BEFORE UPDATE OF merchant_id,merchant_user_id,platform_member_id,phone_normalized,role ON merchant_owner_links
BEGIN SELECT RAISE(ABORT,'MERCHANT_OWNER_IDENTITY_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_merchant_owner_link_delete
BEFORE DELETE ON merchant_owner_links
BEGIN SELECT RAISE(ABORT,'MERCHANT_OWNER_LINK_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_merchant_owner_link_consistency_insert
BEFORE INSERT ON merchant_owner_links
WHEN NOT EXISTS(
  SELECT 1 FROM merchant_users u
  WHERE u.id=NEW.merchant_user_id AND u.merchant_id=NEW.merchant_id
    AND u.platform_member_id=NEW.platform_member_id
    AND u.phone_normalized=NEW.phone_normalized
    AND u.auth_mode='passwordless_phone'
)
BEGIN SELECT RAISE(ABORT,'MERCHANT_OWNER_IDENTITY_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_merchant_owner_phone_immutable
BEFORE UPDATE OF phone_normalized,platform_member_id,auth_mode ON merchant_users
WHEN OLD.auth_mode='passwordless_phone'
BEGIN SELECT RAISE(ABORT,'MERCHANT_PHONE_IDENTITY_IMMUTABLE'); END;
