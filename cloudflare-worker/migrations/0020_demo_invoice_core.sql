-- Invoice records are documentary/tax workflow state only.  Finance Core
-- remains the sole revenue/refund ledger.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS merchant_invoice_integrations (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'disabled' CHECK(provider IN ('disabled','mock_for_automated_test_only','future_einvoice_provider','future_mof_turnkey')),
  readiness_status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED' CHECK(readiness_status IN ('NOT_CONFIGURED','BUSINESS_REGISTRATION_REQUIRED','PROVIDER_REQUIRED','CREDENTIAL_REQUIRED','READY','ACTIVE')),
  seller_tax_id_masked TEXT,
  seller_name TEXT,
  branch_code TEXT,
  default_tax_type TEXT,
  credential_status TEXT NOT NULL DEFAULT 'not_configured',
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS merchant_order_invoice_preferences (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  invoice_type TEXT NOT NULL CHECK(invoice_type IN ('individual','mobile_barcode','business_tax_id','donation')),
  carrier_type TEXT,
  carrier_value_encrypted TEXT,
  carrier_value_masked TEXT,
  buyer_identifier TEXT,
  buyer_identifier_masked TEXT,
  buyer_name TEXT,
  donation_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES merchant_food_orders(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS invoice_requests (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  payment_id TEXT,
  invoice_type TEXT NOT NULL CHECK(invoice_type IN ('individual','mobile_barcode','business_tax_id','donation')),
  status TEXT NOT NULL CHECK(status IN ('PENDING','ISSUING','ISSUED','FAILED','VOID_PENDING','VOIDED','ALLOWANCE_PENDING','PARTIALLY_REFUNDED','FULLY_REFUNDED','CANCELLED','MANUAL_REVIEW_REQUIRED')),
  buyer_identifier TEXT,
  carrier_type TEXT,
  carrier_value_encrypted TEXT,
  carrier_value_masked TEXT,
  donation_code TEXT,
  amount_minor INTEGER NOT NULL CHECK(amount_minor>=0),
  tax_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(tax_amount_minor>=0),
  currency TEXT NOT NULL DEFAULT 'TWD',
  idempotency_key TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,payment_id),
  UNIQUE(merchant_id,idempotency_key),
  FOREIGN KEY(order_id) REFERENCES merchant_food_orders(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  invoice_request_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  provider_invoice_id TEXT,
  invoice_number TEXT,
  invoice_date TEXT,
  random_number TEXT,
  status TEXT NOT NULL CHECK(status IN ('ISSUED','VOID_PENDING','VOIDED','ALLOWANCE_PENDING','PARTIALLY_REFUNDED','FULLY_REFUNDED')),
  issued_at TEXT,
  voided_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider,provider_invoice_id),
  UNIQUE(provider,invoice_number),
  FOREIGN KEY(invoice_request_id) REFERENCES invoice_requests(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  order_item_id TEXT,
  name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_minor INTEGER NOT NULL,
  amount_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS invoice_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  invoice_request_id TEXT NOT NULL,
  invoice_id TEXT,
  event_type TEXT NOT NULL CHECK(event_type IN ('invoice_requested','invoice_issued','invoice_failed','invoice_retried','invoice_void_requested','invoice_voided','allowance_requested','allowance_issued')),
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('system','merchant','provider','test')),
  actor_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(invoice_request_id) REFERENCES invoice_requests(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS invoice_allowances (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  provider_allowance_id TEXT,
  allowance_number TEXT,
  amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
  status TEXT NOT NULL CHECK(status IN ('PENDING','ISSUED','VOIDED','FAILED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_invoice_requests_merchant_status ON invoice_requests(merchant_id,status,next_retry_at);
CREATE INDEX IF NOT EXISTS idx_invoices_merchant_order ON invoices(merchant_id,order_id);
CREATE INDEX IF NOT EXISTS idx_invoice_events_request ON invoice_events(invoice_request_id,created_at);

-- Provider integration is merchant data, not migration seed data.  The
-- isolated demo seed records its disabled readiness separately.
