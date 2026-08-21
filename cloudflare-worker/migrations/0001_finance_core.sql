CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY, merchant_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  contact_name TEXT, phone TEXT, email TEXT, status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, order_no TEXT NOT NULL UNIQUE, merchant_id TEXT NOT NULL REFERENCES merchants(id), title TEXT NOT NULL,
  amount_due REAL NOT NULL CHECK(amount_due >= 0), amount_paid REAL NOT NULL DEFAULT 0 CHECK(amount_paid >= 0), currency TEXT NOT NULL DEFAULT 'TWD',
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','partial','paid','refunded','cancelled')),
  due_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, payment_no TEXT NOT NULL UNIQUE, merchant_id TEXT NOT NULL REFERENCES merchants(id), order_id TEXT REFERENCES orders(id),
  gross_amount REAL NOT NULL CHECK(gross_amount >= 0), fee_amount REAL, net_amount REAL NOT NULL, amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TWD', payment_method TEXT NOT NULL CHECK(payment_method IN ('card','atm','virtual_account','bank_transfer','line_pay','apple_pay','google_pay','e_wallet','convenience_store','cash','cheque','other')),
  payment_provider TEXT, status TEXT NOT NULL CHECK(status IN ('pending','paid','failed','cancelled','refunded','partially_refunded')),
  provider_trade_no TEXT, provider_payment_id TEXT, paid_at TEXT, confirmed_at TEXT, source TEXT NOT NULL CHECK(source IN ('webhook','manual','import','system')),
  note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(payment_provider, provider_trade_no)
);
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES payments(id), amount REAL NOT NULL CHECK(amount > 0),
  provider_refund_id TEXT, reason TEXT, status TEXT NOT NULL CHECK(status IN ('pending','refunded','failed','cancelled')),
  refunded_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY, provider TEXT NOT NULL, event_type TEXT NOT NULL, provider_event_id TEXT,
  payment_id TEXT REFERENCES payments(id), received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, processed_at TEXT,
  status TEXT NOT NULL, metadata TEXT, UNIQUE(provider, provider_event_id)
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY, date TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('domain','hosting','ai','advertising','software','payroll','commission','outsourcing','transport','other')),
  title TEXT NOT NULL, amount REAL NOT NULL CHECK(amount >= 0), payment_method TEXT, vendor TEXT, note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_status ON payments(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment ON payment_events(payment_id);
INSERT OR IGNORE INTO merchants (id, merchant_code, name, status) VALUES ('merchant_meiling_001', 'MEILING001', '美玲拼布', 'active');
