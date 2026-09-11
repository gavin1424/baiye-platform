PRAGMA foreign_keys = ON;

-- Explicit commercial payment authority. Existing rows remain readable and immutable;
-- only newly-created terms are required by the application to populate these fields.
ALTER TABLE merchant_contract_commercial_terms ADD COLUMN contract_total_amount_minor INTEGER
  CHECK(contract_total_amount_minor IS NULL OR contract_total_amount_minor >= 0);
ALTER TABLE merchant_contract_commercial_terms ADD COLUMN payment_due_at_signature_minor INTEGER
  CHECK(payment_due_at_signature_minor IS NULL OR payment_due_at_signature_minor >= 0);
ALTER TABLE merchant_contract_commercial_terms ADD COLUMN remaining_amount_minor INTEGER
  CHECK(remaining_amount_minor IS NULL OR remaining_amount_minor >= 0);
ALTER TABLE merchant_contract_commercial_terms ADD COLUMN trial_period_months INTEGER
  CHECK(trial_period_months IS NULL OR trial_period_months >= 0);
ALTER TABLE merchant_contract_commercial_terms ADD COLUMN post_trial_payment_minor INTEGER
  CHECK(post_trial_payment_minor IS NULL OR post_trial_payment_minor >= 0);
ALTER TABLE merchant_contract_commercial_terms ADD COLUMN payment_schedule_type TEXT
  CHECK(payment_schedule_type IS NULL OR payment_schedule_type IN ('SIGNATURE_FULL','SIGNATURE_AND_AFTER_TRIAL'));

ALTER TABLE merchant_plan_catalog ADD COLUMN contract_total_amount_minor INTEGER
  CHECK(contract_total_amount_minor IS NULL OR contract_total_amount_minor >= 0);
ALTER TABLE merchant_plan_catalog ADD COLUMN payment_due_at_signature_minor INTEGER
  CHECK(payment_due_at_signature_minor IS NULL OR payment_due_at_signature_minor >= 0);
ALTER TABLE merchant_plan_catalog ADD COLUMN remaining_amount_minor INTEGER
  CHECK(remaining_amount_minor IS NULL OR remaining_amount_minor >= 0);
ALTER TABLE merchant_plan_catalog ADD COLUMN trial_period_months INTEGER
  CHECK(trial_period_months IS NULL OR trial_period_months >= 0);
ALTER TABLE merchant_plan_catalog ADD COLUMN post_trial_payment_minor INTEGER
  CHECK(post_trial_payment_minor IS NULL OR post_trial_payment_minor >= 0);
ALTER TABLE merchant_plan_catalog ADD COLUMN payment_schedule_type TEXT
  CHECK(payment_schedule_type IS NULL OR payment_schedule_type IN ('SIGNATURE_FULL','SIGNATURE_AND_AFTER_TRIAL'));

ALTER TABLE merchant_contract_signatures ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'EFFECTIVE'
  CHECK(lifecycle_status IN ('SIGNED_PENDING_PAYMENT','PAYMENT_PENDING','PAYMENT_SUBMITTED','PAYMENT_CONFIRMED','EFFECTIVE','PAYMENT_REJECTED','VOID'));
ALTER TABLE merchant_contract_signatures ADD COLUMN effective_at TEXT;

