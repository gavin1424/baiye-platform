PRAGMA foreign_keys=ON;

-- Existing 0011/0012 tables are intentionally extended in place. This migration
-- contains no merchant, menu, order, member, payment or production seed data.
ALTER TABLE merchant_ordering_settings ADD COLUMN ordering_open INTEGER NOT NULL DEFAULT 1 CHECK(ordering_open IN(0,1));
ALTER TABLE merchant_ordering_settings ADD COLUMN accepting_orders INTEGER NOT NULL DEFAULT 0 CHECK(accepting_orders IN(0,1));
ALTER TABLE merchant_ordering_settings ADD COLUMN temporary_closed_message TEXT NOT NULL DEFAULT '店家目前暫停接單';
ALTER TABLE merchant_ordering_settings ADD COLUMN auto_accept_orders INTEGER NOT NULL DEFAULT 0 CHECK(auto_accept_orders IN(0,1));
ALTER TABLE merchant_ordering_settings ADD COLUMN order_number_prefix TEXT NOT NULL DEFAULT 'BY';
ALTER TABLE merchant_ordering_settings ADD COLUMN max_items_per_order INTEGER NOT NULL DEFAULT 50 CHECK(max_items_per_order BETWEEN 1 AND 200);
ALTER TABLE merchant_ordering_settings ADD COLUMN customer_cancel_before_accept INTEGER NOT NULL DEFAULT 1 CHECK(customer_cancel_before_accept IN(0,1));
ALTER TABLE merchant_ordering_settings ADD COLUMN estimated_prep_minutes INTEGER NOT NULL DEFAULT 20 CHECK(estimated_prep_minutes BETWEEN 1 AND 480);
ALTER TABLE merchant_ordering_settings ADD COLUMN new_order_sound_enabled INTEGER NOT NULL DEFAULT 1 CHECK(new_order_sound_enabled IN(0,1));
ALTER TABLE merchant_ordering_settings ADD COLUMN table_session_enabled INTEGER NOT NULL DEFAULT 1 CHECK(table_session_enabled IN(0,1));
ALTER TABLE merchant_ordering_settings ADD COLUMN show_sold_out_items INTEGER NOT NULL DEFAULT 1 CHECK(show_sold_out_items IN(0,1));
ALTER TABLE merchant_ordering_settings ADD COLUMN last_order_time TEXT;
ALTER TABLE merchant_ordering_settings ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Taipei' CHECK(timezone='Asia/Taipei');

ALTER TABLE merchant_ordering_qr_codes ADD COLUMN regenerated_at TEXT;
ALTER TABLE merchant_ordering_qr_codes ADD COLUMN previous_code_hash TEXT;

ALTER TABLE merchant_menu_categories ADD COLUMN archived_at TEXT;

ALTER TABLE merchant_menu_items ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','sold_out','hidden','archived'));
ALTER TABLE merchant_menu_items ADD COLUMN allow_customer_note INTEGER NOT NULL DEFAULT 1 CHECK(allow_customer_note IN(0,1));
ALTER TABLE merchant_menu_items ADD COLUMN daily_limit INTEGER CHECK(daily_limit IS NULL OR daily_limit BETWEEN 1 AND 100000);
ALTER TABLE merchant_menu_items ADD COLUMN daily_sold_count INTEGER NOT NULL DEFAULT 0 CHECK(daily_sold_count>=0);
ALTER TABLE merchant_menu_items ADD COLUMN daily_sold_date TEXT;
ALTER TABLE merchant_menu_items ADD COLUMN archived_at TEXT;

