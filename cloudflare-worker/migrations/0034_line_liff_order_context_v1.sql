ALTER TABLE merchant_food_orders ADD COLUMN line_context_id TEXT;

CREATE TABLE merchant_line_ordering_sessions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  qr_id TEXT NOT NULL,
  table_label TEXT,
  line_user_id_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','ordered','expired')),
  last_order_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id,qr_id) REFERENCES merchant_ordering_qr_codes(merchant_id,id),
  FOREIGN KEY(merchant_id,last_order_id) REFERENCES merchant_food_orders(merchant_id,id)
);

CREATE INDEX idx_line_ordering_sessions_active
  ON merchant_line_ordering_sessions(merchant_id,qr_id,status,expires_at);

CREATE INDEX idx_food_orders_line_context
  ON merchant_food_orders(merchant_id,line_context_id);