CREATE TABLE IF NOT EXISTS merchant_contract_lifecycle_states (
  contract_signature_id TEXT PRIMARY KEY REFERENCES merchant_contract_signatures(id),
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  lifecycle_status TEXT NOT NULL CHECK(lifecycle_status IN ('SIGNED_PENDING_PAYMENT','PAYMENT_PENDING','PAYMENT_SUBMITTED','PAYMENT_CONFIRMED','EFFECTIVE','PAYMENT_REJECTED','VOID')),
  effective_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO merchant_contract_lifecycle_states(contract_signature_id,merchant_id,lifecycle_status,effective_at)
SELECT id,merchant_id,'EFFECTIVE',signed_at FROM merchant_contract_signatures;

CREATE TABLE IF NOT EXISTS platform_payment_configurations (
  provider TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  recipient_display_name TEXT NOT NULL,
  qr_asset_key TEXT,
  payment_deep_link TEXT,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  configured_by TEXT,
  configured_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO platform_payment_configurations(
  provider,display_name,recipient_display_name,enabled
) VALUES('jkopay_manual_qr','街口支付','百工百業',0);

-- The catalog is immutable during normal runtime. This migration is the audited,
-- one-time version transition and restores the guard before it completes.
DROP TRIGGER IF EXISTS trg_merchant_plan_catalog_no_update;

CREATE TABLE IF NOT EXISTS merchant_contract_payment_schedules (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  contract_signature_id TEXT NOT NULL REFERENCES merchant_contract_signatures(id),
  contract_version TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  phase TEXT NOT NULL CHECK(phase IN ('SIGNATURE','AFTER_TRIAL')),
  sequence_number INTEGER NOT NULL CHECK(sequence_number IN (1,2)),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency='TWD'),
  amount_due_minor INTEGER NOT NULL CHECK(amount_due_minor >= 0),
  due_at TEXT,
  trial_period_months INTEGER NOT NULL DEFAULT 0 CHECK(trial_period_months >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','submitted','confirmed','rejected','expired','void')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contract_signature_id,phase),
  UNIQUE(contract_signature_id,sequence_number)
);

CREATE TABLE IF NOT EXISTS merchant_contract_payment_requests (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  contract_signature_id TEXT NOT NULL REFERENCES merchant_contract_signatures(id),
  payment_schedule_id TEXT NOT NULL REFERENCES merchant_contract_payment_schedules(id),
  contract_version TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency='TWD'),
  amount_due_minor INTEGER NOT NULL CHECK(amount_due_minor >= 0),
  payment_method TEXT NOT NULL DEFAULT 'jkopay_manual_qr',
  provider TEXT NOT NULL DEFAULT 'jkopay_manual_qr',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','submitted','confirmed','rejected','expired','void')),
  payment_reference TEXT NOT NULL UNIQUE,
  expires_at TEXT,
  submitted_at TEXT,
  payer_payment_at TEXT,
  payer_transaction_reference TEXT,
  payer_note TEXT,
  evidence_object_key TEXT,
  evidence_content_type TEXT,
  evidence_sha256 TEXT,
  confirmed_at TEXT,
  confirmed_by TEXT,
  rejected_at TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(payment_schedule_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_active_payment_request
  ON merchant_contract_payment_requests(contract_signature_id)
  WHERE status IN ('pending','submitted');
CREATE INDEX IF NOT EXISTS idx_contract_payment_merchant
  ON merchant_contract_payment_requests(merchant_id,created_at);
CREATE INDEX IF NOT EXISTS idx_contract_payment_review
  ON merchant_contract_payment_requests(status,submitted_at);

CREATE TABLE IF NOT EXISTS merchant_contract_activation_evidence (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  contract_signature_id TEXT NOT NULL UNIQUE REFERENCES merchant_contract_signatures(id),
  payment_request_id TEXT NOT NULL UNIQUE REFERENCES merchant_contract_payment_requests(id),
  payment_reference TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0),
  provider TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  confirmed_by TEXT NOT NULL,
  activation_event_hash TEXT NOT NULL,
  evidence_object_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Existing versions remain untouched. New immutable versions begin behind the legal-review gate.
INSERT OR IGNORE INTO merchant_contract_versions(
  id,version,title,content_html,content_hash,effective_date,legal_review_status,
  legal_review_required,is_active,requires_resign,staging_signing_enabled
)
SELECT
  'merchant_service_v1_3_18000_payment','merchant_service_v1_3_18000_payment',
  '創百業智慧鏈｜NT$18,000 標準方案服務契約 V1.3',
  content_html || '<h2>付款與生效條件</h2><p>本契約總額為新臺幣 18,000 元，簽約時一次支付新臺幣 18,000 元，簽約後餘額為零。</p><p>本契約經雙方完成電子簽署後，仍以本公司確認簽約應付款項實際入帳為生效條件。款項尚未確認入帳前，狀態為「已簽署／待付款」，商家營運服務尚未正式啟用；確認入帳後，系統記錄契約生效時間並開通約定服務。</p>',
  'fwnfNY8ugEVM88gnBj5ysjNb7m_jw6ZCALPvccF5N0U',date('now'),'pending_review',1,0,0,1
FROM merchant_contract_versions WHERE id='merchant_service_v1_2_18000_addons';

INSERT OR IGNORE INTO merchant_contract_versions(
  id,version,title,content_html,content_hash,effective_date,legal_review_status,
  legal_review_required,is_active,requires_resign,staging_signing_enabled
)
SELECT
  'merchant_commerce_ai_v1_1_50000','merchant_commerce_ai_v1_1_50000',
  '創百業智慧鏈｜AI 智慧商城完整版服務契約 V1.1',
  replace(replace(replace(replace(replace(content_html,
    '<h2>第十七條｜契約完整性與法律審閱 Gate</h2>','<h2>第十七條｜契約完整性</h2>'),
    'Production 僅得使用經正式法律審閱、核准 Hash 一致且已啟用之版本；pending_review 版本僅限隔離 Staging 測試簽署。',''),
    'baiye_commerce_ai_45000','baiye_commerce_ai_50000'),'NT$45,000','NT$50,000'),'45,000 元','50,000 元') || '<h2>付款與生效條件</h2><p>本契約總額為新臺幣 50,000 元，簽約時一次支付新臺幣 50,000 元，簽約後餘額為零。</p><p>本契約經雙方完成電子簽署後，仍以本公司確認簽約應付款項實際入帳為生效條件。款項尚未確認入帳前，狀態為「已簽署／待付款」，商家營運服務尚未正式啟用；確認入帳後，系統記錄契約生效時間並開通約定服務。</p>',
  'eIyetnwARQTc6fldFnS4NQJktKGJ_OzACpYVUYrX6r0',date('now'),'pending_review',1,0,0,1
FROM merchant_contract_versions WHERE id='merchant_commerce_ai_v1_0_45000';

INSERT OR IGNORE INTO merchant_contract_versions(
  id,version,title,content_html,content_hash,effective_date,legal_review_status,
  legal_review_required,is_active,requires_resign,staging_signing_enabled
)
SELECT
  'merchant_softpos_v1_1_24000_payment','merchant_softpos_v1_1_24000_payment',
  '創百業智慧鏈｜免 POS 機智慧點餐服務契約 V1.1',
  replace(replace(replace(replace(replace(content_html,
    '<p><strong>STAGING｜法律文案尚待人工審閱（pending_review）</strong></p>',''),
    '<h2>第十條｜法律審閱與生產環境 Gate</h2>','<h2>第十條｜契約完整性</h2>'),
    '<p>本版本 legal status 為 pending_review，僅可於隔離 Staging 驗證。未經人工法律審閱、平台授權管理員核准、核准 Hash 與內容 Hash 一致且啟用 Production Legal Gate 前，不得於 Production 簽署或作為正式生產契約。</p>','<p>本正文與附件 A 構成完整契約；附件 A 所列試用期與正式付費週期應分別計算。</p>'),
    '<h2>第二條｜首次申請費用</h2><p>首次申請時，乙方應支付獨立開通費新臺幣 3,000 元及履約／服務保證金新臺幣 6,000 元。開通費用於帳號、基礎資料與標準功能開通處理，獨立於服務費及保證金，不得抵充任何服務費。保證金原則上僅於首次開通收取一次，後續週期不再收取。</p>',
    '<h2>第二條｜契約總額與簽約首期款</h2><p>本方案契約總額為新臺幣 24,000 元。簽約時支付首期款新臺幣 6,000 元；自服務啟用日起三個月為試用期間，試用期間屆滿後支付剩餘尾款新臺幣 18,000 元。</p>'),
    '<h2>第四條｜服務週期、第一週期抵充及續約</h2><p>正式服務以 24 個月為一週期，每週期服務費為新臺幣 24,000 元，平均等值為每月 1,000 元；正式計價單位仍為 24 個月一週期，不得解釋為逐月短約。</p><p>首次收取之保證金 6,000 元，於乙方在試用結束後確認續用、第一個正式 24 個月週期建立時，全額抵充該週期 24,000 元服務費，因此第一週期尚應支付 18,000 元。後續每次續約均另建新的 24 個月週期，標準續約費為 24,000 元，不再收取保證金且不再適用首期 6,000 元抵充。每期新建週期記錄，不得修改上一期已簽契約、PDF、Evidence、Hash 或 Audit。</p>',
    '<h2>第四條｜服務週期與尾款</h2><p>本方案服務期間依附件 A 所載。簽約首期款為新臺幣 6,000 元，三個月試用期結束後應支付尾款新臺幣 18,000 元；兩期合計為契約總額新臺幣 24,000 元。</p>') || '<h2>付款與生效條件</h2><p>本契約經雙方完成電子簽署後，仍以本公司確認簽約首期款實際入帳為生效條件。首期款尚未確認入帳前，狀態為「已簽署／待付款」，商家營運服務尚未正式啟用；確認入帳後，系統記錄契約生效時間並啟動三個月試用期間。</p>',
  '7wI8fRkBQePPHG-6fCRJJEdg7lNV42WSO4yBg05ugzA',date('now'),'pending_review',1,0,0,1
FROM merchant_contract_versions WHERE id='merchant_softpos_v1_0_24000';

-- Normalize the new SoftPOS version without touching the historical v1.0 row.
UPDATE merchant_contract_versions SET content_html=replace(content_html,'<h2>第二條｜首次申請費用</h2>','<h2>第二條｜契約總額與簽約首期款</h2>') WHERE id='merchant_softpos_v1_1_24000_payment';
UPDATE merchant_contract_versions SET content_html=replace(content_html,'<p>首次申請時，乙方應支付獨立開通費新臺幣 3,000 元及履約／服務保證金新臺幣 6,000 元。開通費用於帳號、基礎資料與標準功能開通處理，獨立於服務費及保證金，不得抵充任何服務費。保證金原則上僅於首次開通收取一次，後續週期不再收取。</p>','<p>本方案契約總額為新臺幣 24,000 元。簽約時支付首期款新臺幣 6,000 元；自服務啟用日起三個月為試用期間，試用期間屆滿後支付剩餘尾款新臺幣 18,000 元。</p>') WHERE id='merchant_softpos_v1_1_24000_payment';
UPDATE merchant_contract_versions SET content_html=replace(content_html,'<h2>第三條｜三個月免費試用</h2>','<h2>第三條｜三個月試用期間</h2>') WHERE id='merchant_softpos_v1_1_24000_payment';
UPDATE merchant_contract_versions SET content_html=replace(content_html,'<p>自試用啟動日起前三個月之系統服務費為 NT$0。試用期間不得建立正式服務費應收。試用期屆滿時，系統應詢問「是否續用免 POS 機智慧點餐系統」。乙方不續用時，甲方停止正式服務功能，並依第八條處理資料；乙方確認續用後，始進入正式付費週期。</p>','<p>自服務啟用日起三個月為試用期間。試用期間屆滿後，乙方應依付款排程支付尾款新臺幣 18,000 元。</p>') WHERE id='merchant_softpos_v1_1_24000_payment';
UPDATE merchant_contract_versions SET content_html=replace(content_html,'<h2>第四條｜服務週期、第一週期抵充及續約</h2>','<h2>第四條｜付款排程與服務期間</h2>') WHERE id='merchant_softpos_v1_1_24000_payment';
UPDATE merchant_contract_versions SET content_html=replace(content_html,'<p>首次收取之保證金 6,000 元，於乙方在試用結束後確認續用、第一個正式 24 個月週期建立時，全額抵充該週期 24,000 元服務費，因此第一週期尚應支付 18,000 元。後續每次續約均另建新的 24 個月週期，標準續約費為 24,000 元，不再收取保證金且不再適用首期 6,000 元抵充。每期新建週期記錄，不得修改上一期已簽契約、PDF、Evidence、Hash 或 Audit。</p>','<p>簽約首期款為新臺幣 6,000 元，三個月試用期結束後應支付尾款新臺幣 18,000 元；兩期合計為契約總額新臺幣 24,000 元。付款紀錄與契約文件均應依其產生時間保存，不得覆寫。</p>') WHERE id='merchant_softpos_v1_1_24000_payment';
UPDATE merchant_contract_versions SET content_html=replace(content_html,'<h2>第五條｜保證金用途與終止處理</h2>','') WHERE id='merchant_softpos_v1_1_24000_payment';
UPDATE merchant_contract_versions SET content_html=replace(content_html,'<p>保證金用於擔保乙方履行首次開通、試用及是否進入第一正式週期之契約義務，不是開通費。只有在乙方試用屆滿後確認續用並建立第一個正式週期時，才依前條抵充服務費；試用期間、乙方尚未確認續用、或因法令、欺詐、欠費、未返還甲方財產、第三方已實際發生費用或其他可歸責於乙方之未履行義務而依約終止時，不進行前述服務費抵充。</p>','') WHERE id='merchant_softpos_v1_1_24000_payment';
UPDATE merchant_contract_versions SET content_html=replace(content_html,'<p>如乙方於試用屆滿選擇不續用或契約提前終止，甲方應先以可驗證之記錄列明乙方尚未履行之金錢義務、應賠償之實際損害或已發生且無法取消之第三方成本，始得自保證金中抵銷；抵銷不得超過有據之未履行義務或損害金額。扣除後如有餘額，甲方應於終止結算完成後 30 日內無息返還；如無任何前述未履行義務或可扣除項目，應全額返還。任何扣除、抵充或返還均應留存計算明細及 Audit 記錄。</p>','') WHERE id='merchant_softpos_v1_1_24000_payment';
UPDATE merchant_contract_versions SET content_html=replace(content_html,'<p>本方案之契約付款條件允許申請信用卡 24 期零利率，但契約付款條件與實際 Payment Provider 能力分離。「24 期零利率須依合作金融／支付機構核准與實際可用方案為準。」未經實際 Provider 確認支援前，系統不得分割或建立 24 筆假付款、假請款或假交易。第一週期實際待付總額仍為 18,000 元；將來 Provider 實作並驗證可用後，始得依其核准方案處理分期。</p>','<p>如乙方另行申請分期，實際期數、利率、審核與可用條件依合作金融或支付機構實際提供內容為準；未獲核准前仍依本契約付款排程辦理。</p>') WHERE id='merchant_softpos_v1_1_24000_payment';
UPDATE merchant_contract_versions SET content_html=replace(content_html,'<p>雙方同意沿用 Common Contract Engine 以勾選確認、手寫簽名、簽署前預覽、PDF v2、私人 Evidence、R2、內容與文件 Hash 及 Audit 完成電子簽署。已簽文件不可變；條款或續約變更應建立新版本、新週期或補充協議，不得修改舊 Evidence。本手寫簽署為一般電子契約證據，不得宣稱為憑證式數位簽章。</p>','<p>雙方同意以勾選確認、手寫簽名、簽署前預覽及電子文件完成簽署。已簽文件與其完整性驗證紀錄不得覆寫；條款變更應建立新版本或補充協議。本手寫簽署為一般電子契約證據，不宣稱為憑證式數位簽章。</p>') WHERE id='merchant_softpos_v1_1_24000_payment';
UPDATE merchant_contract_versions SET content_hash='D_jCMCLkfs_bnEDyrUumImJPKjZpWLCZlvWtAyRX2_0' WHERE id='merchant_softpos_v1_1_24000_payment';

-- Retire the old 45,000 plan only for new selection; history and all references remain.
UPDATE merchant_plan_catalog
SET is_public=0,is_selectable=0,display_order=45
WHERE plan_id='baiye_commerce_ai_45000';

UPDATE merchant_plan_catalog SET
  contract_version_id='merchant_service_v1_3_18000_payment',
  contract_total_amount_minor=1800000,payment_due_at_signature_minor=1800000,
  remaining_amount_minor=0,trial_period_months=0,post_trial_payment_minor=0,
  payment_schedule_type='SIGNATURE_FULL'
WHERE plan_id='baiye_standard_18000_addons';

INSERT OR IGNORE INTO merchant_plan_catalog(
  plan_id,display_order,name,tagline,price_minor,currency,term_months,trial_months,
  activation_fee_minor,deposit_minor,cycle_fee_minor,first_cycle_credit_minor,
  first_cycle_balance_minor,renewal_fee_minor,contract_version_id,features_json,
  installment_plan_available,payment_provider_ready,is_public,is_selectable,environment,
  contract_total_amount_minor,payment_due_at_signature_minor,remaining_amount_minor,
  trial_period_months,post_trial_payment_minor,payment_schedule_type
)
SELECT
  'baiye_commerce_ai_50000',2,name,tagline,5000000,currency,term_months,0,
  0,0,5000000,0,5000000,5000000,'merchant_commerce_ai_v1_1_50000',features_json,
  installment_plan_available,payment_provider_ready,1,1,environment,
  5000000,5000000,0,0,0,'SIGNATURE_FULL'
FROM merchant_plan_catalog WHERE plan_id='baiye_commerce_ai_45000';

UPDATE merchant_plan_catalog SET
  contract_version_id='merchant_softpos_v1_1_24000_payment',
  activation_fee_minor=0,deposit_minor=0,
  contract_total_amount_minor=2400000,payment_due_at_signature_minor=600000,
  remaining_amount_minor=1800000,trial_period_months=3,post_trial_payment_minor=1800000,
  payment_schedule_type='SIGNATURE_AND_AFTER_TRIAL'
WHERE plan_id='baiye_softpos_24000';

CREATE TRIGGER IF NOT EXISTS trg_merchant_plan_catalog_no_update
BEFORE UPDATE ON merchant_plan_catalog BEGIN SELECT RAISE(ABORT,'MERCHANT_PLAN_CATALOG_IMMUTABLE'); END;
