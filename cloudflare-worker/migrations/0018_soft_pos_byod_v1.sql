-- 0018: Soft-POS / BYOD additive schema.
PRAGMA foreign_keys=ON;

-- Soft-POS augments the QR ordering core.  It never creates a second order
-- ledger: POS, QR and future channels continue to use merchant_food_orders.
ALTER TABLE merchant_food_orders ADD COLUMN order_source TEXT NOT NULL DEFAULT 'qr_dine_in'
  CHECK(order_source IN('qr_dine_in','qr_takeaway','merchant_pos','online_store','booking','manual'));
ALTER TABLE merchant_food_orders ADD COLUMN pos_ticket_no TEXT;
ALTER TABLE merchant_food_orders ADD COLUMN pos_staff_id TEXT;
-- The QR V1 payment enum intentionally has a smaller historical set.  Keep it
-- untouched and retain the exact Soft-POS method separately for reporting.
ALTER TABLE merchant_food_orders ADD COLUMN pos_payment_method TEXT
  CHECK(pos_payment_method IS NULL OR pos_payment_method IN('cash','counter','card','line_pay','easycard_terminal','bank_transfer','other'));
ALTER TABLE merchant_menu_items ADD COLUMN cost_minor INTEGER NOT NULL DEFAULT 0 CHECK(cost_minor>=0);
ALTER TABLE merchant_menu_items ADD COLUMN barcode TEXT;

CREATE TABLE IF NOT EXISTS merchant_pos_profiles (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),
  business_mode TEXT NOT NULL DEFAULT 'service' CHECK(business_mode IN('restaurant','food_stall','retail','service','beauty','mixed')),
  kitchen_enabled INTEGER NOT NULL DEFAULT 0 CHECK(kitchen_enabled IN(0,1)),
  inventory_mode TEXT NOT NULL DEFAULT 'simple_stock' CHECK(inventory_mode IN('none','simple_stock','recipe_stock')),
  booking_enabled INTEGER NOT NULL DEFAULT 0 CHECK(booking_enabled IN(0,1)),
  soft_pos_enabled INTEGER NOT NULL DEFAULT 0 CHECK(soft_pos_enabled IN(0,1)),
  printer_adapter TEXT NOT NULL DEFAULT 'browser_print' CHECK(printer_adapter IN('browser_print','bluetooth_escpos_future','network_printer_future')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pos_staff (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  merchant_user_id TEXT REFERENCES merchant_users(id),
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN('owner','manager','staff')),
  pin_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id), UNIQUE(merchant_id,merchant_user_id)
);

