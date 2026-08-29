PRAGMA foreign_keys = OFF;
DROP TRIGGER IF EXISTS trg_merchant_contract_version_approved_content;
DROP TRIGGER IF EXISTS trg_merchant_contract_terms_approved_immutable;
DROP TRIGGER IF EXISTS trg_merchant_contract_artifact_immutable_delete;
DROP TRIGGER IF EXISTS trg_merchant_contract_artifact_immutable_update;
DROP TRIGGER IF EXISTS trg_merchant_contract_signature_immutable_delete;
DROP TRIGGER IF EXISTS trg_merchant_contract_signature_immutable_update;
DROP TRIGGER IF EXISTS trg_partner_contract_signature_immutable_delete;
DROP TRIGGER IF EXISTS trg_partner_contract_signature_immutable_update;
DROP TABLE IF EXISTS contract_sign_operations;
DROP TABLE IF EXISTS merchant_contract_events;
DROP TABLE IF EXISTS merchant_contract_artifacts;
DROP TABLE IF EXISTS merchant_contract_signatures;
DROP TABLE IF EXISTS merchant_contract_invites;
DROP TABLE IF EXISTS merchant_contract_commercial_terms;
DROP TABLE IF EXISTS merchant_contract_versions;
DROP INDEX IF EXISTS uq_partner_contract_public_id;
PRAGMA foreign_keys = ON;
-- SQLite cannot safely drop the appended legacy-table columns in-place. A
-- Production rollback keeps those nullable columns and reverts Worker/UI only.
