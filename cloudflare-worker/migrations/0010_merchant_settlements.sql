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
  merchant_payable_minor INTEGER NOT NULL DEFAULT 0 CHECK(merchant_payable_minor >= 0),
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
  amount_minor INTEGER NOT NULL CHECK(amount_minor != 0),
  reason TEXT NOT NULL,
  source_reference TEXT,
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
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','completed')),
  http_status INTEGER,
  response_json TEXT CHECK(response_json IS NULL OR json_valid(response_json)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE(operation_type, idempotency_key),
  FOREIGN KEY(settlement_id, merchant_id) REFERENCES merchant_settlements(id, merchant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_settlement_profiles_enabled ON merchant_settlement_profiles(enabled, payment_plan);
CREATE INDEX IF NOT EXISTS idx_settlement_sources_eligible ON merchant_settlement_sources(merchant_id, settlement_eligible, occurred_at);
CREATE INDEX IF NOT EXISTS idx_settlement_sources_reserved ON merchant_settlement_sources(reserved_statement_id);
CREATE INDEX IF NOT EXISTS idx_settlements_merchant_period ON merchant_settlements(merchant_id, period_start_utc, period_end_exclusive_utc, status);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON merchant_settlements(status, created_at);
CREATE INDEX IF NOT EXISTS idx_settlement_items_statement ON merchant_settlement_items(settlement_id, item_type);
CREATE INDEX IF NOT EXISTS idx_settlement_adjustments_pending ON merchant_settlement_adjustments(merchant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_settlement_events_statement ON merchant_settlement_events(settlement_id, created_at);
CREATE INDEX IF NOT EXISTS idx_settlement_documents_statement ON settlement_document_versions(settlement_id, pdf_version DESC);

CREATE TRIGGER IF NOT EXISTS trg_locked_settlement_amounts_immutable
BEFORE UPDATE OF total_order_amount_minor,expected_deposit_amount_minor,actual_deposit_collected_minor,deposit_variance_minor,
  processing_fee_minor,actual_fee_total_minor,estimated_fee_total_minor,missing_actual_fee_count,
  platform_service_fee_minor,tax_reserve_minor,withholding_minor,adjustments_minor,merchant_payable_minor,
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
