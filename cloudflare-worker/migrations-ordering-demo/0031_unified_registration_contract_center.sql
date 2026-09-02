-- Unified merchant plan catalog and non-destructive contract-version classification.
-- STAGING FIRST: no Production activation or legal approval is performed here.
PRAGMA foreign_keys = ON;

ALTER TABLE merchant_contract_commercial_terms ADD COLUMN installment_plan_requested INTEGER
  CHECK(installment_plan_requested IS NULL OR installment_plan_requested=24);

CREATE TABLE IF NOT EXISTS merchant_plan_catalog (
  plan_id TEXT PRIMARY KEY,
  display_order INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  price_minor INTEGER NOT NULL CHECK(price_minor>=0),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency='TWD'),
  term_months INTEGER NOT NULL CHECK(term_months>0),
  trial_months INTEGER NOT NULL DEFAULT 0 CHECK(trial_months>=0),
  activation_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK(activation_fee_minor>=0),
  deposit_minor INTEGER NOT NULL DEFAULT 0 CHECK(deposit_minor>=0),
  cycle_fee_minor INTEGER NOT NULL CHECK(cycle_fee_minor>=0),
  first_cycle_credit_minor INTEGER NOT NULL DEFAULT 0 CHECK(first_cycle_credit_minor>=0),
  first_cycle_balance_minor INTEGER NOT NULL CHECK(first_cycle_balance_minor>=0),
  renewal_fee_minor INTEGER NOT NULL CHECK(renewal_fee_minor>=0),
  contract_version_id TEXT NOT NULL REFERENCES merchant_contract_versions(id),
  features_json TEXT NOT NULL,
  installment_plan_available INTEGER NOT NULL DEFAULT 1 CHECK(installment_plan_available IN (0,1)),
  payment_provider_ready INTEGER NOT NULL DEFAULT 0 CHECK(payment_provider_ready IN (0,1)),
  is_public INTEGER NOT NULL DEFAULT 1 CHECK(is_public IN (0,1)),
  is_selectable INTEGER NOT NULL DEFAULT 1 CHECK(is_selectable IN (0,1)),
  environment TEXT NOT NULL DEFAULT 'staging' CHECK(environment IN ('staging','production')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(first_cycle_balance_minor=cycle_fee_minor-first_cycle_credit_minor)
);

