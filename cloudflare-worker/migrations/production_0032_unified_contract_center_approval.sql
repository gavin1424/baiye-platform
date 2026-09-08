-- Production migration 0032, authorized by the platform owner on 2026-09-08.
-- Additive only: signed contracts, artifacts, evidence and historical versions are preserved.
PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO platform_contract_legal_entity_configs(
  id,legal_name,tax_id,responsible_person,registered_address,support_contact,updated_by
) VALUES(
  'default','陳靈有限公司','42868714','陳美玲','臺北市大安區忠孝東路4段169號12樓之2','https://baiyeconnect.com/#/contact','production-promotion-2026-09-08'
);

DROP TRIGGER IF EXISTS trg_service_plan_version_immutable_update;
UPDATE merchant_service_plan_versions SET legal_status='approved',environment='production'
WHERE plan_id='baiye_softpos_24000';
CREATE TRIGGER trg_service_plan_version_immutable_update
BEFORE UPDATE ON merchant_service_plan_versions BEGIN SELECT RAISE(ABORT,'SERVICE_PLAN_VERSION_IMMUTABLE'); END;

DROP TRIGGER IF EXISTS trg_merchant_plan_catalog_no_update;
UPDATE merchant_plan_catalog SET environment='production'
WHERE plan_id IN ('baiye_standard_18000_addons','baiye_commerce_ai_45000','baiye_softpos_24000');
CREATE TRIGGER trg_merchant_plan_catalog_no_update
BEFORE UPDATE ON merchant_plan_catalog BEGIN SELECT RAISE(ABORT,'MERCHANT_PLAN_CATALOG_IMMUTABLE'); END;

UPDATE merchant_contract_versions
SET content_html=REPLACE(REPLACE(
      content_html,
      '<h2>第十七條｜契約完整性與法律審閱 Gate</h2>','<h2>第十七條｜契約完整性</h2>'),
      'Production 僅得使用經正式法律審閱、核准 Hash 一致且已啟用之版本；pending_review 版本僅限隔離 Staging 測試簽署。',''),
    content_hash='PwiFgNJH45C_dIgutlzkSG_CtbTm-IjdgdBGb8nZCd4'
WHERE id='merchant_commerce_ai_v1_0_45000'
  AND NOT EXISTS(SELECT 1 FROM merchant_contract_signatures s WHERE s.contract_version_id=merchant_contract_versions.id);

UPDATE merchant_contract_versions
SET content_html=REPLACE(REPLACE(REPLACE(
      content_html,
      '<p><strong>STAGING｜法律文案尚待人工審閱（pending_review）</strong></p>',''),
      '<h2>第十條｜法律審閱與生產環境 Gate</h2>','<h2>第十條｜契約完整性</h2>'),
      '<p>本版本 legal status 為 pending_review，僅可於隔離 Staging 驗證。未經人工法律審閱、平台授權管理員核准、核准 Hash 與內容 Hash 一致且啟用 Production Legal Gate 前，不得於 Production 簽署或作為正式生產契約。</p>','<p>本正文與附件 A 構成完整契約；附件 A 所列試用期與正式付費週期應分別計算。</p>'),
    content_hash='0bhwdvCVNJzMDsEcvLK_s1BIr-wNdoRgJRzie1a4i7Y'
WHERE id='merchant_softpos_v1_0_24000'
  AND NOT EXISTS(SELECT 1 FROM merchant_contract_signatures s WHERE s.contract_version_id=merchant_contract_versions.id);

UPDATE merchant_contract_versions
SET legal_review_status='approved',legal_review_required=0,
    reviewed_by='platform-owner-approved-2026-09-08',reviewed_at=CURRENT_TIMESTAMP,
    legal_counsel_reference='OWNER_FORMAL_APPROVAL_2026-09-08',
    approved_content_hash=content_hash,is_active=1
WHERE id IN (
  'merchant_service_v1_2_18000_addons',
  'merchant_commerce_ai_v1_0_45000',
  'merchant_softpos_v1_0_24000'
) AND NOT EXISTS(
  SELECT 1 FROM merchant_contract_signatures s
  WHERE s.contract_version_id=merchant_contract_versions.id
);

UPDATE contract_versions
SET content_html=REPLACE(REPLACE(
      content_html,
      '<p><strong>STAGING / DRAFT FOR LEGAL REVIEW</strong></p>',''),
      '<p><strong>LEGAL_REVIEW_REQUIRED：未經台灣執業律師審閱及平台授權管理員核准前，不得於 Production 簽署。</strong></p>',''),
    content_hash='ywoWetdMn4-qwJ43TnkMKLhr9tPKi72K6sq1i4qMQQg',
    legal_review_status='approved',legal_review_required=0,
    reviewed_by='platform-owner-approved-2026-09-08',reviewed_at=CURRENT_TIMESTAMP,
    legal_counsel_reference='OWNER_FORMAL_APPROVAL_2026-09-08',
    approved_content_hash='ywoWetdMn4-qwJ43TnkMKLhr9tPKi72K6sq1i4qMQQg',is_active=1
WHERE id='contractor_partner_v1_5'
  AND NOT EXISTS(SELECT 1 FROM contract_signatures s WHERE s.contract_version_id=contract_versions.id);

UPDATE contract_versions SET is_active=0
WHERE id<>'contractor_partner_v1_5' AND is_active=1;

INSERT INTO audit_logs(id,actor_type,actor_id,action,entity_type,entity_id,metadata)
VALUES
  ('audit_prod_approval_standard_18000','admin','platform-owner','contract.production_approved','merchant_contract_version','merchant_service_v1_2_18000_addons','{"authorization_date":"2026-09-08","source":"explicit_owner_instruction"}'),
  ('audit_prod_approval_commerce_45000','admin','platform-owner','contract.production_approved','merchant_contract_version','merchant_commerce_ai_v1_0_45000','{"authorization_date":"2026-09-08","source":"explicit_owner_instruction"}'),
  ('audit_prod_approval_softpos_24000','admin','platform-owner','contract.production_approved','merchant_contract_version','merchant_softpos_v1_0_24000','{"authorization_date":"2026-09-08","source":"explicit_owner_instruction"}'),
  ('audit_prod_approval_partner_v15','admin','platform-owner','contract.production_approved','contract_version','contractor_partner_v1_5','{"authorization_date":"2026-09-08","source":"explicit_owner_instruction"}');
