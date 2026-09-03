-- Merchant phone + 8-digit numeric password authentication.
-- Legacy OTP/demo access records are retained for audit but are no longer used.
PRAGMA foreign_keys=ON;

-- Preserve the existing session table and its legacy assurance CHECK. This
-- additive column records the new authentication assurance without rebuilding it.
ALTER TABLE merchant_user_sessions ADD COLUMN credential_assurance TEXT
  CHECK(credential_assurance IS NULL OR credential_assurance='password_authenticated');

CREATE TABLE merchant_login_credentials (
  id TEXT PRIMARY KEY,
  merchant_user_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  credential_type TEXT NOT NULL DEFAULT 'numeric_password_8' CHECK(credential_type='numeric_password_8'),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_algorithm TEXT NOT NULL DEFAULT 'pbkdf2-sha256-segmented-v1' CHECK(password_algorithm='pbkdf2-sha256-segmented-v1'),
  password_iterations INTEGER NOT NULL DEFAULT 600000 CHECK(password_iterations>=600000),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK(failed_attempts>=0),
  locked_until TEXT,
  reset_required INTEGER NOT NULL DEFAULT 0 CHECK(reset_required IN(0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','disabled')),
  password_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,merchant_user_id,credential_type),
  FOREIGN KEY(merchant_id,merchant_user_id) REFERENCES merchant_users(merchant_id,id)
);
CREATE INDEX idx_merchant_login_credentials_user ON merchant_login_credentials(merchant_user_id,merchant_id,status);

CREATE TABLE merchant_password_setup_tokens (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  merchant_user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK(purpose IN('PASSWORD_SETUP','PASSWORD_RESET')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT,
  created_by_admin_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id,merchant_user_id) REFERENCES merchant_users(merchant_id,id)
);
CREATE INDEX idx_merchant_password_setup_user ON merchant_password_setup_tokens(merchant_id,merchant_user_id,expires_at);

CREATE TABLE merchant_login_selections (
  id TEXT PRIMARY KEY,
  platform_member_id TEXT NOT NULL REFERENCES platform_members(id),
  token_hash TEXT NOT NULL UNIQUE,
  allowed_merchant_ids_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE merchant_registration_applications (
  id TEXT PRIMARY KEY,
  platform_member_id TEXT NOT NULL REFERENCES platform_members(id),
  phone_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_algorithm TEXT NOT NULL DEFAULT 'pbkdf2-sha256-segmented-v1',
  password_iterations INTEGER NOT NULL DEFAULT 600000,
  privacy_consent_version TEXT NOT NULL,
  terms_consent_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_IDENTITY_REVIEW' CHECK(status IN('PENDING_IDENTITY_REVIEW','APPROVED','REJECTED','ACTIVATED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_merchant_auth_rate_limits_cleanup ON merchant_auth_rate_limits(bucket_start);
