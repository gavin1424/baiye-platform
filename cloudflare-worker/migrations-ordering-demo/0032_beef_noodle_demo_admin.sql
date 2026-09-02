-- STAGING / DEMO ONLY. This migration is referenced only by
-- wrangler.ordering-staging.jsonc and must never be used by Production.

CREATE TABLE IF NOT EXISTS staging_demo_merchants (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  display_badge TEXT NOT NULL DEFAULT 'Demo 試用環境',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staging_demo_password_credentials (
  username TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL UNIQUE REFERENCES merchants(id),
  merchant_user_id TEXT NOT NULL REFERENCES merchant_users(id),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 600000,
  password_algorithm TEXT NOT NULL DEFAULT 'pbkdf2-sha256-segmented-v1',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  initial_password_rotated_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staging_demo_auth_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT,
  username_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('login_failed','login_rate_limited','login_success','session_rotated','demo_reset')),
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staging_demo_auth_events
  ON staging_demo_auth_events(merchant_id,created_at);

INSERT INTO staging_demo_merchants(merchant_id,enabled,display_badge)
SELECT id,1,'Demo 試用環境' FROM merchants WHERE id='demo_beef_noodle'
ON CONFLICT(merchant_id) DO UPDATE SET enabled=1,display_badge='Demo 試用環境',updated_at=CURRENT_TIMESTAMP;

UPDATE merchant_users
SET display_name='百工牛肉麵｜試用管理者',updated_at=CURRENT_TIMESTAMP
WHERE id='demo_beef_owner' AND merchant_id='demo_beef_noodle';

UPDATE merchant_roles
SET name='管理者',is_system=1
WHERE id='demo_beef_owner_role' AND merchant_id='demo_beef_noodle';

INSERT OR IGNORE INTO merchant_role_permissions(role_id,permission_code)
SELECT 'demo_beef_owner_role',code FROM merchant_permissions
WHERE code LIKE 'ordering.%' OR code LIKE 'merchant.%';

INSERT INTO merchant_admin_profiles(
  merchant_id,brand_name,business_description,support_phone,business_address,
  business_hours,transportation_info,social_links_json,homepage_notice,shopping_cart_enabled
) VALUES(
  'demo_beef_noodle','百工牛肉麵','紅燒與清燉慢熬湯頭，手機掃碼即可點餐的牛肉麵示範店。',
  '02-0000-0000','臺北市 Demo 試用環境','每日 11:00–20:30',
  '此為隔離 Staging 試用商家，不代表實際營業地址。','{}','歡迎使用百工牛肉麵完整商家試用後台。',1
) ON CONFLICT(merchant_id) DO UPDATE SET
  brand_name=excluded.brand_name,business_description=excluded.business_description,
  support_phone=excluded.support_phone,business_address=excluded.business_address,
  business_hours=excluded.business_hours,transportation_info=excluded.transportation_info,
  homepage_notice=excluded.homepage_notice,shopping_cart_enabled=1,updated_at=CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS staging_demo_golden_ordering_settings AS
  SELECT * FROM merchant_ordering_settings WHERE 0;
CREATE TABLE IF NOT EXISTS staging_demo_golden_menu_categories AS
  SELECT * FROM merchant_menu_categories WHERE 0;
CREATE TABLE IF NOT EXISTS staging_demo_golden_menu_items AS
  SELECT * FROM merchant_menu_items WHERE 0;
CREATE TABLE IF NOT EXISTS staging_demo_golden_option_groups AS
  SELECT * FROM merchant_menu_option_groups WHERE 0;
CREATE TABLE IF NOT EXISTS staging_demo_golden_option_values AS
  SELECT * FROM merchant_menu_option_values WHERE 0;
CREATE TABLE IF NOT EXISTS staging_demo_golden_item_option_groups AS
  SELECT * FROM merchant_menu_item_option_groups WHERE 0;
CREATE TABLE IF NOT EXISTS staging_demo_golden_qr_codes AS
  SELECT * FROM merchant_ordering_qr_codes WHERE 0;
CREATE TABLE IF NOT EXISTS staging_demo_golden_admin_profile AS
  SELECT * FROM merchant_admin_profiles WHERE 0;

DELETE FROM staging_demo_golden_ordering_settings WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_ordering_settings
  SELECT * FROM merchant_ordering_settings WHERE merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_menu_categories WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_menu_categories
  SELECT * FROM merchant_menu_categories WHERE merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_menu_items WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_menu_items
  SELECT * FROM merchant_menu_items WHERE merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_option_groups WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_option_groups
  SELECT * FROM merchant_menu_option_groups WHERE merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_option_values WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_option_values
  SELECT * FROM merchant_menu_option_values WHERE merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_item_option_groups WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_item_option_groups
  SELECT * FROM merchant_menu_item_option_groups WHERE merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_qr_codes WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_qr_codes
  SELECT * FROM merchant_ordering_qr_codes WHERE merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_admin_profile WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_admin_profile
  SELECT * FROM merchant_admin_profiles WHERE merchant_id='demo_beef_noodle';
