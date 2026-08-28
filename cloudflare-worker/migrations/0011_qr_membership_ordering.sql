PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS merchant_ordering_settings (
  merchant_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(length(currency) = 3),
  dine_in_enabled INTEGER NOT NULL DEFAULT 1 CHECK(dine_in_enabled IN (0,1)),
  takeaway_enabled INTEGER NOT NULL DEFAULT 1 CHECK(takeaway_enabled IN (0,1)),
  require_member INTEGER NOT NULL DEFAULT 1 CHECK(require_member IN (0,1)),
  consent_version TEXT NOT NULL DEFAULT '2026-08-27',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_ordering_qr_codes (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('member_order','member_only','dine_in','takeaway')),
  table_label TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id) REFERENCES merchant_ordering_settings(merchant_id),
  CHECK(purpose <> 'dine_in' OR (table_label IS NOT NULL AND length(trim(table_label)) > 0))
);

CREATE TABLE IF NOT EXISTS ordering_customers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  phone_normalized TEXT NOT NULL UNIQUE,
  phone_display TEXT NOT NULL,
  email TEXT,
  phone_verified INTEGER NOT NULL DEFAULT 0 CHECK(phone_verified IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_ordering_memberships (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  membership_no TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','blocked','closed')),
  joined_via_qr_id TEXT,
  consent_version TEXT NOT NULL,
  consented_at TEXT NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 0 CHECK(visit_count >= 0),
  order_count INTEGER NOT NULL DEFAULT 0 CHECK(order_count >= 0),
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,customer_id),
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id) REFERENCES merchant_ordering_settings(merchant_id),
  FOREIGN KEY(customer_id) REFERENCES ordering_customers(id),
  FOREIGN KEY(joined_via_qr_id) REFERENCES merchant_ordering_qr_codes(id)
);

CREATE TABLE IF NOT EXISTS merchant_member_sessions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id,membership_id) REFERENCES merchant_ordering_memberships(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS merchant_menu_categories (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id) REFERENCES merchant_ordering_settings(merchant_id)
);

CREATE TABLE IF NOT EXISTS merchant_menu_items (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price_minor INTEGER NOT NULL CHECK(price_minor >= 0 AND price_minor <= 10000000),
  image_url TEXT,
  available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id),
  UNIQUE(merchant_id,sku),
  FOREIGN KEY(merchant_id,category_id) REFERENCES merchant_menu_categories(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS merchant_food_orders (
  id TEXT PRIMARY KEY,
  order_code TEXT NOT NULL UNIQUE,
  merchant_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  qr_id TEXT NOT NULL,
  table_label TEXT,
  order_type TEXT NOT NULL CHECK(order_type IN ('dine_in','takeaway')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','accepted','preparing','ready','served','completed','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid','refunded')),
  payment_method TEXT NOT NULL DEFAULT 'counter' CHECK(payment_method IN ('counter','cash','line_pay','card','other')),
  subtotal_minor INTEGER NOT NULL CHECK(subtotal_minor >= 0),
  total_minor INTEGER NOT NULL CHECK(total_minor >= 0),
  customer_note TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  UNIQUE(merchant_id,membership_id,idempotency_key),
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id,membership_id) REFERENCES merchant_ordering_memberships(merchant_id,id),
  FOREIGN KEY(merchant_id,qr_id) REFERENCES merchant_ordering_qr_codes(merchant_id,id),
  CHECK(total_minor = subtotal_minor),
  CHECK(order_type <> 'dine_in' OR (table_label IS NOT NULL AND length(trim(table_label)) > 0))
);

CREATE TABLE IF NOT EXISTS merchant_food_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  name_snapshot TEXT NOT NULL,
  unit_price_minor INTEGER NOT NULL CHECK(unit_price_minor >= 0),
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20),
  line_total_minor INTEGER NOT NULL CHECK(line_total_minor >= 0),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES merchant_food_orders(id),
  FOREIGN KEY(menu_item_id) REFERENCES merchant_menu_items(id),
  CHECK(line_total_minor = unit_price_minor * quantity)
);

CREATE TABLE IF NOT EXISTS merchant_ordering_audit_logs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('customer','admin','system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ordering_qr_lookup ON merchant_ordering_qr_codes(code,active,expires_at);
CREATE INDEX IF NOT EXISTS idx_ordering_memberships_customer ON merchant_ordering_memberships(customer_id,merchant_id,status);
CREATE INDEX IF NOT EXISTS idx_member_sessions_lookup ON merchant_member_sessions(token_hash,expires_at,revoked_at);
CREATE INDEX IF NOT EXISTS idx_menu_categories_merchant ON merchant_menu_categories(merchant_id,active,sort_order);
CREATE INDEX IF NOT EXISTS idx_menu_items_merchant ON merchant_menu_items(merchant_id,category_id,available,sort_order);
CREATE INDEX IF NOT EXISTS idx_food_orders_queue ON merchant_food_orders(merchant_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_food_orders_member ON merchant_food_orders(merchant_id,membership_id,created_at);
CREATE INDEX IF NOT EXISTS idx_food_order_items_order ON merchant_food_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_ordering_audit_merchant ON merchant_ordering_audit_logs(merchant_id,created_at);

CREATE TRIGGER IF NOT EXISTS trg_food_orders_immutable_values
BEFORE UPDATE OF merchant_id,membership_id,qr_id,order_type,table_label,subtotal_minor,total_minor,idempotency_key ON merchant_food_orders
BEGIN
  SELECT RAISE(ABORT, 'submitted order values are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_food_order_items_no_update
BEFORE UPDATE ON merchant_food_order_items
BEGIN
  SELECT RAISE(ABORT, 'submitted order items are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_food_order_items_no_delete
BEFORE DELETE ON merchant_food_order_items
BEGIN
  SELECT RAISE(ABORT, 'submitted order items are immutable');
END;
