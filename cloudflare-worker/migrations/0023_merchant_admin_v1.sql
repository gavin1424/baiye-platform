-- Merchant administrator V1. Internal owner keys remain unchanged for auth compatibility.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS merchant_admin_profiles (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),
  brand_name TEXT,
  business_description TEXT,
  support_phone TEXT,
  support_email TEXT,
  business_address TEXT,
  business_hours TEXT,
  transportation_info TEXT,
  social_links_json TEXT NOT NULL DEFAULT '{}',
  homepage_notice TEXT,
  shopping_cart_enabled INTEGER NOT NULL DEFAULT 0 CHECK(shopping_cart_enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor_member_id TEXT,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_pricing_config (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'TWD',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_line_integrations (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  basic_id TEXT,
  display_name TEXT,
  add_friend_url TEXT,
  integration_mode TEXT NOT NULL DEFAULT 'add_friend_link'
    CHECK(integration_mode IN ('add_friend_link','linked_line_login','future_multi_account_liff')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO platform_pricing_config(code,label,amount_minor,currency) VALUES
  ('simple_cart','簡易購物車',800000,'TWD'),
  ('external_checkout_cart','購物車＋外部安全結帳',1400000,'TWD'),
  ('payment_api','正式金流 API',2200000,'TWD');

INSERT OR IGNORE INTO merchant_permissions(code,module,description) VALUES
  ('merchant.profile.read','merchant','查看商家基本資料'),
  ('merchant.profile.write','merchant','編輯商家一般資料'),
  ('merchant.content.read','merchant','查看網站內容資料'),
  ('merchant.content.write','merchant','編輯網站內容資料'),
  ('merchant.products.read','merchant','查看商品與菜單'),
  ('merchant.products.write','merchant','編輯商品與菜單'),
  ('merchant.bookings.read','merchant','查看本商家預約'),
  ('merchant.bookings.write','merchant','管理本商家預約'),
  ('merchant.members.read','merchant','查看本商家會員 relationship'),
  ('merchant.orders.read','merchant','查看本商家訂單'),
  ('merchant.orders.write','merchant','管理本商家訂單'),
  ('merchant.google_booking.read','merchant','查看 Google 地圖預約申請'),
  ('merchant.google_booking.apply','merchant','申請 Google 地圖預約'),
  ('merchant.line.read','merchant','查看 LINE 官方帳號狀態'),
  ('merchant.contract.read','merchant','查看商家契約'),
  ('merchant.contract.download','merchant','下載已簽商家契約'),
  ('merchant.settings.read','merchant','查看商家設定'),
  ('merchant.settings.write','merchant','編輯商家一般設定');

INSERT OR IGNORE INTO merchant_role_permissions(role_id,permission_code)
SELECT r.id,p.code FROM merchant_roles r CROSS JOIN merchant_permissions p
WHERE r.code='owner' AND (p.code LIKE 'merchant.%' OR p.code LIKE 'ordering.%');

CREATE INDEX IF NOT EXISTS idx_merchant_admin_audit_merchant
  ON merchant_admin_audit_logs(merchant_id,created_at);
