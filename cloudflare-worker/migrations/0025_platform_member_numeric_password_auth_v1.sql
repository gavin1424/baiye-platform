-- Customer platform-member authentication. This credential is intentionally
-- separate from merchant_login_credentials (merchant administration).
PRAGMA foreign_keys=ON;

CREATE TABLE platform_member_login_credentials (
  id TEXT PRIMARY KEY,
  platform_member_id TEXT NOT NULL,
  credential_type TEXT NOT NULL DEFAULT 'numeric_password_8'
    CHECK(credential_type='numeric_password_8'),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_algorithm TEXT NOT NULL DEFAULT 'pbkdf2-sha256-segmented-v1'
    CHECK(password_algorithm='pbkdf2-sha256-segmented-v1'),
  password_iterations INTEGER NOT NULL DEFAULT 600000
    CHECK(password_iterations>=600000),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK(failed_attempts>=0),
  locked_until TEXT,
  reset_required INTEGER NOT NULL DEFAULT 0 CHECK(reset_required IN(0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','disabled')),
  password_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform_member_id,credential_type),
  FOREIGN KEY(platform_member_id) REFERENCES platform_members(id)
);

CREATE INDEX idx_platform_member_login_credentials_member
  ON platform_member_login_credentials(platform_member_id,status);

CREATE TABLE platform_member_security_events (
  id TEXT PRIMARY KEY,
  platform_member_id TEXT,
  merchant_id TEXT,
  action TEXT NOT NULL CHECK(action IN(
    'LOGIN_SUCCESS','LOGIN_FAILED','ACCOUNT_LOCKED','PASSWORD_SET','LOGOUT'
  )),
  ip_hash TEXT NOT NULL,
  user_agent_hash TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(platform_member_id) REFERENCES platform_members(id),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id)
);

CREATE INDEX idx_platform_member_security_events_member
  ON platform_member_security_events(platform_member_id,created_at);
