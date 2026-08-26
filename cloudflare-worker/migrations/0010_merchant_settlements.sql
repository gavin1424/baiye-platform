PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS platform_finance_settings (
  id TEXT PRIMARY KEY CHECK(id = 'default'),
  brand_name TEXT NOT NULL DEFAULT '創百業智慧鏈',
  legal_entity_name TEXT,
  tax_id TEXT,
  invoice_title TEXT,
  invoice_address TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_settlement_profiles (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL UNIQUE REFERENCES merchants(id) ON DELETE RESTRICT,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  payment_plan TEXT NOT NULL CHECK(payment_plan IN ('upfront_18000','sales_offset_18000')),
  deposit_rate_bp INTEGER NOT NULL DEFAULT 3000 CHECK(deposit_rate_bp BETWEEN 0 AND 10000),
  platform_fee_rate_bp INTEGER NOT NULL DEFAULT 200 CHECK(platform_fee_rate_bp BETWEEN 0 AND 10000),
  processing_fee_mode TEXT NOT NULL DEFAULT 'actual_or_estimated' CHECK(processing_fee_mode IN ('actual_only','estimated','actual_or_estimated')),
  processing_fee_basis TEXT NOT NULL DEFAULT 'deposit_collected' CHECK(processing_fee_basis IN ('deposit_collected','order_total')),
  estimated_processing_fee_rate_bp INTEGER NOT NULL DEFAULT 0 CHECK(estimated_processing_fee_rate_bp BETWEEN 0 AND 10000),
  tax_reserve_mode TEXT NOT NULL DEFAULT 'disabled' CHECK(tax_reserve_mode IN ('disabled','manual','percentage')),
  tax_reserve_rate_bp INTEGER NOT NULL DEFAULT 0 CHECK(tax_reserve_rate_bp BETWEEN 0 AND 10000),
  withholding_mode TEXT NOT NULL DEFAULT 'disabled' CHECK(withholding_mode IN ('disabled','manual','percentage')),
  withholding_rate_bp INTEGER NOT NULL DEFAULT 0 CHECK(withholding_rate_bp BETWEEN 0 AND 10000),
  withholding_income_type TEXT,
  refund_platform_fee_policy TEXT NOT NULL DEFAULT 'pro_rata_reverse' CHECK(refund_platform_fee_policy IN ('pro_rata_reverse','no_reverse','manual_review')),
  refund_offset_policy TEXT NOT NULL DEFAULT 'pro_rata_reverse' CHECK(refund_offset_policy IN ('pro_rata_reverse','no_reverse','manual_review')),
  provider_fee_refund_policy TEXT NOT NULL DEFAULT 'no_reverse' CHECK(provider_fee_refund_policy IN ('pro_rata_reverse','no_reverse','manual_review')),
  offset_target_amount_minor INTEGER NOT NULL DEFAULT 1800000 CHECK(offset_target_amount_minor >= 0),
  continue_platform_fee_after_offset INTEGER NOT NULL DEFAULT 0 CHECK(continue_platform_fee_after_offset IN (0,1)),
  settlement_day INTEGER NOT NULL DEFAULT 10 CHECK(settlement_day BETWEEN 1 AND 28),
  legal_review_status TEXT NOT NULL DEFAULT 'pending' CHECK(legal_review_status IN ('pending','approved','rejected')),
  accounting_review_status TEXT NOT NULL DEFAULT 'pending' CHECK(accounting_review_status IN ('pending','approved','rejected')),
  effective_from TEXT,
  effective_to TEXT,
  calculation_version TEXT NOT NULL DEFAULT 'settlement-v2',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);

-- No legacy payment is backfilled. Eligibility always requires explicit review.
CREATE TABLE IF NOT EXISTS merchant_settlement_sources (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  collection_role TEXT NOT NULL DEFAULT 'manual_unclassified' CHECK(collection_role IN ('platform_deposit','merchant_direct','order_balance','full_payment','manual_unclassified','test')),
  settlement_eligible INTEGER NOT NULL DEFAULT 0 CHECK(settlement_eligible IN (0,1)),
  order_total_amount_minor INTEGER NOT NULL CHECK(order_total_amount_minor > 0),
  expected_deposit_amount_minor INTEGER NOT NULL CHECK(expected_deposit_amount_minor >= 0),
  actual_collected_amount_minor INTEGER NOT NULL CHECK(actual_collected_amount_minor >= 0),
  provider_fee_actual_minor INTEGER CHECK(provider_fee_actual_minor IS NULL OR provider_fee_actual_minor >= 0),
  occurred_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  source_version TEXT NOT NULL DEFAULT 'settlement-source-v1',
  reserved_statement_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(settlement_eligible = 0 OR (collection_role = 'platform_deposit' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  UNIQUE(id, merchant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_eligible_platform_deposit_per_order
  ON merchant_settlement_sources(merchant_id, order_id)
  WHERE collection_role = 'platform_deposit' AND settlement_eligible = 1;

CREATE TABLE IF NOT EXISTS merchant_settlements (
  id TEXT PRIMARY KEY,
  statement_no TEXT NOT NULL UNIQUE,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  profile_id TEXT NOT NULL REFERENCES merchant_settlement_profiles(id) ON DELETE RESTRICT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  period_start_utc TEXT NOT NULL,
  period_end_exclusive_utc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','locked','paid','void')),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(length(currency)=3),
  total_order_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(total_order_amount_minor >= 0),
  expected_deposit_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(expected_deposit_amount_minor >= 0),
  actual_deposit_collected_minor INTEGER NOT NULL DEFAULT 0 CHECK(actual_deposit_collected_minor >= 0),
  deposit_variance_minor INTEGER NOT NULL DEFAULT 0,
  deposit_variance_reason TEXT,
  deposit_variance_reviewed_by TEXT,
  deposit_variance_reviewed_at TEXT,
  processing_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK(processing_fee_minor >= 0),
  actual_fee_total_minor INTEGER NOT NULL DEFAULT 0 CHECK(actual_fee_total_minor >= 0),
  estimated_fee_total_minor INTEGER NOT NULL DEFAULT 0 CHECK(estimated_fee_total_minor >= 0),
  missing_actual_fee_count INTEGER NOT NULL DEFAULT 0 CHECK(missing_actual_fee_count >= 0),
  platform_service_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK(platform_service_fee_minor >= 0),
  tax_reserve_minor INTEGER NOT NULL DEFAULT 0 CHECK(tax_reserve_minor >= 0),
  withholding_minor INTEGER NOT NULL DEFAULT 0 CHECK(withholding_minor >= 0),
  adjustments_minor INTEGER NOT NULL DEFAULT 0,
  net_settlement_minor INTEGER NOT NULL DEFAULT 0,
  merchant_payable_minor INTEGER NOT NULL DEFAULT 0 CHECK(merchant_payable_minor >= 0),
  merchant_due_to_platform_minor INTEGER NOT NULL DEFAULT 0 CHECK(merchant_due_to_platform_minor >= 0),
  carry_forward_balance_minor INTEGER NOT NULL DEFAULT 0,
  prior_offset_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(prior_offset_amount_minor >= 0),
  current_offset_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(current_offset_amount_minor >= 0),
  cumulative_offset_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(cumulative_offset_amount_minor >= 0),
  remaining_offset_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(remaining_offset_amount_minor >= 0),
  ongoing_platform_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK(ongoing_platform_fee_minor >= 0),
  transfer_amount_minor INTEGER CHECK(transfer_amount_minor IS NULL OR transfer_amount_minor >= 0),
  transfer_date TEXT,
  transfer_reference TEXT,
  platform_invoice_no TEXT,
  platform_invoice_status TEXT CHECK(platform_invoice_status IS NULL OR platform_invoice_status IN ('pending','issued','void')),
  calculation_version TEXT NOT NULL,
  rules_snapshot_json TEXT NOT NULL CHECK(json_valid(rules_snapshot_json)),
  statement_hash TEXT,
  current_pdf_version INTEGER,
  pdf_object_key TEXT,
  pdf_hash TEXT,
  locked_at TEXT,
  paid_at TEXT,
  voided_at TEXT,
  void_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(period_end >= period_start),
  CHECK(period_end_exclusive_utc > period_start_utc),
  CHECK(status != 'paid' OR (paid_at IS NOT NULL AND transfer_amount_minor IS NOT NULL AND transfer_reference IS NOT NULL)),
  CHECK(status != 'void' OR (voided_at IS NOT NULL AND void_reason IS NOT NULL)),
  CHECK(deposit_variance_minor = 0 OR status NOT IN ('locked','paid') OR (deposit_variance_reason IS NOT NULL AND deposit_variance_reviewed_by IS NOT NULL AND deposit_variance_reviewed_at IS NOT NULL)),
  UNIQUE(id, merchant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_settlement_period
  ON merchant_settlements(merchant_id, period_start, period_end)
  WHERE status <> 'void';

CREATE TABLE IF NOT EXISTS merchant_settlement_items (
  id TEXT PRIMARY KEY,
  settlement_id TEXT NOT NULL REFERENCES merchant_settlements(id) ON DELETE RESTRICT,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  settlement_source_id TEXT REFERENCES merchant_settlement_sources(id) ON DELETE RESTRICT,
  item_type TEXT NOT NULL CHECK(item_type IN ('deposit','refund','adjustment')),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE RESTRICT,
  payment_id TEXT REFERENCES payments(id) ON DELETE RESTRICT,
  refund_id TEXT REFERENCES refunds(id) ON DELETE RESTRICT,
  order_total_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(order_total_amount_minor >= 0),
  expected_deposit_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(expected_deposit_amount_minor >= 0),
  actual_deposit_amount_minor INTEGER NOT NULL DEFAULT 0,
  processing_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK(processing_fee_minor >= 0),
  processing_fee_source TEXT NOT NULL DEFAULT 'unavailable' CHECK(processing_fee_source IN ('actual','estimated','unavailable')),
  amount_minor INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,
  source_snapshot_json TEXT NOT NULL CHECK(json_valid(source_snapshot_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(settlement_id, source_type, source_id),
  FOREIGN KEY(settlement_id, merchant_id) REFERENCES merchant_settlements(id, merchant_id) ON DELETE RESTRICT,
  FOREIGN KEY(settlement_source_id, merchant_id) REFERENCES merchant_settlement_sources(id, merchant_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS merchant_settlement_adjustments (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  source_settlement_id TEXT REFERENCES merchant_settlements(id) ON DELETE RESTRICT,
  applied_settlement_id TEXT REFERENCES merchant_settlements(id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('refund','fee_difference','chargeback','correction','reversal','other')),
  deposit_reversal_minor INTEGER NOT NULL DEFAULT 0,
  platform_fee_reversal_minor INTEGER NOT NULL DEFAULT 0,
  offset_reversal_minor INTEGER NOT NULL DEFAULT 0,
  provider_fee_retained_minor INTEGER NOT NULL DEFAULT 0 CHECK(provider_fee_retained_minor >= 0),
  provider_fee_reversal_minor INTEGER NOT NULL DEFAULT 0 CHECK(provider_fee_reversal_minor >= 0),
  amount_minor INTEGER NOT NULL CHECK(amount_minor != 0),
  reason TEXT NOT NULL,
  source_reference TEXT,
  effective_date TEXT NOT NULL,
  eligible_period_start TEXT NOT NULL,
  source_refund_id TEXT REFERENCES refunds(id) ON DELETE RESTRICT,
  source_payment_id TEXT REFERENCES payments(id) ON DELETE RESTRICT,
  source_statement_id TEXT REFERENCES merchant_settlements(id) ON DELETE RESTRICT,
  review_status TEXT NOT NULL DEFAULT 'approved' CHECK(review_status IN ('pending','approved','rejected')),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','void')),
  created_by TEXT NOT NULL,
  approved_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT,
  voided_at TEXT,
  FOREIGN KEY(source_settlement_id, merchant_id) REFERENCES merchant_settlements(id, merchant_id) ON DELETE RESTRICT,
  FOREIGN KEY(applied_settlement_id, merchant_id) REFERENCES merchant_settlements(id, merchant_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_refund_adjustment
  ON merchant_settlement_adjustments(source_refund_id)
  WHERE source_refund_id IS NOT NULL AND status <> 'void';

CREATE TABLE IF NOT EXISTS merchant_offset_ledger (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  settlement_id TEXT REFERENCES merchant_settlements(id) ON DELETE RESTRICT,
  adjustment_id TEXT REFERENCES merchant_settlement_adjustments(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK(entry_type IN ('offset_earned','refund_reversal','manual_correction','correction_reversal')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor != 0),
  effective_at TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('posted','reversed')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS merchant_settlement_events (
  id TEXT PRIMARY KEY,
  settlement_id TEXT REFERENCES merchant_settlements(id) ON DELETE RESTRICT,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('admin','merchant','system','provider')),
  actor_id TEXT,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  idempotency_key TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_type, idempotency_key),
  FOREIGN KEY(settlement_id, merchant_id) REFERENCES merchant_settlements(id, merchant_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS settlement_document_versions (
  id TEXT PRIMARY KEY,
  settlement_id TEXT NOT NULL REFERENCES merchant_settlements(id) ON DELETE RESTRICT,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  pdf_version INTEGER NOT NULL CHECK(pdf_version > 0),
  pdf_status TEXT NOT NULL CHECK(pdf_status IN ('locked','paid')),
  pdf_object_key TEXT NOT NULL UNIQUE,
  pdf_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  supersedes_pdf_version INTEGER,
  created_by TEXT NOT NULL,
  UNIQUE(settlement_id, pdf_version),
  FOREIGN KEY(settlement_id, merchant_id) REFERENCES merchant_settlements(id, merchant_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS merchant_settlement_operations (
  id TEXT PRIMARY KEY,
  settlement_id TEXT REFERENCES merchant_settlements(id) ON DELETE RESTRICT,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  operation_type TEXT NOT NULL,
  operation_scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','completed')),
  expires_at TEXT NOT NULL,
  reconciliation_status TEXT NOT NULL DEFAULT 'pending' CHECK(reconciliation_status IN ('pending','reconciled','failed')),
  http_status INTEGER,
  response_json TEXT CHECK(response_json IS NULL OR json_valid(response_json)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE(merchant_id, operation_scope, operation_type, idempotency_key),
  FOREIGN KEY(settlement_id, merchant_id) REFERENCES merchant_settlements(id, merchant_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS finance_refund_operations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','completed')),
  refund_id TEXT REFERENCES refunds(id) ON DELETE RESTRICT,
  response_json TEXT CHECK(response_json IS NULL OR json_valid(response_json)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE(payment_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_refunds_provider_refund_id
  ON refunds(provider_refund_id)
  WHERE provider_refund_id IS NOT NULL AND provider_refund_id <> '';

CREATE TRIGGER IF NOT EXISTS trg_refund_prevent_over_refund
BEFORE INSERT ON refunds
WHEN NEW.status IN ('pending','refunded') AND (
  COALESCE((SELECT SUM(amount) FROM refunds WHERE payment_id=NEW.payment_id AND status IN ('pending','refunded')),0) + NEW.amount >
  COALESCE((SELECT gross_amount FROM payments WHERE id=NEW.payment_id),0)
)
BEGIN SELECT RAISE(ABORT, 'refund total exceeds payment gross amount'); END;

CREATE INDEX IF NOT EXISTS idx_settlement_profiles_enabled ON merchant_settlement_profiles(enabled, payment_plan);
CREATE INDEX IF NOT EXISTS idx_settlement_sources_eligible ON merchant_settlement_sources(merchant_id, settlement_eligible, occurred_at);
CREATE INDEX IF NOT EXISTS idx_settlement_sources_reserved ON merchant_settlement_sources(reserved_statement_id);
CREATE INDEX IF NOT EXISTS idx_settlements_merchant_period ON merchant_settlements(merchant_id, period_start_utc, period_end_exclusive_utc, status);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON merchant_settlements(status, created_at);
CREATE INDEX IF NOT EXISTS idx_settlement_items_statement ON merchant_settlement_items(settlement_id, item_type);
CREATE INDEX IF NOT EXISTS idx_settlement_adjustments_pending ON merchant_settlement_adjustments(merchant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_settlement_adjustments_effective ON merchant_settlement_adjustments(merchant_id, status, eligible_period_start);
CREATE INDEX IF NOT EXISTS idx_offset_ledger_balance ON merchant_offset_ledger(merchant_id, status, effective_at);
CREATE INDEX IF NOT EXISTS idx_settlement_events_statement ON merchant_settlement_events(settlement_id, created_at);
CREATE INDEX IF NOT EXISTS idx_settlement_documents_statement ON settlement_document_versions(settlement_id, pdf_version DESC);

CREATE TRIGGER IF NOT EXISTS trg_locked_settlement_amounts_immutable
BEFORE UPDATE OF total_order_amount_minor,expected_deposit_amount_minor,actual_deposit_collected_minor,deposit_variance_minor,
  processing_fee_minor,actual_fee_total_minor,estimated_fee_total_minor,missing_actual_fee_count,
  platform_service_fee_minor,tax_reserve_minor,withholding_minor,adjustments_minor,merchant_payable_minor,
  net_settlement_minor,merchant_due_to_platform_minor,carry_forward_balance_minor,
  prior_offset_amount_minor,current_offset_amount_minor,cumulative_offset_amount_minor,remaining_offset_amount_minor,
  ongoing_platform_fee_minor,calculation_version,rules_snapshot_json
ON merchant_settlements
WHEN OLD.status IN ('locked','paid','void')
BEGIN SELECT RAISE(ABORT, 'locked settlement amounts are immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_locked_settlement_items_immutable_update
BEFORE UPDATE ON merchant_settlement_items
WHEN (SELECT status FROM merchant_settlements WHERE id=OLD.settlement_id) IN ('locked','paid','void')
BEGIN SELECT RAISE(ABORT, 'locked settlement items are immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_locked_settlement_items_immutable_delete
BEFORE DELETE ON merchant_settlement_items
WHEN (SELECT status FROM merchant_settlements WHERE id=OLD.settlement_id) IN ('locked','paid','void')
BEGIN SELECT RAISE(ABORT, 'locked settlement items are immutable'); END;

-- A source can only become an item after the same draft has reserved it. This
-- closes the gap between concurrent preview/create requests without relying on
-- a preceding SELECT result.
CREATE TRIGGER IF NOT EXISTS trg_settlement_item_requires_reservation
BEFORE INSERT ON merchant_settlement_items
WHEN NEW.settlement_source_id IS NOT NULL
  AND COALESCE(
    (SELECT reserved_statement_id FROM merchant_settlement_sources WHERE id=NEW.settlement_source_id),
    ''
  ) <> NEW.settlement_id
BEGIN SELECT RAISE(ABORT, 'settlement source is not reserved by this statement'); END;

CREATE TRIGGER IF NOT EXISTS trg_settlement_source_reserved_immutable
BEFORE UPDATE OF merchant_id,payment_id,order_id,collection_role,settlement_eligible,order_total_amount_minor,
  expected_deposit_amount_minor,actual_collected_amount_minor,provider_fee_actual_minor,occurred_at
ON merchant_settlement_sources
WHEN OLD.reserved_statement_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'reserved settlement source is immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_settlement_source_single_active_statement
BEFORE INSERT ON merchant_settlement_items
WHEN NEW.settlement_source_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM merchant_settlement_items existing
  JOIN merchant_settlements statement ON statement.id=existing.settlement_id
  WHERE existing.settlement_source_id=NEW.settlement_source_id
    AND existing.settlement_id<>NEW.settlement_id AND statement.status<>'void'
)
BEGIN SELECT RAISE(ABORT, 'settlement source already belongs to an active statement'); END;

CREATE TRIGGER IF NOT EXISTS trg_settlement_document_immutable_update
BEFORE UPDATE ON settlement_document_versions
BEGIN SELECT RAISE(ABORT, 'settlement document version is immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_settlement_document_immutable_delete
BEFORE DELETE ON settlement_document_versions
BEGIN SELECT RAISE(ABORT, 'settlement document version is immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_offset_ledger_balance_bounds
BEFORE INSERT ON merchant_offset_ledger
WHEN NEW.status='posted' AND (
  COALESCE((SELECT SUM(amount_minor) FROM merchant_offset_ledger WHERE merchant_id=NEW.merchant_id AND status='posted'),0) + NEW.amount_minor < 0
  OR COALESCE((SELECT SUM(amount_minor) FROM merchant_offset_ledger WHERE merchant_id=NEW.merchant_id AND status='posted'),0) + NEW.amount_minor >
     COALESCE((SELECT offset_target_amount_minor FROM merchant_settlement_profiles WHERE merchant_id=NEW.merchant_id),0)
)
BEGIN SELECT RAISE(ABORT, 'offset ledger balance out of bounds'); END;
