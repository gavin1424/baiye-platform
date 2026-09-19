PRAGMA foreign_keys = ON;

-- Release a new current AI Commerce contract without mutating the v1.0
-- template or any signed agreement snapshot.
CREATE TABLE ai_commerce_50000_release_guard (
  ok INTEGER NOT NULL CHECK(ok=1)
);

INSERT INTO ai_commerce_50000_release_guard(ok)
SELECT CASE WHEN EXISTS (
  SELECT 1
  FROM service_plan_contract_templates
  WHERE id='plan_contract_commerce_production_v1_0'
    AND plan_id='baiye_commerce_ai_45000'
    AND plan_slug='ai-commerce-45000'
    AND contract_version='v1.0'
    AND contract_content_hash='HZHn65FtCj8gFgLYljsbbi-BoOu4q0fOK_7lrh4M2Kc'
    AND approved_content_hash=contract_content_hash
    AND status='approved'
    AND is_active=1
    AND json_extract(plan_details_snapshot,'$.plan_price_minor')=4500000
) AND NOT EXISTS (
  SELECT 1 FROM service_plan_contract_templates
  WHERE id='plan_contract_commerce_production_v1_1_50000'
) THEN 1 ELSE 0 END;

UPDATE service_plan_contract_templates
SET is_active=0
WHERE id='plan_contract_commerce_production_v1_0';

INSERT INTO service_plan_contract_templates (
  id,contract_type,plan_id,plan_slug,contract_name,contract_version,
  contract_snapshot,contract_content_hash,plan_details_snapshot,effective_at,
  status,legal_review_required,reviewed_by,reviewed_at,
  legal_counsel_reference,approved_content_hash,is_active
)
SELECT
  'plan_contract_commerce_production_v1_1_50000',
  contract_type,plan_id,plan_slug,contract_name,'v1.1',
  REPLACE(contract_snapshot,'NT$45,000','NT$50,000'),
  'Dx5npHvs2HX9SY0dBx4TchEl3XW8pmEDIdBeJ6MiUbU',
  json_set(
    plan_details_snapshot,
    '$.plan_price_minor',5000000,
    '$.plan_price_display','NT$50,000',
    '$.first_cycle_balance_minor',5000000,
    '$.payment_terms','方案費用 NT$50,000；實際付款方式由雙方於既有申請／付款流程另行確認，不因本草稿自動扣款。'
  ),
  '2026-09-20','approved',legal_review_required,
  'authorized_admin',CURRENT_TIMESTAMP,
  'AI_COMMERCE_CURRENT_PRICE_50000_2026-09-20',
  'Dx5npHvs2HX9SY0dBx4TchEl3XW8pmEDIdBeJ6MiUbU',1
FROM service_plan_contract_templates
WHERE id='plan_contract_commerce_production_v1_0';

DROP TABLE ai_commerce_50000_release_guard;

INSERT INTO service_plan_contract_events (
  id,contract_template_id,actor_type,actor_id,action,metadata_json
) VALUES (
  'spce_plan_commerce_50000_release',
  'plan_contract_commerce_production_v1_1_50000',
  'admin','authorized_admin','plan.contract.production_activated',
  '{"version":"v1.1","status":"approved","price_minor":5000000,"supersedes":"plan_contract_commerce_production_v1_0"}'
);

INSERT INTO audit_logs (
  id,actor_type,actor_id,action,entity_type,entity_id,metadata
) VALUES (
  'audit_plan_commerce_50000_release',
  'admin','authorized_admin','plan.contract.production_activated',
  'service_plan_contract_template','plan_contract_commerce_production_v1_1_50000',
  '{"version":"v1.1","status":"approved","price_minor":5000000,"content_hash":"Dx5npHvs2HX9SY0dBx4TchEl3XW8pmEDIdBeJ6MiUbU","source_contract_id":"plan_contract_commerce_production_v1_0"}'
);
