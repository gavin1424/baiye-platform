PRAGMA foreign_keys=ON;
ALTER TABLE merchant_coupon_campaigns ADD COLUMN refund_policy TEXT NOT NULL DEFAULT 'do_not_restore' CHECK(refund_policy IN('restore_coupon','do_not_restore','manual_review'));
ALTER TABLE merchant_coupon_campaigns ADD COLUMN legal_review_status TEXT NOT NULL DEFAULT 'pending' CHECK(legal_review_status IN('pending','approved','rejected'));
ALTER TABLE merchant_coupon_campaigns ADD COLUMN reviewed_at TEXT;
ALTER TABLE merchant_order_payment_intents ADD COLUMN confirmed_by TEXT;
ALTER TABLE merchant_order_payment_intents ADD COLUMN cancelled_by TEXT;
ALTER TABLE merchant_order_payment_intents ADD COLUMN refunded_by TEXT;
ALTER TABLE merchant_order_payment_intents ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE TABLE IF NOT EXISTS merchant_integration_operations(
 id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, scope TEXT NOT NULL, idempotency_key TEXT NOT NULL,
 resource_id TEXT, result_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(merchant_id,scope,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_integration_operations ON merchant_integration_operations(merchant_id,scope,idempotency_key);
