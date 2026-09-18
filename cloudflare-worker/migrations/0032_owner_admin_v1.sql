PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS owner_admin_users (
  admin_user_id TEXT PRIMARY KEY REFERENCES admin_users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'OWNER_ADMIN' CHECK(role='OWNER_ADMIN'),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','disabled')),
  passkey_ready INTEGER NOT NULL DEFAULT 0 CHECK(passkey_ready IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS owner_admin_sessions (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES owner_admin_users(admin_user_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_hash TEXT NOT NULL,
  reauth_at TEXT,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_owner_sessions_user ON owner_admin_sessions(admin_user_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_owner_sessions_token ON owner_admin_sessions(token_hash,expires_at);

CREATE TABLE IF NOT EXISTS owner_login_attempts (
  rate_key TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(rate_key,bucket_start)
);

CREATE TABLE IF NOT EXISTS merchant_owner_profiles (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  business_name TEXT,
  legal_name TEXT,
  owner_name TEXT,
  contact_name TEXT,
  phone TEXT,
  mobile TEXT,
  email TEXT,
  tax_id TEXT,
  address TEXT,
  line_contact TEXT,
  plan_code TEXT,
  lifecycle_status TEXT NOT NULL DEFAULT 'NEW' CHECK(lifecycle_status IN ('NEW','IN_PROGRESS','WAITING_CLIENT','WAITING_PAYMENT','WAITING_APPROVAL','COMPLETED','PAUSED','TERMINATED')),
  notes TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_owner_profiles_status ON merchant_owner_profiles(lifecycle_status,updated_at);

CREATE TABLE IF NOT EXISTS owner_contracts (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  contract_name TEXT NOT NULL,
  plan_code TEXT,
  contract_amount INTEGER NOT NULL DEFAULT 0 CHECK(contract_amount>=0),
  currency TEXT NOT NULL DEFAULT 'TWD',
  contract_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(contract_status IN ('DRAFT','WAITING_SIGNATURE','SIGNED','WAITING_PAYMENT','ACTIVE','COMPLETED','PAUSED','TERMINATED')),
  signed_at TEXT,
  start_date TEXT,
  end_date TEXT,
  payment_terms TEXT,
  pdf_asset TEXT,
  notes TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_owner_contracts_merchant ON owner_contracts(merchant_id,contract_status,updated_at);

CREATE TABLE IF NOT EXISTS website_projects (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL UNIQUE REFERENCES merchants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED','WAITING_CLIENT_DATA','IN_PROGRESS','TESTING','WAITING_APPROVAL','PRODUCTION','COMPLETED','PAUSED')),
  next_step TEXT,
  owner_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_website_projects_status ON website_projects(status,updated_at);

CREATE TABLE IF NOT EXISTS website_project_checklist (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL CHECK(item_code IN ('CLIENT_DATA','LOGO','BRAND','DOMAIN','HOME','PRODUCTS_SERVICES','LINE_OA','AI_CUSTOMER_SERVICE','WEBSITE_BOOKING','MEMBERSHIP','POSLESS_ORDERING','PAYMENT','PRODUCTION','CLIENT_ACCEPTANCE')),
  status TEXT NOT NULL DEFAULT 'TODO' CHECK(status IN ('TODO','WAITING','IN_PROGRESS','DONE','BLOCKED','NOT_APPLICABLE')),
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id,item_code)
);

CREATE TABLE IF NOT EXISTS merchant_system_assets (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  production_url TEXT,
  staging_url TEXT,
  domain TEXT,
  domain_provider TEXT,
  domain_expiry TEXT,
  github_repo TEXT,
  cloudflare_project TEXT,
  deployment_id TEXT,
  latest_commit_sha TEXT,
  line_oa_name TEXT,
  line_basic_id TEXT,
  liff_id TEXT,
  google_business TEXT,
  secret_status_json TEXT NOT NULL DEFAULT '{}',
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_services (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL CHECK(service_code IN ('website','ai_customer_service','line_oa','membership','website_booking','posless_ordering','contract_system','payment','inventory','other')),
  status TEXT NOT NULL DEFAULT 'NOT_ENABLED' CHECK(status IN ('NOT_ENABLED','SETUP','TESTING','ACTIVE','PAUSED')),
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,service_code)
);
CREATE INDEX IF NOT EXISTS idx_merchant_services_status ON merchant_services(service_code,status);

CREATE TABLE IF NOT EXISTS owner_receivables (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  contract_id TEXT REFERENCES owner_contracts(id) ON DELETE SET NULL,
  amount_due INTEGER NOT NULL CHECK(amount_due>=0),
  amount_paid INTEGER NOT NULL DEFAULT 0 CHECK(amount_paid>=0),
  balance INTEGER NOT NULL CHECK(balance>=0),
  due_date TEXT,
  paid_at TEXT,
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(payment_status IN ('UNPAID','PARTIAL','PAID','OVERDUE','WAIVED')),
  reference TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_owner_receivables_status ON owner_receivables(payment_status,due_date);
CREATE INDEX IF NOT EXISTS idx_owner_receivables_merchant ON owner_receivables(merchant_id,updated_at);

CREATE TABLE IF NOT EXISTS owner_tasks (
  id TEXT PRIMARY KEY,
  merchant_id TEXT REFERENCES merchants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'TODO' CHECK(status IN ('TODO','WAITING_CLIENT','IN_PROGRESS','BLOCKED','DONE')),
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT')),
  due_date TEXT,
  assigned_to TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_owner_tasks_open ON owner_tasks(status,due_date,priority);
CREATE INDEX IF NOT EXISTS idx_owner_tasks_merchant ON owner_tasks(merchant_id,status);

CREATE TABLE IF NOT EXISTS owner_documents (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('CONTRACT','QUOTE','CLIENT_DATA','LOGO','QR_CODE','IMAGE','ACCEPTANCE','PAYMENT_PROOF','GUIDE','OTHER')),
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uploaded_by TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_owner_documents_merchant ON owner_documents(merchant_id,type,uploaded_at);

CREATE TABLE IF NOT EXISTS owner_system_monitors (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  http_status INTEGER,
  health_status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK(health_status IN ('HEALTHY','WARNING','DOWN','UNKNOWN')),
  ssl_status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK(ssl_status IN ('VALID','EXPIRING','INVALID','UNKNOWN')),
  last_checked_at TEXT,
  last_deployment_at TEXT,
  latest_commit_sha TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_owner_monitor_health ON owner_system_monitors(health_status,last_checked_at);

CREATE TABLE IF NOT EXISTS owner_audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  request_metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_owner_audit_entity ON owner_audit_logs(entity_type,entity_id,created_at);
CREATE INDEX IF NOT EXISTS idx_owner_audit_actor ON owner_audit_logs(actor_id,created_at);

INSERT OR IGNORE INTO owner_admin_users(admin_user_id)
SELECT id FROM admin_users WHERE email='www.asdfg14@gmail.com' COLLATE NOCASE AND status='active';