CREATE TABLE IF NOT EXISTS pos_staff_sessions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  merchant_session_id TEXT NOT NULL REFERENCES merchant_user_sessions(id),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id,staff_id) REFERENCES pos_staff(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS inventory_locations (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id), UNIQUE(merchant_id,name)
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  menu_item_id TEXT,
  sku TEXT,
  barcode TEXT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'each',
  cost_minor INTEGER NOT NULL DEFAULT 0 CHECK(cost_minor>=0),
  safety_stock_minor INTEGER NOT NULL DEFAULT 0 CHECK(safety_stock_minor>=0),
  stock_mode TEXT NOT NULL DEFAULT 'simple_stock' CHECK(stock_mode IN('simple_stock','recipe_stock')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id), UNIQUE(merchant_id,menu_item_id), UNIQUE(merchant_id,sku), UNIQUE(merchant_id,barcode),
  FOREIGN KEY(merchant_id,menu_item_id) REFERENCES merchant_menu_items(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS inventory_balances (
  merchant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL,
  quantity_minor INTEGER NOT NULL DEFAULT 0 CHECK(quantity_minor>=0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(merchant_id,location_id,inventory_item_id),
  FOREIGN KEY(merchant_id,location_id) REFERENCES inventory_locations(merchant_id,id),
  FOREIGN KEY(merchant_id,inventory_item_id) REFERENCES inventory_items(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN('purchase','sale','return','adjustment','waste','stocktake','transfer','reservation','reservation_release')),
  quantity_delta_minor INTEGER NOT NULL CHECK(quantity_delta_minor<>0),
  unit_cost_minor INTEGER,
  source_type TEXT,
  source_id TEXT,
  idempotency_key TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN('merchant','admin','system')),
  actor_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,idempotency_key),
  FOREIGN KEY(merchant_id,location_id) REFERENCES inventory_locations(merchant_id,id),
  FOREIGN KEY(merchant_id,inventory_item_id) REFERENCES inventory_items(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL,
  order_id TEXT,
  quantity_minor INTEGER NOT NULL CHECK(quantity_minor>0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','released','consumed','expired')),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at TEXT,
  UNIQUE(merchant_id,order_id,inventory_item_id),
  FOREIGN KEY(merchant_id,location_id) REFERENCES inventory_locations(merchant_id,id),
  FOREIGN KEY(merchant_id,inventory_item_id) REFERENCES inventory_items(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS inventory_recipes (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,menu_item_id),
  FOREIGN KEY(merchant_id,menu_item_id) REFERENCES merchant_menu_items(merchant_id,id)
);
CREATE TABLE IF NOT EXISTS inventory_recipe_items (
  recipe_id TEXT NOT NULL REFERENCES inventory_recipes(id),
  merchant_id TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL,
  quantity_minor INTEGER NOT NULL CHECK(quantity_minor>0),
  PRIMARY KEY(recipe_id,inventory_item_id),
  FOREIGN KEY(merchant_id,inventory_item_id) REFERENCES inventory_items(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES merchants(id), name TEXT NOT NULL,
  phone TEXT, note TEXT, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id), UNIQUE(merchant_id,name)
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES merchants(id), supplier_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','received','cancelled')),
  received_at TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id,supplier_id) REFERENCES suppliers(merchant_id,id)
);
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT PRIMARY KEY, purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id), inventory_item_id TEXT NOT NULL,
  quantity_minor INTEGER NOT NULL CHECK(quantity_minor>0), unit_cost_minor INTEGER NOT NULL CHECK(unit_cost_minor>=0)
);
CREATE TABLE IF NOT EXISTS goods_receipts (
  id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES merchants(id), purchase_order_id TEXT REFERENCES purchase_orders(id),
  location_id TEXT NOT NULL, received_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id,location_id) REFERENCES inventory_locations(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS cash_sessions (
  id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES merchants(id), location_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','closed')),
  opening_float_minor INTEGER NOT NULL DEFAULT 0 CHECK(opening_float_minor>=0),
  expected_cash_minor INTEGER NOT NULL DEFAULT 0,
  counted_cash_minor INTEGER, variance_minor INTEGER,
  opened_by TEXT NOT NULL, opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_by TEXT, closed_at TEXT, close_note TEXT,
  FOREIGN KEY(merchant_id,location_id) REFERENCES inventory_locations(merchant_id,id)
);
CREATE TABLE IF NOT EXISTS cash_movements (
  id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, cash_session_id TEXT NOT NULL REFERENCES cash_sessions(id),
  movement_type TEXT NOT NULL CHECK(movement_type IN('sale','refund','expense','adjustment')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor<>0), order_id TEXT, payment_id TEXT,
  idempotency_key TEXT NOT NULL, actor_id TEXT, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,idempotency_key)
);

CREATE TABLE IF NOT EXISTS pos_operations (
  id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, operation_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL, result_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,operation_type,idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_pos_profiles_enabled ON merchant_pos_profiles(enabled,soft_pos_enabled);
CREATE INDEX IF NOT EXISTS idx_pos_staff_merchant ON pos_staff(merchant_id,status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_merchant ON inventory_items(merchant_id,active,name);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory_balances(merchant_id,quantity_minor);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_item ON inventory_transactions(merchant_id,inventory_item_id,created_at);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_merchant ON cash_sessions(merchant_id,status,opened_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_session_open ON cash_sessions(merchant_id) WHERE status='open';
CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(cash_session_id,created_at);
CREATE INDEX IF NOT EXISTS idx_orders_pos_source ON merchant_food_orders(merchant_id,order_source,created_at);

CREATE TRIGGER IF NOT EXISTS trg_inventory_tx_no_update BEFORE UPDATE ON inventory_transactions BEGIN SELECT RAISE(ABORT,'INVENTORY_TRANSACTION_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_inventory_tx_no_delete BEFORE DELETE ON inventory_transactions BEGIN SELECT RAISE(ABORT,'INVENTORY_TRANSACTION_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_inventory_balance_guard BEFORE INSERT ON inventory_transactions
WHEN COALESCE((SELECT quantity_minor FROM inventory_balances WHERE merchant_id=NEW.merchant_id AND location_id=NEW.location_id AND inventory_item_id=NEW.inventory_item_id),0)+NEW.quantity_delta_minor<0
BEGIN SELECT RAISE(ABORT,'INVENTORY_NEGATIVE_GUARD'); END;
CREATE TRIGGER IF NOT EXISTS trg_inventory_balance_apply AFTER INSERT ON inventory_transactions BEGIN
 UPDATE inventory_balances SET quantity_minor=quantity_minor+NEW.quantity_delta_minor,updated_at=CURRENT_TIMESTAMP
   WHERE merchant_id=NEW.merchant_id AND location_id=NEW.location_id AND inventory_item_id=NEW.inventory_item_id;
 INSERT INTO inventory_balances(merchant_id,location_id,inventory_item_id,quantity_minor,updated_at)
 SELECT NEW.merchant_id,NEW.location_id,NEW.inventory_item_id,NEW.quantity_delta_minor,CURRENT_TIMESTAMP
 WHERE NOT EXISTS(SELECT 1 FROM inventory_balances WHERE merchant_id=NEW.merchant_id AND location_id=NEW.location_id AND inventory_item_id=NEW.inventory_item_id);
END;
CREATE TRIGGER IF NOT EXISTS trg_cash_movement_no_update BEFORE UPDATE ON cash_movements BEGIN SELECT RAISE(ABORT,'CASH_MOVEMENT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_cash_movement_no_delete BEFORE DELETE ON cash_movements BEGIN SELECT RAISE(ABORT,'CASH_MOVEMENT_IMMUTABLE'); END;

INSERT OR IGNORE INTO merchant_permissions(code,module,description) VALUES
 ('pos.read','soft_pos','查看商家營運中心'),('pos.order.create','soft_pos','建立手機開單'),
 ('pos.order.manage','soft_pos','管理 POS 與 KDS 訂單'),('pos.payment.manage','soft_pos','確認與退款現場付款'),
 ('pos.inventory.read','soft_pos','查看庫存'),('pos.inventory.manage','soft_pos','異動庫存與盤點'),
 ('pos.cash.manage','soft_pos','管理現金班別'),('pos.reporting.read','soft_pos','查看營運報表');
