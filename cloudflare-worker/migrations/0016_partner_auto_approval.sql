PRAGMA foreign_keys = ON;

ALTER TABLE partners ADD COLUMN approval_mode TEXT
  CHECK(approval_mode IN ('manual','automatic'));
ALTER TABLE partners ADD COLUMN auto_approved_at TEXT;

CREATE TABLE partner_application_identities (
  phone_normalized TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(partner_id) REFERENCES partners(id)
);

-- Preserve historical rows without guessing which duplicate identity is authoritative.
-- Existing records are linked only when their stored phone is already canonical.
INSERT OR IGNORE INTO partner_application_identities(phone_normalized,partner_id)
SELECT phone,id FROM partners
WHERE phone GLOB '09[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
  AND length(phone)=10
ORDER BY created_at,id;

CREATE INDEX idx_partners_auto_approval
  ON partners(approval_mode,auto_approved_at,created_at);

CREATE TRIGGER partner_application_identity_immutable_update
BEFORE UPDATE ON partner_application_identities
BEGIN SELECT RAISE(ABORT,'PARTNER_APPLICATION_IDENTITY_IMMUTABLE'); END;

CREATE TRIGGER partner_application_identity_immutable_delete
BEFORE DELETE ON partner_application_identities
BEGIN SELECT RAISE(ABORT,'PARTNER_APPLICATION_IDENTITY_IMMUTABLE'); END;

