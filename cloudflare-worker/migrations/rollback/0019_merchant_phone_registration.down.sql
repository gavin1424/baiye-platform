PRAGMA foreign_keys = OFF;

DROP TRIGGER IF EXISTS trg_merchant_owner_phone_immutable;
DROP TRIGGER IF EXISTS trg_merchant_owner_link_consistency_insert;
DROP TRIGGER IF EXISTS trg_merchant_owner_link_delete;
DROP TRIGGER IF EXISTS trg_merchant_owner_link_update_identity;
DROP INDEX IF EXISTS idx_merchant_session_assurance;
DROP INDEX IF EXISTS idx_merchant_login_challenge;
DROP INDEX IF EXISTS idx_merchant_owner_member;
DROP INDEX IF EXISTS idx_merchant_users_phone;
DROP TABLE IF EXISTS merchant_login_challenges;
DROP TABLE IF EXISTS merchant_owner_links;
DROP TABLE IF EXISTS merchant_applications;

-- SQLite cannot safely DROP the additive legacy-compatible columns in-place.
-- Rollback disables the new routes in the previous Worker while retaining them.
PRAGMA foreign_keys = ON;
