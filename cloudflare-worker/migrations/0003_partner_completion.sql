-- Partner completion: immutable contract artifacts and locked settlement accounting.
ALTER TABLE contract_signatures ADD COLUMN signature_data TEXT;
ALTER TABLE contract_signatures ADD COLUMN pdf_object_key TEXT;
ALTER TABLE contract_signatures ADD COLUMN document_hash TEXT;

ALTER TABLE partner_leads ADD COLUMN attribution_source TEXT;
ALTER TABLE orders ADD COLUMN lead_id TEXT REFERENCES partner_leads(id);

ALTER TABLE settlements ADD COLUMN paid_method TEXT;
ALTER TABLE settlements ADD COLUMN paid_reference TEXT;
ALTER TABLE settlements ADD COLUMN paid_by TEXT;
ALTER TABLE commission_adjustments ADD COLUMN settlement_id TEXT REFERENCES settlements(id);

CREATE TABLE IF NOT EXISTS settlement_adjustment_items (
  id TEXT PRIMARY KEY,
  settlement_id TEXT NOT NULL REFERENCES settlements(id),
  adjustment_id TEXT NOT NULL REFERENCES commission_adjustments(id),
  amount REAL NOT NULL,
  UNIQUE(settlement_id, adjustment_id)
);

CREATE INDEX IF NOT EXISTS idx_settlement_adjustments_unsettled ON commission_adjustments(settlement_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_partner_lead ON orders(partner_id, lead_id);
