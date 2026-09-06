-- Additive hardening after 0028: a settlement cannot be marked paid without
-- an explicitly non-test payout provider, Admin confirmation and a transfer reference.

ALTER TABLE advisor_settlement_statements ADD COLUMN payout_provider TEXT;

DROP TRIGGER trg_advisor_settlement_paid_guard;
CREATE TRIGGER trg_advisor_settlement_paid_guard BEFORE UPDATE OF status ON advisor_settlement_statements
WHEN NEW.status='paid' AND (
  NEW.payout_provider IS NULL OR
  NEW.payout_provider IN('TEST_PROVIDER','PAYMENT_PROVIDER_DISABLED','PAYOUT_PROVIDER_DISABLED') OR
  NEW.transfer_reference IS NULL OR
  NEW.admin_confirmed_at IS NULL
)
BEGIN SELECT RAISE(ABORT,'ADVISOR_PAYOUT_EVIDENCE_REQUIRED'); END;
