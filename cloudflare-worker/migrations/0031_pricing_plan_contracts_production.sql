PRAGMA foreign_keys = ON;

-- Preserve all three reviewed draft snapshots and release new immutable Production
-- v1.0 rows. Only the review-control banner and Gate section are removed; the
-- reviewed provisions 1-9 remain byte-for-byte unchanged.
CREATE TABLE plan_contract_v1_release_guard (
  ok INTEGER NOT NULL CHECK(ok=1)
);

INSERT INTO plan_contract_v1_release_guard(ok)
SELECT CASE WHEN (
  SELECT COUNT(*) FROM service_plan_contract_templates
  WHERE (id='plan_contract_standard_v1_0' AND contract_content_hash='723SSdZhOxjn4OejFAGFjHIegmx3qrZKMMPPUtjcTb8')
     OR (id='plan_contract_commerce_v1_0' AND contract_content_hash='RwBIZSTpqyWo8M7XFF697qbENlJTEZsBpw9WiDp852k')
     OR (id='plan_contract_softpos_v1_0' AND contract_content_hash='1zbX0IvLLT8mYHBZn3Qg-IjDolnCltTCbRimFJNrAq0')
)=3 AND (
  SELECT COUNT(*) FROM service_plan_contract_signatures
  WHERE contract_template_id IN (
    'plan_contract_standard_v1_0',
    'plan_contract_commerce_v1_0',
    'plan_contract_softpos_v1_0'
  )
)=0 THEN 1 ELSE 0 END;

-- Free the reviewed v1.0 label while retaining every draft row and its audit history.
UPDATE service_plan_contract_templates
SET contract_version='draft-v1.0-20260908'
WHERE id IN (
  'plan_contract_standard_v1_0',
  'plan_contract_commerce_v1_0',
  'plan_contract_softpos_v1_0'
);

UPDATE service_plan_contract_templates
SET is_active=0
WHERE id IN (
  'plan_contract_standard_v1_0',
  'plan_contract_commerce_v1_0',
  'plan_contract_softpos_v1_0'
);

INSERT INTO service_plan_contract_templates (
  id,contract_type,plan_id,plan_slug,contract_name,contract_version,
  contract_snapshot,contract_content_hash,plan_details_snapshot,effective_at,
  status,legal_review_required,reviewed_by,reviewed_at,
  legal_counsel_reference,approved_content_hash,is_active
)
SELECT
  CASE id
    WHEN 'plan_contract_standard_v1_0' THEN 'plan_contract_standard_production_v1_0'
    WHEN 'plan_contract_commerce_v1_0' THEN 'plan_contract_commerce_production_v1_0'
    WHEN 'plan_contract_softpos_v1_0' THEN 'plan_contract_softpos_production_v1_0'
  END,
  contract_type,plan_id,plan_slug,contract_name,'v1.0',
  REPLACE(
    REPLACE(
      contract_snapshot,
      '<p><strong>法律審閱草稿｜pending_review｜目前不可於 Production 正式簽署</strong></p>',
      ''
    ),
    '<h2>十、法律審閱 Gate</h2><p>本版本尚待正式法律審閱。未經平台授權管理員依實際法律審閱結果核准並鎖定內容 Hash 前，不得於 Production 正式簽署；準據法、管轄及依法不得排除之權利義務，以完成法律審閱後之正式版本為準。</p>',
    ''
  ),
  CASE id
    WHEN 'plan_contract_standard_v1_0' THEN 'pMUK5zMKJfbmgCT2W9w_Mpb_pC2Qlzz6EDN2Iv1kDzE'
    WHEN 'plan_contract_commerce_v1_0' THEN 'HZHn65FtCj8gFgLYljsbbi-BoOu4q0fOK_7lrh4M2Kc'
    WHEN 'plan_contract_softpos_v1_0' THEN 'b5ZWY7T3GqatL6HHQBDpcZQ8-FFWS6h-buflRiemNeI'
  END,
  plan_details_snapshot,effective_at,
  'approved',1,'authorized_admin',CURRENT_TIMESTAMP,
  'LEGAL_REVIEW_COMPLETED_2026-09-08',
  CASE id
    WHEN 'plan_contract_standard_v1_0' THEN 'pMUK5zMKJfbmgCT2W9w_Mpb_pC2Qlzz6EDN2Iv1kDzE'
    WHEN 'plan_contract_commerce_v1_0' THEN 'HZHn65FtCj8gFgLYljsbbi-BoOu4q0fOK_7lrh4M2Kc'
    WHEN 'plan_contract_softpos_v1_0' THEN 'b5ZWY7T3GqatL6HHQBDpcZQ8-FFWS6h-buflRiemNeI'
  END,
  1
FROM service_plan_contract_templates
WHERE id IN (
  'plan_contract_standard_v1_0',
  'plan_contract_commerce_v1_0',
  'plan_contract_softpos_v1_0'
);

DROP TABLE plan_contract_v1_release_guard;

INSERT INTO service_plan_contract_events (
  id,contract_template_id,actor_type,actor_id,action,metadata_json
) VALUES
('spce_plan_standard_production_release','plan_contract_standard_production_v1_0','admin','authorized_admin','plan.contract.production_activated','{"version":"v1.0","status":"approved","legal_review_approved":true}'),
('spce_plan_commerce_production_release','plan_contract_commerce_production_v1_0','admin','authorized_admin','plan.contract.production_activated','{"version":"v1.0","status":"approved","legal_review_approved":true}'),
('spce_plan_softpos_production_release','plan_contract_softpos_production_v1_0','admin','authorized_admin','plan.contract.production_activated','{"version":"v1.0","status":"approved","legal_review_approved":true}');

INSERT INTO audit_logs (
  id,actor_type,actor_id,action,entity_type,entity_id,metadata
) VALUES
('audit_plan_standard_production_release','admin','authorized_admin','plan.contract.production_activated','service_plan_contract_template','plan_contract_standard_production_v1_0','{"version":"v1.0","status":"approved","content_hash":"pMUK5zMKJfbmgCT2W9w_Mpb_pC2Qlzz6EDN2Iv1kDzE","source_contract_id":"plan_contract_standard_v1_0","legal_review_approved":true}'),
('audit_plan_commerce_production_release','admin','authorized_admin','plan.contract.production_activated','service_plan_contract_template','plan_contract_commerce_production_v1_0','{"version":"v1.0","status":"approved","content_hash":"HZHn65FtCj8gFgLYljsbbi-BoOu4q0fOK_7lrh4M2Kc","source_contract_id":"plan_contract_commerce_v1_0","legal_review_approved":true}'),
('audit_plan_softpos_production_release','admin','authorized_admin','plan.contract.production_activated','service_plan_contract_template','plan_contract_softpos_production_v1_0','{"version":"v1.0","status":"approved","content_hash":"b5ZWY7T3GqatL6HHQBDpcZQ8-FFWS6h-buflRiemNeI","source_contract_id":"plan_contract_softpos_v1_0","legal_review_approved":true}');