ALTER TABLE merchant_food_orders ADD COLUMN dining_session_id TEXT;
ALTER TABLE merchant_food_orders ADD COLUMN cancel_reason TEXT;
ALTER TABLE merchant_food_orders ADD COLUMN cancelled_by_type TEXT CHECK(cancelled_by_type IS NULL OR cancelled_by_type IN('customer','merchant','admin','system'));
ALTER TABLE merchant_food_orders ADD COLUMN cancelled_by_id TEXT;
ALTER TABLE merchant_food_orders ADD COLUMN payment_method_v1 TEXT NOT NULL DEFAULT 'counter' CHECK(payment_method_v1 IN('counter','cash','card','line_pay','easycard_terminal','other'));
ALTER TABLE merchant_food_orders ADD COLUMN payment_reference TEXT;
ALTER TABLE merchant_food_orders ADD COLUMN payment_confirmed_at TEXT;
ALTER TABLE merchant_food_orders ADD COLUMN payment_confirmed_by TEXT;
ALTER TABLE merchant_food_orders ADD COLUMN preparing_at TEXT;
ALTER TABLE merchant_food_orders ADD COLUMN ready_at TEXT;
ALTER TABLE merchant_food_orders ADD COLUMN served_at TEXT;
ALTER TABLE merchant_food_orders ADD COLUMN admin_override INTEGER NOT NULL DEFAULT 0 CHECK(admin_override IN(0,1));

ALTER TABLE merchant_food_order_items ADD COLUMN base_price_minor INTEGER;
ALTER TABLE merchant_food_order_items ADD COLUMN option_delta_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merchant_food_order_items ADD COLUMN unit_total_minor INTEGER;

ALTER TABLE merchant_ordering_audit_logs ADD COLUMN actor_role TEXT;
ALTER TABLE merchant_ordering_audit_logs ADD COLUMN request_id TEXT;

CREATE TABLE IF NOT EXISTS merchant_menu_option_groups (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  selection_type TEXT NOT NULL DEFAULT 'single' CHECK(selection_type IN('single','multiple')),
  required INTEGER NOT NULL DEFAULT 0 CHECK(required IN(0,1)),
  min_select INTEGER NOT NULL DEFAULT 0 CHECK(min_select>=0),
  max_select INTEGER NOT NULL DEFAULT 1 CHECK(max_select>=1),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id) REFERENCES merchant_ordering_settings(merchant_id),
  CHECK(min_select<=max_select),
  CHECK(required=0 OR min_select>=1),
  CHECK(selection_type<>'single' OR max_select=1)
);