CREATE TABLE IF NOT EXISTS merchant_plan_intents (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),
  intended_plan_id TEXT REFERENCES merchant_plan_catalog(plan_id),
  source TEXT NOT NULL DEFAULT 'join',
  confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_plan_selections (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  plan_id TEXT NOT NULL REFERENCES merchant_plan_catalog(plan_id),
  commercial_terms_id TEXT NOT NULL REFERENCES merchant_contract_commercial_terms(id),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','superseded','cancelled')),
  assigned_by TEXT NOT NULL,
  installment_plan_requested INTEGER CHECK(installment_plan_requested IS NULL OR installment_plan_requested=24),
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  superseded_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_unified_active_plan
  ON merchant_plan_selections(merchant_id) WHERE status='assigned';

CREATE TABLE IF NOT EXISTS contract_version_classifications (
  domain TEXT NOT NULL CHECK(domain IN ('merchant','partner')),
  contract_version_id TEXT NOT NULL,
  classification TEXT NOT NULL CHECK(classification IN ('CURRENT_SELECTABLE','HISTORICAL_SIGNED','UNUSED_LEGACY','DEMO_ONLY')),
  is_public INTEGER NOT NULL DEFAULT 0 CHECK(is_public IN (0,1)),
  is_selectable INTEGER NOT NULL DEFAULT 0 CHECK(is_selectable IN (0,1)),
  superseded INTEGER NOT NULL DEFAULT 0 CHECK(superseded IN (0,1)),
  audited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(domain,contract_version_id)
);

INSERT OR IGNORE INTO merchant_plan_catalog(
  plan_id,display_order,name,tagline,price_minor,term_months,trial_months,
  activation_fee_minor,deposit_minor,cycle_fee_minor,first_cycle_credit_minor,
  first_cycle_balance_minor,renewal_fee_minor,contract_version_id,features_json
) VALUES
  ('baiye_standard_18000_addons',1,'百工標準方案','基礎數位升級',1800000,24,0,0,0,1800000,0,1800000,1800000,'merchant_service_v1_2_18000_addons','{"merchant_content_editable":false,"merchant_product_editable":false,"commerce_full":false,"cart_enabled":false,"softpos_enabled":false,"ordering_enabled":false,"base_product_limit":20}'),
  ('baiye_commerce_ai_45000',2,'AI 智慧商城完整版','完整 AI 智慧商城',4500000,24,0,0,0,4500000,0,4500000,4500000,'merchant_commerce_ai_v1_0_45000','{"merchant_content_editable":true,"merchant_product_editable":true,"commerce_full":true,"cart_enabled":true,"softpos_enabled":false,"ordering_enabled":true}'),
  ('baiye_softpos_24000',3,'免 POS 機智慧點餐','免 POS 機智慧點餐',2400000,24,3,300000,600000,2400000,600000,1800000,2400000,'merchant_softpos_v1_0_24000','{"merchant_content_editable":true,"merchant_product_editable":true,"commerce_full":false,"cart_enabled":false,"softpos_enabled":true,"ordering_enabled":true,"kds_enabled":true}');

INSERT OR REPLACE INTO contract_version_classifications(domain,contract_version_id,classification,is_public,is_selectable,superseded)
SELECT 'merchant',id,
  CASE
    WHEN id IN ('merchant_service_v1_2_18000_addons','merchant_commerce_ai_v1_0_45000','merchant_softpos_v1_0_24000') THEN 'CURRENT_SELECTABLE'
    WHEN EXISTS(SELECT 1 FROM merchant_contract_signatures s WHERE s.contract_version_id=merchant_contract_versions.id) THEN 'HISTORICAL_SIGNED'
    WHEN lower(id) LIKE '%demo%' OR lower(title) LIKE '%demo%' OR lower(id) LIKE '%test%' THEN 'DEMO_ONLY'
    ELSE 'UNUSED_LEGACY'
  END,
  CASE WHEN id IN ('merchant_service_v1_2_18000_addons','merchant_commerce_ai_v1_0_45000','merchant_softpos_v1_0_24000') THEN 1 ELSE 0 END,
  CASE WHEN id IN ('merchant_service_v1_2_18000_addons','merchant_commerce_ai_v1_0_45000','merchant_softpos_v1_0_24000') THEN 1 ELSE 0 END,
  CASE WHEN id IN ('merchant_service_v1_2_18000_addons','merchant_commerce_ai_v1_0_45000','merchant_softpos_v1_0_24000') THEN 0 ELSE 1 END
FROM merchant_contract_versions;

INSERT OR REPLACE INTO contract_version_classifications(domain,contract_version_id,classification,is_public,is_selectable,superseded)
SELECT 'partner',id,
  CASE
    WHEN id='contractor_partner_v1_5' THEN 'CURRENT_SELECTABLE'
    WHEN EXISTS(SELECT 1 FROM contract_signatures s WHERE s.contract_version_id=contract_versions.id) THEN 'HISTORICAL_SIGNED'
    ELSE 'UNUSED_LEGACY'
  END,
  CASE WHEN id='contractor_partner_v1_5' THEN 1 ELSE 0 END,
  CASE WHEN id='contractor_partner_v1_5' THEN 1 ELSE 0 END,
  CASE WHEN id='contractor_partner_v1_5' THEN 0 ELSE 1 END
FROM contract_versions;

CREATE TRIGGER IF NOT EXISTS trg_merchant_plan_catalog_no_update
BEFORE UPDATE ON merchant_plan_catalog BEGIN SELECT RAISE(ABORT,'MERCHANT_PLAN_CATALOG_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_merchant_plan_catalog_no_delete
BEFORE DELETE ON merchant_plan_catalog BEGIN SELECT RAISE(ABORT,'MERCHANT_PLAN_CATALOG_IMMUTABLE'); END;
