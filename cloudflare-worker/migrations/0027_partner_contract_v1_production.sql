PRAGMA foreign_keys = ON;

-- Production release of the exact contract_v1_3 legal body reviewed by counsel.
-- Only the release-control heading version and LEGAL_REVIEW_REQUIRED banner are
-- removed; all eight numbered provisions are copied byte-for-byte from v1.3.
ALTER TABLE contract_versions ADD COLUMN approved_at TEXT;

ALTER TABLE contract_signatures ADD COLUMN contract_name TEXT;
ALTER TABLE contract_signatures ADD COLUMN contract_version_snapshot TEXT;
ALTER TABLE contract_signatures ADD COLUMN contract_snapshot TEXT;
ALTER TABLE contract_signatures ADD COLUMN timezone TEXT;
ALTER TABLE contract_signatures ADD COLUMN consents_json TEXT;
ALTER TABLE contract_signatures ADD COLUMN device_metadata_json TEXT;
ALTER TABLE contract_signatures ADD COLUMN final_confirmed_at TEXT;
ALTER TABLE contract_signatures ADD COLUMN submitted_at TEXT;

-- Preserve the original 2026-08-21 draft row and free the public v1.0 label.
UPDATE contract_versions
SET version='draft-v1.0-20260821'
WHERE id='contract_v1_0' AND version='v1.0';

CREATE TABLE partner_contract_v1_release_guard (
  ok INTEGER NOT NULL CHECK(ok=1)
);
INSERT INTO partner_contract_v1_release_guard(ok)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM contract_versions
  WHERE id='contract_v1_3'
    AND content_hash='yzhu-RpN0LNxzSO5FPv_I2XIECTPfejqa6uVrb6dD94'
    AND legal_review_status='pending_review'
) THEN 1 ELSE 0 END;

UPDATE contract_versions SET is_active=0 WHERE is_active=1;

INSERT INTO contract_versions (
  id,version,title,content_html,content_hash,effective_date,is_active,
  requires_resign,legal_review_required,legal_review_status,reviewed_by,
  reviewed_at,legal_counsel_reference,approved_content_hash,approved_at
)
SELECT
  'contractor_partner_production_v1_0',
  'v1.0',
  '創百業智慧鏈｜承攬夥伴合作契約',
  REPLACE(
    REPLACE(
      content_html,
      '創百業智慧鏈｜承攬夥伴合作契約 v1.3',
      '創百業智慧鏈｜承攬夥伴合作契約 v1.0'
    ),
    '<p><strong>LEGAL_REVIEW_REQUIRED：本版本為系統法律審閱草稿，正式大規模使用前應由台灣執業律師依實際合作流程完成最終法律審閱。若依法應適用強制性法令，仍依該法令辦理。</strong></p>',
    ''
  ),
  'hlgca_PH1cthn_ZFlQh-vr4awbgFsMCr8JwHpcQWgIw',
  '2026-09-08',
  1,
  1,
  1,
  'approved',
  'authorized_admin',
  CURRENT_TIMESTAMP,
  'LEGAL_REVIEW_COMPLETED_2026-09-08',
  'hlgca_PH1cthn_ZFlQh-vr4awbgFsMCr8JwHpcQWgIw',
  CURRENT_TIMESTAMP
FROM contract_versions
WHERE id='contract_v1_3'
  AND content_hash='yzhu-RpN0LNxzSO5FPv_I2XIECTPfejqa6uVrb6dD94';

DROP TABLE partner_contract_v1_release_guard;

CREATE TRIGGER IF NOT EXISTS trg_partner_contract_version_approved_content_update
BEFORE UPDATE OF version,title,content_html,content_hash,effective_date,approved_content_hash,approved_at
ON contract_versions
WHEN OLD.legal_review_status='approved'
  OR EXISTS (SELECT 1 FROM contract_signatures WHERE contract_version_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT,'APPROVED_CONTRACT_VERSION_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_partner_contract_version_approved_delete
BEFORE DELETE ON contract_versions
WHEN OLD.legal_review_status='approved'
  OR EXISTS (SELECT 1 FROM contract_signatures WHERE contract_version_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT,'APPROVED_CONTRACT_VERSION_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_partner_contract_audit_immutable_update
BEFORE UPDATE ON audit_logs
WHEN OLD.entity_type IN ('contract_version','contract_signature')
  OR OLD.action LIKE 'partner.contract.%'
BEGIN
  SELECT RAISE(ABORT,'CONTRACT_AUDIT_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_partner_contract_audit_immutable_delete
BEFORE DELETE ON audit_logs
WHEN OLD.entity_type IN ('contract_version','contract_signature')
  OR OLD.action LIKE 'partner.contract.%'
BEGIN
  SELECT RAISE(ABORT,'CONTRACT_AUDIT_IMMUTABLE');
END;

INSERT INTO audit_logs (
  id,actor_type,actor_id,action,entity_type,entity_id,metadata,ip_address
) VALUES (
  'audit_partner_contract_v1_production_release',
  'admin',
  'authorized_admin',
  'partner.contract.production_activated',
  'contract_version',
  'contractor_partner_production_v1_0',
  '{"version":"v1.0","status":"approved","content_hash":"hlgca_PH1cthn_ZFlQh-vr4awbgFsMCr8JwHpcQWgIw","source_contract_id":"contract_v1_3","legal_review_approved":true}',
  NULL
);