CREATE TABLE IF NOT EXISTS merchant_menu_option_values (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price_delta_minor INTEGER NOT NULL DEFAULT 0 CHECK(price_delta_minor BETWEEN 0 AND 10000000),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id,group_id) REFERENCES merchant_menu_option_groups(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS merchant_menu_item_option_groups (
  merchant_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  option_group_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(merchant_id,menu_item_id,option_group_id),
  FOREIGN KEY(merchant_id,menu_item_id) REFERENCES merchant_menu_items(merchant_id,id),
  FOREIGN KEY(merchant_id,option_group_id) REFERENCES merchant_menu_option_groups(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS merchant_dining_sessions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  table_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','closed')),
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT,
  last_order_at TEXT,
  closed_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id) REFERENCES merchant_ordering_settings(merchant_id)
);

CREATE TABLE IF NOT EXISTS merchant_food_order_item_options (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  order_item_id TEXT NOT NULL,
  option_group_id TEXT NOT NULL,
  option_value_id TEXT NOT NULL,
  group_name_snapshot TEXT NOT NULL,
  value_name_snapshot TEXT NOT NULL,
  price_delta_minor INTEGER NOT NULL CHECK(price_delta_minor BETWEEN 0 AND 10000000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_item_id,option_group_id,option_value_id),
  FOREIGN KEY(merchant_id,order_id) REFERENCES merchant_food_orders(merchant_id,id),
  FOREIGN KEY(order_item_id) REFERENCES merchant_food_order_items(id),
  FOREIGN KEY(merchant_id,option_group_id) REFERENCES merchant_menu_option_groups(merchant_id,id),
  FOREIGN KEY(merchant_id,option_value_id) REFERENCES merchant_menu_option_values(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS merchant_order_payment_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN('confirmed','refunded')),
  payment_method TEXT NOT NULL CHECK(payment_method IN('counter','cash','card','line_pay','easycard_terminal','other')),
  reference TEXT,
  actor_type TEXT NOT NULL CHECK(actor_type IN('merchant','admin')),
  actor_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,order_id,idempotency_key),
  FOREIGN KEY(merchant_id,order_id) REFERENCES merchant_food_orders(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS ordering_rate_limits (
  merchant_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  rate_key_hash TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(merchant_id,scope,rate_key_hash,bucket_start)
);

-- Selectively adopted Merchant Auth Gate 0 tables. No commerce catalog/order
-- tables are introduced by this migration.
CREATE TABLE IF NOT EXISTS merchant_users (
  id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, email TEXT NOT NULL,
  password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 600000,
  password_algorithm TEXT NOT NULL DEFAULT 'pbkdf2-sha256-segmented-v1',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('invited','active','suspended','disabled')),
  display_name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,email), UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id)
);
CREATE TABLE IF NOT EXISTS merchant_user_sessions (
  id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE, csrf_hash TEXT NOT NULL, expires_at TEXT NOT NULL,
  last_seen_at TEXT, revoked_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id,user_id) REFERENCES merchant_users(merchant_id,id)
);
CREATE TABLE IF NOT EXISTS merchant_roles (
  id TEXT PRIMARY KEY, merchant_id TEXT, code TEXT NOT NULL, name TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK(is_system IN(0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(merchant_id,code)
);
CREATE TABLE IF NOT EXISTS merchant_permissions (
  code TEXT PRIMARY KEY, module TEXT NOT NULL, description TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS merchant_role_permissions (
  role_id TEXT NOT NULL, permission_code TEXT NOT NULL,
  PRIMARY KEY(role_id,permission_code),
  FOREIGN KEY(role_id) REFERENCES merchant_roles(id),
  FOREIGN KEY(permission_code) REFERENCES merchant_permissions(code)
);
CREATE TABLE IF NOT EXISTS merchant_user_roles (
  merchant_id TEXT NOT NULL, user_id TEXT NOT NULL, role_id TEXT NOT NULL,
  PRIMARY KEY(user_id,role_id),
  FOREIGN KEY(merchant_id,user_id) REFERENCES merchant_users(merchant_id,id),
  FOREIGN KEY(role_id) REFERENCES merchant_roles(id)
);
CREATE TABLE IF NOT EXISTS merchant_security_events (
  id TEXT PRIMARY KEY, merchant_id TEXT, user_id TEXT, action TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}', ip_hash TEXT, user_agent_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS merchant_auth_rate_limits (
  scope TEXT NOT NULL, rate_key_hash TEXT NOT NULL, bucket_start TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0, last_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(scope,rate_key_hash,bucket_start)
);

INSERT OR IGNORE INTO merchant_permissions(code,module,description) VALUES
 ('ordering.read','ordering','查看點餐總覽與訂單'),
 ('ordering.settings','ordering','管理點餐設定'),
 ('ordering.qr.manage','ordering','管理桌號與 QR'),
 ('ordering.menu.manage','ordering','管理菜單與加料'),
 ('ordering.orders.manage','ordering','管理訂單流程'),
 ('ordering.payments.manage','ordering','確認現場付款與退款');

CREATE UNIQUE INDEX IF NOT EXISTS uq_ordering_open_table_session
  ON merchant_dining_sessions(merchant_id,table_label) WHERE status='open';
CREATE INDEX IF NOT EXISTS idx_ordering_sessions_table ON merchant_dining_sessions(merchant_id,table_label,status,last_order_at);
CREATE INDEX IF NOT EXISTS idx_ordering_options_group ON merchant_menu_option_values(merchant_id,group_id,active,sort_order);
CREATE INDEX IF NOT EXISTS idx_ordering_item_groups ON merchant_menu_item_option_groups(merchant_id,menu_item_id,sort_order);
CREATE INDEX IF NOT EXISTS idx_ordering_order_options ON merchant_food_order_item_options(merchant_id,order_id,order_item_id);
CREATE INDEX IF NOT EXISTS idx_ordering_orders_session ON merchant_food_orders(merchant_id,dining_session_id,created_at);
CREATE INDEX IF NOT EXISTS idx_ordering_orders_status ON merchant_food_orders(merchant_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_ordering_rate_limit_bucket ON ordering_rate_limits(bucket_start,updated_at);
CREATE INDEX IF NOT EXISTS idx_merchant_ordering_sessions ON merchant_user_sessions(merchant_id,user_id,expires_at,revoked_at);

CREATE TRIGGER IF NOT EXISTS trg_ordering_item_option_immutable_update
BEFORE UPDATE ON merchant_food_order_item_options BEGIN SELECT RAISE(ABORT,'ORDER_OPTION_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_ordering_item_option_immutable_delete
BEFORE DELETE ON merchant_food_order_item_options BEGIN SELECT RAISE(ABORT,'ORDER_OPTION_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_ordering_dining_session_merchant
BEFORE INSERT ON merchant_food_orders
WHEN NEW.dining_session_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM merchant_dining_sessions s WHERE s.id=NEW.dining_session_id AND s.merchant_id=NEW.merchant_id AND s.status='open'
) BEGIN SELECT RAISE(ABORT,'DINING_SESSION_MERCHANT_MISMATCH'); END;
CREATE TRIGGER IF NOT EXISTS trg_ordering_option_value_group_merchant
BEFORE INSERT ON merchant_food_order_item_options
WHEN NOT EXISTS(
  SELECT 1 FROM merchant_menu_option_values v
  JOIN merchant_menu_option_groups g ON g.merchant_id=v.merchant_id AND g.id=v.group_id
  WHERE v.merchant_id=NEW.merchant_id AND v.id=NEW.option_value_id AND g.id=NEW.option_group_id
) BEGIN SELECT RAISE(ABORT,'ORDER_OPTION_MERCHANT_MISMATCH'); END;
CREATE TRIGGER IF NOT EXISTS trg_ordering_order_item_merchant
BEFORE INSERT ON merchant_food_order_item_options
WHEN NOT EXISTS(
  SELECT 1 FROM merchant_food_order_items i JOIN merchant_food_orders o ON o.id=i.order_id
  WHERE i.id=NEW.order_item_id AND o.id=NEW.order_id AND o.merchant_id=NEW.merchant_id
) BEGIN SELECT RAISE(ABORT,'ORDER_ITEM_MERCHANT_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_ordering_daily_limit_guard
BEFORE INSERT ON merchant_food_order_items
WHEN EXISTS(
  SELECT 1 FROM merchant_menu_items i
  WHERE i.id=NEW.menu_item_id AND i.daily_limit IS NOT NULL
    AND (CASE WHEN i.daily_sold_date=date('now','+8 hours') THEN i.daily_sold_count ELSE 0 END)+NEW.quantity>i.daily_limit
) BEGIN SELECT RAISE(ABORT,'ORDERING_DAILY_LIMIT_REACHED'); END;

CREATE TRIGGER IF NOT EXISTS trg_ordering_daily_limit_increment
AFTER INSERT ON merchant_food_order_items
BEGIN
  UPDATE merchant_menu_items SET
    daily_sold_count=CASE WHEN daily_sold_date=date('now','+8 hours') THEN daily_sold_count+NEW.quantity ELSE NEW.quantity END,
    daily_sold_date=date('now','+8 hours'),updated_at=CURRENT_TIMESTAMP
  WHERE id=NEW.menu_item_id AND daily_limit IS NOT NULL;
END;
