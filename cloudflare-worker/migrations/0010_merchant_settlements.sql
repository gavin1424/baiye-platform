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
  offset_target_amount_minor INTEGER NOT NULL DEFAULT 1800000 CHECK(offset_target_amount_minor >= 0),
  continue_platform_fee_after_offset INTEGER NOT NULL DEFAULT 0 CHECK(continue_platform_fee_after_offset IN (0,1)),
  settlement_day INTEGER NOT NULL DEFAULT 10 CHECK(settlement_day BETWEEN 1 AND 28),
  legal_review_status TEXT NOT NULL DEFAULT 'pending' CHECK(legal_review_status IN ('pending','approved','rejected')),
  accounting_review_status TEXT NOT NULL DEFAULT 'pending' CHECK(accounting_review_status IN ('pending','approved','rejected')),
  effective_from TEXT,
  effective_to TEXT,
  calculation_version TEXT NOT NULL DEFAULT 'settlement-v1',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
  CHECK(payment_plan = 'sales_offset_18000' OR continue_platform_fee_after_offset IN (0,1))
);

CREATE TABLE IF NOT EXISTS merchant_settlements (
  id TEXT PRIMARY KEY,
  statement_no TEXT NOT NULL UNIQUE,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  profile_id TEXT NOT NULL REFERENCES merchant_settlement_profiles(id) ON DELETE RESTRICT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','locked','paid','void')),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(length(currency)=3),
  total_order_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(total_order_amount_minor >= 0),
  deposit_collected_minor INTEGER NOT NULL DEFAULT 0 CHECK(deposit_collected_minor >= 0),
  processing_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK(processing_fee_minor >= 0),
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
  pdf_object_key TEXT,
  pdf_hash TEXT,
  locked_at TEXT,
  paid_at TEXT,
  voided_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(period_end >= period_start),
  CHECK(status != 'paid' OR (paid_at IS NOT NULL AND transfer_amount_minor IS NOT NULL AND transfer_reference IS NOT NULL)),
  CHECK(status != 'void' OR voided_at IS NOT NULL),
  UNIQUE(merchant_id, period_start, period_end),
  UNIQUE(id, merchant_id)
);

CREATE TABLE IF NOT EXISTS merchant_settlement_items (
  id TEXT PRIMARY KEY,
  settlement_id TEXT NOT NULL REFERENCES merchant_settlements(id) ON DELETE RESTRICT,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  item_type TEXT NOT NULL CHECK(item_type IN ('order','payment','refund','processing_fee','adjustment')),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE RESTRICT,
  payment_id TEXT REFERENCES payments(id) ON DELETE RESTRICT,
  refund_id TEXT REFERENCES refunds(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL,
  provider_fee_actual INTEGER NOT NULL DEFAULT 0 CHECK(provider_fee_actual IN (0,1)),
  occurred_at TEXT NOT NULL,
  source_snapshot_json TEXT NOT NULL CHECK(json_valid(source_snapshot_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_type, source_id),
  UNIQUE(settlement_id, item_type, source_id),
  FOREIGN KEY(settlement_id, merchant_id) REFERENCES merchant_settlements(id, merchant_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS merchant_settlement_adjustments (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  source_settlement_id TEXT REFERENCES merchant_settlements(id) ON DELETE RESTRICT,
  applied_settlement_id TEXT REFERENCES merchant_settlements(id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('refund','fee_difference','chargeback','correction','other')),
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
  idempotency_key TEXT UNIQUE,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(settlement_id, merchant_id) REFERENCES merchant_settlements(id, merchant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_settlement_profiles_enabled ON merchant_settlement_profiles(enabled, payment_plan);
CREATE INDEX IF NOT EXISTS idx_settlements_merchant_period ON merchant_settlements(merchant_id, period_start, period_end, status);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON merchant_settlements(status, created_at);
CREATE INDEX IF NOT EXISTS idx_settlement_items_statement ON merchant_settlement_items(settlement_id, item_type);
CREATE INDEX IF NOT EXISTS idx_settlement_items_merchant ON merchant_settlement_items(merchant_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_settlement_adjustments_pending ON merchant_settlement_adjustments(merchant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_settlement_events_statement ON merchant_settlement_events(settlement_id, created_at);

CREATE TRIGGER IF NOT EXISTS trg_locked_settlement_amounts_immutable
BEFORE UPDATE OF total_order_amount_minor,deposit_collected_minor,processing_fee_minor,platform_service_fee_minor,
  tax_reserve_minor,withholding_minor,adjustments_minor,merchant_payable_minor,prior_offset_amount_minor,
  current_offset_amount_minor,cumulative_offset_amount_minor,remaining_offset_amount_minor,ongoing_platform_fee_minor,
  calculation_version,rules_snapshot_json
ON merchant_settlements
WHEN OLD.status IN ('locked','paid','void')
BEGIN
  SELECT RAISE(ABORT, 'locked settlement amounts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_locked_settlement_items_immutable_update
BEFORE UPDATE ON merchant_settlement_items
WHEN (SELECT status FROM merchant_settlements WHERE id=OLD.settlement_id) IN ('locked','paid','void')
BEGIN
  SELECT RAISE(ABORT, 'locked settlement items are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_locked_settlement_items_immutable_delete
BEFORE DELETE ON merchant_settlement_items
WHEN (SELECT status FROM merchant_settlements WHERE id=OLD.settlement_id) IN ('locked','paid','void')
BEGIN
  SELECT RAISE(ABORT, 'locked settlement items are immutable');
END;
