-- Unified phone + 8-digit numeric password authentication.
-- Existing hashes are copied, never recalculated or overwritten.
PRAGMA foreign_keys=ON;

ALTER TABLE partner_sessions ADD COLUMN credential_assurance TEXT
  CHECK(credential_assurance IS NULL OR credential_assurance='password_authenticated');

INSERT OR IGNORE INTO platform_member_login_credentials(
  id,platform_member_id,credential_type,password_hash,password_salt,password_algorithm,
  password_iterations,failed_attempts,locked_until,reset_required,status,password_updated_at,
  created_at,updated_at
)
SELECT
  'pmlc_migrated_' || lower(hex(randomblob(16))),l.platform_member_id,'numeric_password_8',
  c.password_hash,c.password_salt,c.password_algorithm,c.password_iterations,c.failed_attempts,
  c.locked_until,c.reset_required,c.status,c.password_updated_at,c.created_at,c.updated_at
FROM merchant_owner_links l
JOIN merchant_login_credentials c
  ON c.merchant_id=l.merchant_id
 AND c.merchant_user_id=l.merchant_user_id
 AND c.credential_type='numeric_password_8'
WHERE l.status='active';

