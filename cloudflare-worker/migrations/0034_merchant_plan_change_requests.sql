-- Non-destructive, manually reviewed merchant plan-change intake.
-- Existing selections, contracts, signatures and artifacts are never changed here.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS merchant_plan_change_requests (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  current_plan_id TEXT NOT NULL REFERENCES merchant_plan_catalog(plan_id),
  requested_plan_id TEXT NOT NULL REFERENCES merchant_plan_catalog(plan_id),
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK(status IN ('submitted','reviewing','approved','declined','cancelled')),
  requested_terms_json TEXT NOT NULL,
  requested_terms_hash TEXT NOT NULL,
  idempotency_key_hash TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(current_plan_id<>requested_plan_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_plan_change_idempotency
  ON merchant_plan_change_requests(merchant_id,idempotency_key_hash);

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_pending_plan_change
  ON merchant_plan_change_requests(merchant_id,requested_plan_id)
  WHERE status IN ('submitted','reviewing');

