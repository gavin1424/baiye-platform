-- Preserve all existing partner, commission, settlement and contract records.
-- `approved_at` distinguishes a newly submitted pending_contract application
-- from an application the administrator has approved and is waiting to activate.
ALTER TABLE partners ADD COLUMN approved_at TEXT;
ALTER TABLE partners ADD COLUMN approved_by TEXT;

CREATE INDEX IF NOT EXISTS idx_partners_activation_review
  ON partners(status, approved_at, created_at);
