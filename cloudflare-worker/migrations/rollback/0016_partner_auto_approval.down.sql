DROP TRIGGER IF EXISTS partner_application_identity_immutable_delete;
DROP TRIGGER IF EXISTS partner_application_identity_immutable_update;
DROP INDEX IF EXISTS idx_partners_auto_approval;
DROP TABLE IF EXISTS partner_application_identities;
ALTER TABLE partners DROP COLUMN auto_approved_at;
ALTER TABLE partners DROP COLUMN approval_mode;

