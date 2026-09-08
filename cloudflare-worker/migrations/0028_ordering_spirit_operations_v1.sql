PRAGMA foreign_keys=ON;

-- Operational metadata extends the canonical merchant_food_orders row without
-- creating a second order domain.
CREATE TABLE IF NOT EXISTS merchant_order_fulfillment (
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'QR' CHECK(source IN('QR','LINE','WEB','COUNTER','UBER_EATS','FOODPANDA','KIOSK','PHONE_MANUAL','OTHER')),
  scheduled_for TEXT,
  pickup_number TEXT,
  fulfillment_status TEXT NOT NULL DEFAULT 'immediate' CHECK(fulfillment_status IN('immediate','scheduled','awaiting_pickup','picked_up','delivery_pending','delivery_active','delivered')),
  delivery_provider TEXT,
  delivery_address TEXT,
  delivery_contact TEXT,
  delivery_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK(delivery_fee_minor>=0),
  pickup_eta TEXT,
  driver_status TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(merchant_id,order_id),
  UNIQUE(merchant_id,pickup_number),
  FOREIGN KEY(merchant_id,order_id) REFERENCES merchant_food_orders(merchant_id,id)
);

CREATE INDEX IF NOT EXISTS idx_order_fulfillment_schedule ON merchant_order_fulfillment(merchant_id,scheduled_for,source);

CREATE TABLE IF NOT EXISTS printer_assignments (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  printer_id TEXT NOT NULL,
  station TEXT NOT NULL CHECK(station IN('kitchen','drink','side_dish','counter')),
  category_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,station,category_id),
  FOREIGN KEY(merchant_id,printer_id) REFERENCES printers(merchant_id,id),
  FOREIGN KEY(merchant_id,category_id) REFERENCES merchant_menu_categories(merchant_id,id)
);

CREATE INDEX IF NOT EXISTS idx_printer_assignments_merchant ON printer_assignments(merchant_id,station,enabled);

INSERT OR IGNORE INTO merchant_permissions(code,module,description) VALUES
 ('operations.dashboard.read','operations','查看餐飲營運首頁'),
 ('operations.reports.read','operations','查看營運報表'),
 ('operations.members.read','operations','查看會員營運資料'),
 ('operations.integrations.read','operations','查看整合服務狀態');
