-- STAGING / DEMO ONLY. Canonical phone identity allowlist and merchant product
-- asset metadata for the isolated beef noodle trial environment.

CREATE TABLE IF NOT EXISTS staging_demo_merchant_admin_allowlist (
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  platform_member_id TEXT NOT NULL REFERENCES platform_members(id),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  granted_by TEXT NOT NULL DEFAULT 'staging_provisioning',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(merchant_id,platform_member_id)
);

CREATE TABLE IF NOT EXISTS merchant_product_assets (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  product_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
  byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880),
  status TEXT NOT NULL DEFAULT 'staged' CHECK(status IN ('staged','attached','deleted')),
  created_by_user_id TEXT NOT NULL REFERENCES merchant_users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attached_at TEXT,
  deleted_at TEXT,
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id,product_id) REFERENCES merchant_menu_items(merchant_id,id)
);

CREATE INDEX IF NOT EXISTS idx_merchant_product_assets_product
  ON merchant_product_assets(merchant_id,product_id,status,created_at);

