-- Standard self-service merchant registration: immutable platform-default terms
-- plus an explicit contract-required operational gate. No merchant data is seeded.
PRAGMA foreign_keys = ON;

ALTER TABLE merchant_contract_versions ADD COLUMN staging_signing_enabled INTEGER NOT NULL DEFAULT 0
  CHECK(staging_signing_enabled IN (0,1));
ALTER TABLE merchant_contract_commercial_terms ADD COLUMN source_preset_id TEXT;

CREATE TABLE IF NOT EXISTS merchant_commercial_terms_presets (
  id TEXT PRIMARY KEY,
  plan_code TEXT NOT NULL UNIQUE,
  plan_name TEXT NOT NULL,
  list_price_minor INTEGER NOT NULL CHECK(list_price_minor >= 0),
  discount_price_minor INTEGER NOT NULL CHECK(discount_price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency='TWD'),
  standard_website_build_minor INTEGER NOT NULL DEFAULT 0 CHECK(standard_website_build_minor=0),
  contract_term_months INTEGER NOT NULL CHECK(contract_term_months > 0),
  payment_plan TEXT NOT NULL CHECK(payment_plan IN ('upfront_18000','sales_offset_18000')),
  status TEXT NOT NULL DEFAULT 'platform_approved' CHECK(status='platform_approved'),
  preset_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_onboarding_states (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),
  registration_mode TEXT NOT NULL CHECK(registration_mode IN ('standard_self_service','custom_quote')),
  state TEXT NOT NULL CHECK(state IN ('registration_started','registered','contract_required','contract_signed','active','closed')),
  operation_locked INTEGER NOT NULL DEFAULT 1 CHECK(operation_locked IN (0,1)),
  commercial_terms_approval_required INTEGER NOT NULL DEFAULT 0 CHECK(commercial_terms_approval_required IN (0,1)),
  commercial_terms_id TEXT REFERENCES merchant_contract_commercial_terms(id),
  contract_signed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_merchant_onboarding_operation_gate
  ON merchant_onboarding_states(operation_locked,state);

CREATE TRIGGER IF NOT EXISTS trg_merchant_standard_terms_preset_immutable
BEFORE UPDATE ON merchant_commercial_terms_presets
BEGIN SELECT RAISE(ABORT,'STANDARD_TERMS_PRESET_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_merchant_standard_terms_preset_no_delete
BEFORE DELETE ON merchant_commercial_terms_presets
BEGIN SELECT RAISE(ABORT,'STANDARD_TERMS_PRESET_IMMUTABLE'); END;

INSERT OR IGNORE INTO merchant_commercial_terms_presets(
  id,plan_code,plan_name,list_price_minor,discount_price_minor,currency,
  standard_website_build_minor,contract_term_months,payment_plan,preset_version
) VALUES(
  'baiye_standard_18000','baiye_standard_18000','創百業智慧鏈｜AI 行銷推廣及數位服務方案',
  3000000,1800000,'TWD',0,24,'upfront_18000','baiye-standard-18000-v1'
);

-- A staging-only switch; Production still requires legal_review_status=approved.
UPDATE merchant_contract_versions
SET staging_signing_enabled=1
WHERE id='merchant_service_v1_0';
