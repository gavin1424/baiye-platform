-- Forward-only reconciliation for Production drift discovered on 2026-09-12.
--
-- 0033_beef_noodle_line_liff_ordering_v1.sql SHA-256:
-- 67B30106D1F83B8CEC0811A34100947B49B102390E84E0D691968E4095A0B455
--
-- Production already contains every schema and data effect of 0033, but the
-- Wrangler-managed d1_migrations row is absent. This migration intentionally
-- performs no application-schema or business-data rewrite. The CHECK guard
-- aborts unless the complete 0033 manifest is still materially equivalent.

CREATE TABLE IF NOT EXISTS _reconcile_0033_guard_20260912 (
  verified INTEGER NOT NULL CHECK(verified = 1)
);

DELETE FROM _reconcile_0033_guard_20260912;

INSERT INTO _reconcile_0033_guard_20260912(verified)
SELECT CASE WHEN
  -- All ten ALTER TABLE columns, including type, nullability and defaults.
  (SELECT COUNT(*) FROM pragma_table_info('merchant_line_integrations') WHERE
    (name='messaging_api_channel_id' AND type='TEXT' AND "notnull"=0 AND dflt_value IS NULL AND pk=0) OR
    (name='line_login_channel_id' AND type='TEXT' AND "notnull"=0 AND dflt_value IS NULL AND pk=0) OR
    (name='liff_id' AND type='TEXT' AND "notnull"=0 AND dflt_value IS NULL AND pk=0) OR
    (name='add_friend_option' AND type='TEXT' AND "notnull"=1 AND dflt_value='''none''' AND pk=0) OR
    (name='linked_official_account' AND type='INTEGER' AND "notnull"=1 AND dflt_value='0' AND pk=0) OR
    (name='webhook_url' AND type='TEXT' AND "notnull"=0 AND dflt_value IS NULL AND pk=0) OR
    (name='webhook_enabled' AND type='INTEGER' AND "notnull"=1 AND dflt_value='0' AND pk=0) OR
    (name='follow_webhook_enabled' AND type='INTEGER' AND "notnull"=1 AND dflt_value='0' AND pk=0) OR
    (name='unfollow_webhook_enabled' AND type='INTEGER' AND "notnull"=1 AND dflt_value='0' AND pk=0) OR
    (name='webhook_verified_at' AND type='TEXT' AND "notnull"=0 AND dflt_value IS NULL AND pk=0)
  ) = 10
  -- The ALTER-provided CHECK constraints remain present in the stored schema.
  AND (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='merchant_line_integrations'
    AND instr(sql, 'CHECK(add_friend_option IN (''none'',''normal'',''aggressive''))') > 0
    AND instr(sql, 'CHECK(linked_official_account IN (0,1))') > 0
    AND instr(sql, 'CHECK(webhook_enabled IN (0,1))') > 0
    AND instr(sql, 'CHECK(follow_webhook_enabled IN (0,1))') > 0
    AND instr(sql, 'CHECK(unfollow_webhook_enabled IN (0,1))') > 0
  ) = 1
  -- The friendships table has exactly the six expected columns and composite PK.
  AND (SELECT COUNT(*) FROM pragma_table_info('merchant_line_friendships')) = 6
  AND (SELECT COUNT(*) FROM pragma_table_info('merchant_line_friendships') WHERE
    (name='merchant_id' AND type='TEXT' AND "notnull"=1 AND dflt_value IS NULL AND pk=1) OR
    (name='line_user_id_hash' AND type='TEXT' AND "notnull"=1 AND dflt_value IS NULL AND pk=2) OR
    (name='status' AND type='TEXT' AND "notnull"=1 AND dflt_value IS NULL AND pk=0) OR
    (name='last_followed_at' AND type='TEXT' AND "notnull"=0 AND dflt_value IS NULL AND pk=0) OR
    (name='last_unfollowed_at' AND type='TEXT' AND "notnull"=0 AND dflt_value IS NULL AND pk=0) OR
    (name='updated_at' AND type='TEXT' AND "notnull"=1 AND dflt_value='CURRENT_TIMESTAMP' AND pk=0)
  ) = 6
  AND (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='merchant_line_friendships'
    AND instr(sql, 'CHECK(status IN (''friend'',''blocked''))') > 0
  ) = 1
  -- The single expected FK points merchant_id to merchants(id).
  AND (SELECT COUNT(*) FROM pragma_foreign_key_list('merchant_line_friendships')
    WHERE "table"='merchants' AND "from"='merchant_id' AND "to"='id'
      AND on_update='NO ACTION' AND on_delete='NO ACTION' AND match='NONE') = 1
  AND (SELECT COUNT(*) FROM pragma_foreign_key_list('merchant_line_friendships')) = 1
  -- Both the composite PK uniqueness and the explicit status index are exact.
  AND (SELECT group_concat(name, ',') FROM (SELECT name FROM pragma_index_info('sqlite_autoindex_merchant_line_friendships_1') ORDER BY seqno)) = 'merchant_id,line_user_id_hash'
  AND (SELECT COUNT(*) FROM pragma_index_list('merchant_line_friendships')
    WHERE name='sqlite_autoindex_merchant_line_friendships_1' AND "unique"=1 AND origin='pk' AND partial=0) = 1
  AND (SELECT group_concat(name, ',') FROM (SELECT name FROM pragma_index_info('idx_merchant_line_friendships_status') ORDER BY seqno)) = 'merchant_id,status,updated_at'
  AND (SELECT COUNT(*) FROM pragma_index_list('merchant_line_friendships')
    WHERE name='idx_merchant_line_friendships_status' AND "unique"=0 AND origin='c' AND partial=0) = 1
  -- Existing rows satisfy all constraints introduced by 0033.
  AND (SELECT COUNT(*) FROM merchant_line_friendships
    WHERE status IS NULL OR status NOT IN ('friend','blocked')) = 0
  AND (SELECT COUNT(*) FROM merchant_line_integrations
    WHERE add_friend_option NOT IN ('none','normal','aggressive')
       OR linked_official_account NOT IN (0,1)
       OR webhook_enabled NOT IN (0,1)
       OR follow_webhook_enabled NOT IN (0,1)
       OR unfollow_webhook_enabled NOT IN (0,1)) = 0
  -- The only 0033 backfill target has the exact expected values.
  AND (SELECT COUNT(*) FROM merchant_line_integrations
    WHERE merchant_id='demo_beef_noodle'
      AND integration_mode='linked_line_login'
      AND webhook_url='https://chuang-baiye-ai.baiye-platform.workers.dev/webhooks/line/demo_beef_noodle'
      AND updated_at IS NOT NULL) = 1
THEN 1 ELSE 0 END;

-- Wrangler 4.131.1 exposes create/list/apply but no supported mark-applied
-- command. This metadata row is written only after the complete guard passes.
INSERT OR IGNORE INTO d1_migrations(name)
VALUES('0033_beef_noodle_line_liff_ordering_v1.sql');

INSERT OR IGNORE INTO audit_logs(
  id, actor_type, actor_id, action, entity_type, entity_id, metadata
) VALUES(
  'audit_schema_reconcile_0033_20260912',
  'system',
  'production-migration-reconciliation',
  'SCHEMA_MIGRATION_RECONCILED',
  'd1_migration',
  '0033_beef_noodle_line_liff_ordering_v1.sql',
  '{"source_migration_sha256":"67B30106D1F83B8CEC0811A34100947B49B102390E84E0D691968E4095A0B455","manifest_items":13,"schema_rewritten":false,"business_data_rewritten":false}'
);

DROP TABLE _reconcile_0033_guard_20260912;
