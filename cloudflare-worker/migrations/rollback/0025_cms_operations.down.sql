DROP TRIGGER IF EXISTS trg_published_page_block_delete;
DROP TRIGGER IF EXISTS trg_published_page_block_update;
DROP TRIGGER IF EXISTS trg_published_page_version_delete;
DROP TRIGGER IF EXISTS trg_published_page_version_update;
DROP INDEX IF EXISTS idx_page_blocks_version_sort;
DROP INDEX IF EXISTS idx_page_access_lookup;
DROP INDEX IF EXISTS idx_cms_audit_merchant;
DROP TABLE IF EXISTS merchant_cms_audit_logs;
DROP TABLE IF EXISTS merchant_page_access_tokens;
-- D1 does not safely drop added columns in-place. Recovery is a forward migration;
-- existing CMS rows and published snapshots remain preserved.
