DROP TRIGGER IF EXISTS trg_partner_contract_period_delete;
DROP TRIGGER IF EXISTS trg_partner_contract_period_core_immutable;
DROP TRIGGER IF EXISTS trg_partner_identity_immutable;
DROP TRIGGER IF EXISTS trg_partner_contract_version_signed_content_immutable;
DROP TRIGGER IF EXISTS trg_partner_contract_version_signed_delete;
DROP INDEX IF EXISTS idx_partner_contract_periods_partner_end;
DROP INDEX IF EXISTS idx_partners_id_number_hash_unique;

DELETE FROM contract_versions
WHERE id='contractor_partner_v1_5'
  AND NOT EXISTS (SELECT 1 FROM contract_signatures WHERE contract_version_id='contractor_partner_v1_5');

DROP TABLE IF EXISTS partner_contract_periods;

-- SQLite additive columns are intentionally retained for safe forward compatibility.
