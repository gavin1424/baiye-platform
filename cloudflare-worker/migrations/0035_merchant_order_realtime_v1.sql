PRAGMA foreign_keys=ON;

-- An append-only cursor log for reliable device reconciliation. It references
-- the canonical order; it is not a second order store.
CREATE TABLE IF NOT EXISTS merchant_order_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  merchant_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN('order_created','order_status_updated','order_payment_updated')),
  order_id TEXT NOT NULL,
  order_code TEXT NOT NULL,
  table_label TEXT,
  status TEXT,
  payment_status TEXT,
  item_count INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id,order_id) REFERENCES merchant_food_orders(merchant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_merchant_order_events_cursor ON merchant_order_events(merchant_id,sequence);
CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_order_created_event ON merchant_order_events(merchant_id,order_id,event_type) WHERE event_type='order_created';

CREATE TABLE IF NOT EXISTS merchant_devices (
  device_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  device_name TEXT NOT NULL,
  app_version TEXT NOT NULL,
  connection_identity TEXT NOT NULL,
  printer_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)),
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(merchant_id,device_id),
  FOREIGN KEY(merchant_id,printer_id) REFERENCES printers(merchant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_merchant_devices_active ON merchant_devices(merchant_id,enabled,last_seen_at);
