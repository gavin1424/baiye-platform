-- Payment lifecycle only. Finance Core remains the source of truth for ledger
-- entries; these rows retain provider state, replay protection and evidence.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS merchant_payment_provider_configs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('manual_counter','line_pay_online','apple_pay_web','future_card_gateway')),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  environment TEXT NOT NULL DEFAULT 'staging' CHECK(environment IN ('staging','production')),
  configuration_status TEXT NOT NULL DEFAULT 'configuration_required'
    CHECK(configuration_status IN ('configuration_required','sandbox_ready','active','disabled')),
  order_acceptance_policy TEXT NOT NULL DEFAULT 'accept_before_payment'
    CHECK(order_acceptance_policy IN ('accept_before_payment','accept_after_payment')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,provider),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS merchant_checkout_payment_intents (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('manual_counter','line_pay_online','apple_pay_web','future_card_gateway')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor>=0),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency IN ('TWD','USD','THB')),
  status TEXT NOT NULL CHECK(status IN ('created','requires_action','processing','authorized','paid','failed','cancelled','expired','partially_refunded','refunded')),
  provider_transaction_id TEXT,
  provider_payment_access_token_hash TEXT,
  qr_code TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  paid_at TEXT,
  cancelled_at TEXT,
  failed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,order_id,idempotency_key),
  UNIQUE(provider,provider_transaction_id),
  FOREIGN KEY(order_id) REFERENCES merchant_food_orders(id) ON DELETE RESTRICT,
  FOREIGN KEY(merchant_id,order_id) REFERENCES merchant_food_orders(merchant_id,id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS merchant_checkout_payment_transactions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  payment_intent_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('request','confirm','cancel','refund','status_check')),
  status TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor>=0),
  currency TEXT NOT NULL,
  provider_response_redacted TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(payment_intent_id,transaction_type,provider_transaction_id),
  FOREIGN KEY(payment_intent_id) REFERENCES merchant_checkout_payment_intents(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS merchant_checkout_payment_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  payment_intent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('customer','merchant','system','provider')),
  actor_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(payment_intent_id) REFERENCES merchant_checkout_payment_intents(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS merchant_payment_domain_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  payment_intent_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type='PAYMENT_CONFIRMED'),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(payment_intent_id,event_type),
  FOREIGN KEY(payment_intent_id) REFERENCES merchant_checkout_payment_intents(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS merchant_order_inventory_reservations (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  payment_intent_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('reserved','committed','released')),
  expires_at TEXT NOT NULL,
  released_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(payment_intent_id),
  FOREIGN KEY(payment_intent_id) REFERENCES merchant_checkout_payment_intents(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_checkout_payment_intents_merchant_status ON merchant_checkout_payment_intents(merchant_id,status,expires_at);
CREATE INDEX IF NOT EXISTS idx_checkout_payment_events_intent ON merchant_checkout_payment_events(payment_intent_id,created_at);

-- Provider configuration is merchant data, never migration seed data.  The
-- isolated beef-noodle demo reset/seed script creates its disabled records.
