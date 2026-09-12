-- Forward-only SoftPOS customer-document wording revision.
-- The signed v1.1 rows, PDFs, artifacts, evidence, and hashes remain immutable.
-- Payment amounts and schedule are unchanged.
INSERT OR IGNORE INTO merchant_contract_versions(
  id,version,title,content_html,content_hash,effective_date,legal_review_status,
  legal_review_required,is_active,requires_resign,staging_signing_enabled
)
SELECT
  'merchant_softpos_v1_2_24000_payment','merchant_softpos_v1_2_24000_payment',
  replace(title,'V1.1','V1.2'),
  replace(replace(content_html,'顯示 QR Code','顯示點餐入口'),'QR Ordering','智慧點餐'),
  '83yaTB1CAFALduFTVT0O93FIZKnbnxwFwPaRRRRh_nY',date('now'),
  'pending_review',1,0,0,1
FROM merchant_contract_versions
WHERE id='merchant_softpos_v1_1_24000_payment'
  AND content_hash='D_jCMCLkfs_bnEDyrUumImJPKjZpWLCZlvWtAyRX2_0';

DROP TRIGGER IF EXISTS trg_merchant_plan_catalog_no_update;
UPDATE merchant_plan_catalog
SET contract_version_id='merchant_softpos_v1_2_24000_payment'
WHERE plan_id='baiye_softpos_24000'
  AND contract_version_id='merchant_softpos_v1_1_24000_payment'
  AND contract_total_amount_minor=2400000
  AND payment_due_at_signature_minor=600000
  AND remaining_amount_minor=1800000
  AND trial_period_months=3
  AND post_trial_payment_minor=1800000
  AND EXISTS(SELECT 1 FROM merchant_contract_versions WHERE id='merchant_softpos_v1_2_24000_payment');
CREATE TRIGGER IF NOT EXISTS trg_merchant_plan_catalog_no_update
BEFORE UPDATE ON merchant_plan_catalog BEGIN SELECT RAISE(ABORT,'MERCHANT_PLAN_CATALOG_IMMUTABLE'); END;
