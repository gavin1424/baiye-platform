ALTER TABLE merchant_sites ADD COLUMN header_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE merchant_sites ADD COLUMN footer_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE merchant_page_versions ADD COLUMN page_snapshot_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE merchant_page_versions ADD COLUMN version_note TEXT;
ALTER TABLE merchant_site_pages ADD COLUMN archived_at TEXT;
ALTER TABLE merchant_media_assets ADD COLUMN file_name TEXT;
ALTER TABLE merchant_media_assets ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE merchant_domains ADD COLUMN verification_token_hash TEXT;
ALTER TABLE merchant_domains ADD COLUMN dns_target TEXT;
ALTER TABLE merchant_domains ADD COLUMN last_checked_at TEXT;

CREATE TABLE merchant_page_access_tokens(
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_type TEXT NOT NULL CHECK(token_type IN('preview','page_access','password')),
  expires_at TEXT,
  revoked_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id,page_id) REFERENCES merchant_site_pages(merchant_id,id)
);

CREATE TABLE merchant_cms_audit_logs(
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_published_page_version_update
BEFORE UPDATE ON merchant_page_versions
WHEN EXISTS(SELECT 1 FROM merchant_site_publications WHERE version_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'published page version immutable'); END;

CREATE TRIGGER trg_published_page_version_delete
BEFORE DELETE ON merchant_page_versions
WHEN EXISTS(SELECT 1 FROM merchant_site_publications WHERE version_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'published page version immutable'); END;

CREATE TRIGGER trg_published_page_block_update
BEFORE UPDATE ON merchant_page_blocks
WHEN EXISTS(SELECT 1 FROM merchant_site_publications WHERE version_id=OLD.version_id)
BEGIN SELECT RAISE(ABORT,'published page block immutable'); END;

CREATE TRIGGER trg_published_page_block_delete
BEFORE DELETE ON merchant_page_blocks
WHEN EXISTS(SELECT 1 FROM merchant_site_publications WHERE version_id=OLD.version_id)
BEGIN SELECT RAISE(ABORT,'published page block immutable'); END;

CREATE INDEX idx_cms_audit_merchant ON merchant_cms_audit_logs(merchant_id,created_at);
CREATE INDEX idx_page_access_lookup ON merchant_page_access_tokens(token_hash,token_type,expires_at,revoked_at);
CREATE INDEX idx_page_blocks_version_sort ON merchant_page_blocks(version_id,sort_order);
