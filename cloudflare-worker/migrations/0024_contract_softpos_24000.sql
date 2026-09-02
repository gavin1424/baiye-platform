-- SoftPOS NT$24,000 / 24-month contract plan. STAGING ONLY until legal approval.
PRAGMA foreign_keys = ON;

ALTER TABLE merchant_contract_commercial_terms ADD COLUMN service_plan_version_id TEXT;

CREATE TABLE IF NOT EXISTS merchant_service_plan_versions (
  plan_id TEXT PRIMARY KEY,
  contract_version TEXT NOT NULL UNIQUE,
  contract_version_id TEXT NOT NULL REFERENCES merchant_contract_versions(id),
  formal_name TEXT NOT NULL,
  public_hardware_claim TEXT NOT NULL,
  activation_fee INTEGER NOT NULL CHECK(activation_fee=300000),
  deposit INTEGER NOT NULL CHECK(deposit=600000),
  trial_months INTEGER NOT NULL CHECK(trial_months=3),
  cycle_months INTEGER NOT NULL CHECK(cycle_months=24),
  cycle_fee INTEGER NOT NULL CHECK(cycle_fee=2400000),
  first_cycle_credit INTEGER NOT NULL CHECK(first_cycle_credit=600000),
  first_cycle_balance INTEGER NOT NULL CHECK(first_cycle_balance=1800000),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency='TWD'),
  installment_count INTEGER NOT NULL DEFAULT 24 CHECK(installment_count=24),
  installment_interest_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK(installment_interest_rate_bps=0),
  legal_status TEXT NOT NULL CHECK(legal_status IN ('pending_review','approved','revoked')),
  environment TEXT NOT NULL DEFAULT 'staging' CHECK(environment='staging'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(first_cycle_balance=cycle_fee-first_cycle_credit)
);

CREATE TABLE IF NOT EXISTS merchant_service_subscriptions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  plan_id TEXT NOT NULL REFERENCES merchant_service_plan_versions(plan_id),
  initial_contract_signature_id TEXT NOT NULL REFERENCES merchant_contract_signatures(id),
  renewal_state TEXT NOT NULL CHECK(renewal_state IN ('TRIAL','TRIAL_ENDING','RENEWAL_REQUIRED','ACTIVE','EXPIRING','EXPIRED')),
  trial_started_at TEXT NOT NULL,
  trial_ends_at TEXT NOT NULL,
  activation_fee_minor INTEGER NOT NULL CHECK(activation_fee_minor=300000),
  deposit_minor INTEGER NOT NULL CHECK(deposit_minor=600000),
  deposit_collected_once INTEGER NOT NULL DEFAULT 0 CHECK(deposit_collected_once IN (0,1)),
  current_cycle_number INTEGER NOT NULL DEFAULT 0 CHECK(current_cycle_number>=0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,plan_id)
);

CREATE TABLE IF NOT EXISTS merchant_service_cycles (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES merchant_service_subscriptions(id),
  cycle_number INTEGER NOT NULL CHECK(cycle_number>=1),
  cycle_months INTEGER NOT NULL CHECK(cycle_months=24),
  cycle_fee_minor INTEGER NOT NULL CHECK(cycle_fee_minor=2400000),
  deposit_credit_minor INTEGER NOT NULL CHECK(deposit_credit_minor IN (0,600000)),
  balance_due_minor INTEGER NOT NULL,
  deposit_charge_minor INTEGER NOT NULL DEFAULT 0 CHECK(deposit_charge_minor=0),
  service_period_start TEXT,
  service_period_end TEXT,
  status TEXT NOT NULL CHECK(status IN ('PAYMENT_REQUIRED','ACTIVE','EXPIRING','EXPIRED','DECLINED')),
  renewal_contract_signature_id TEXT REFERENCES merchant_contract_signatures(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at TEXT,
  UNIQUE(subscription_id,cycle_number),
  CHECK(balance_due_minor=cycle_fee_minor-deposit_credit_minor),
  CHECK((cycle_number=1 AND deposit_credit_minor=600000 AND balance_due_minor=1800000)
     OR (cycle_number>1 AND deposit_credit_minor=0 AND balance_due_minor=2400000))
);

CREATE TABLE IF NOT EXISTS merchant_contract_payment_provider_capabilities (
  plan_id TEXT NOT NULL REFERENCES merchant_service_plan_versions(plan_id),
  provider_code TEXT NOT NULL,
  installment_count INTEGER NOT NULL CHECK(installment_count=24),
  zero_interest_enabled INTEGER NOT NULL DEFAULT 0 CHECK(zero_interest_enabled IN (0,1)),
  production_verified INTEGER NOT NULL DEFAULT 0 CHECK(production_verified IN (0,1)),
  verified_at TEXT,
  PRIMARY KEY(plan_id,provider_code),
  CHECK(zero_interest_enabled=0 OR production_verified=1)
);

CREATE INDEX IF NOT EXISTS idx_merchant_service_subscription_state
  ON merchant_service_subscriptions(renewal_state,trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_merchant_service_cycles_subscription
  ON merchant_service_cycles(subscription_id,cycle_number);

CREATE TRIGGER IF NOT EXISTS trg_service_plan_version_immutable_update
BEFORE UPDATE ON merchant_service_plan_versions BEGIN SELECT RAISE(ABORT,'SERVICE_PLAN_VERSION_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_plan_version_immutable_delete
BEFORE DELETE ON merchant_service_plan_versions BEGIN SELECT RAISE(ABORT,'SERVICE_PLAN_VERSION_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_cycle_evidence_immutable
BEFORE UPDATE ON merchant_service_cycles
WHEN OLD.renewal_contract_signature_id IS NOT NULL
BEGIN SELECT RAISE(ABORT,'SERVICE_CYCLE_EVIDENCE_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_cycle_evidence_no_delete
BEFORE DELETE ON merchant_service_cycles
WHEN OLD.renewal_contract_signature_id IS NOT NULL
BEGIN SELECT RAISE(ABORT,'SERVICE_CYCLE_EVIDENCE_IMMUTABLE'); END;

INSERT OR IGNORE INTO merchant_contract_versions(
  id,version,title,content_html,content_hash,effective_date,legal_review_status,
  legal_review_required,is_active,requires_resign,staging_signing_enabled
) VALUES(
  'merchant_softpos_v1_0_24000','merchant_softpos_v1_0_24000','創百業智慧鏈｜免 POS 機智慧點餐系統',
  '<h1>創百業智慧鏈｜免 POS 機智慧點餐系統</h1>
<p><strong>STAGING｜法律文案尚待人工審閱（pending_review）</strong></p>
<h2>第一條｜方案與服務範圍</h2>
<p>乙方申請「創百業智慧鏈｜免 POS 機智慧點餐系統」（Plan ID：baiye_softpos_24000）。本方案免專用 POS 主機，但不代表完全零硬體；乙方仍須自備可使用瀏覽器、顯示 QR Code 或依實際營運所需之裝置、網路及列印設備。</p>
<p>標準服務沿用甲方現有正式 Core，依乙方帳號實際啟用能力提供 QR Ordering、Booking / Ordering Core、KDS、Browser Print、Order State Machine、現有可用庫存、Merchant Admin、會員與選配 LINE 串接；不另建第二套 Ordering。</p>
<h2>第二條｜首次申請費用</h2>
<p>首次申請時，乙方應支付獨立開通費新臺幣 3,000 元及履約／服務保證金新臺幣 6,000 元。開通費用於帳號、基礎資料與標準功能開通處理，獨立於服務費及保證金，不得抵充任何服務費。保證金原則上僅於首次開通收取一次，後續週期不再收取。</p>
<h2>第三條｜三個月免費試用</h2>
<p>自試用啟動日起前三個月之系統服務費為 NT$0。試用期間不得建立正式服務費應收。試用期屆滿時，系統應詢問「是否續用免 POS 機智慧點餐系統」。乙方不續用時，甲方停止正式服務功能，並依第八條處理資料；乙方確認續用後，始進入正式付費週期。</p>
<h2>第四條｜服務週期、第一週期抵充及續約</h2>
<p>正式服務以 24 個月為一週期，每週期服務費為新臺幣 24,000 元，平均等值為每月 1,000 元；正式計價單位仍為 24 個月一週期，不得解釋為逐月短約。</p>
<p>首次收取之保證金 6,000 元，於乙方在試用結束後確認續用、第一個正式 24 個月週期建立時，全額抵充該週期 24,000 元服務費，因此第一週期尚應支付 18,000 元。後續每次續約均另建新的 24 個月週期，標準續約費為 24,000 元，不再收取保證金且不再適用首期 6,000 元抵充。每期新建週期記錄，不得修改上一期已簽契約、PDF、Evidence、Hash 或 Audit。</p>
<h2>第五條｜保證金用途與終止處理</h2>
<p>保證金用於擔保乙方履行首次開通、試用及是否進入第一正式週期之契約義務，不是開通費。只有在乙方試用屆滿後確認續用並建立第一個正式週期時，才依前條抵充服務費；試用期間、乙方尚未確認續用、或因法令、欺詐、欠費、未返還甲方財產、第三方已實際發生費用或其他可歸責於乙方之未履行義務而依約終止時，不進行前述服務費抵充。</p>
<p>如乙方於試用屆滿選擇不續用或契約提前終止，甲方應先以可驗證之記錄列明乙方尚未履行之金錢義務、應賠償之實際損害或已發生且無法取消之第三方成本，始得自保證金中抵銷；抵銷不得超過有據之未履行義務或損害金額。扣除後如有餘額，甲方應於終止結算完成後 30 日內無息返還；如無任何前述未履行義務或可扣除項目，應全額返還。任何扣除、抵充或返還均應留存計算明細及 Audit 記錄。</p>
<h2>第六條｜24 期零利率與實際付款能力</h2>
<p>本方案之契約付款條件允許申請信用卡 24 期零利率，但契約付款條件與實際 Payment Provider 能力分離。「24 期零利率須依合作金融／支付機構核准與實際可用方案為準。」未經實際 Provider 確認支援前，系統不得分割或建立 24 筆假付款、假請款或假交易。第一週期實際待付總額仍為 18,000 元；將來 Provider 實作並驗證可用後，始得依其核准方案處理分期。</p>
<h2>第七條｜商家管理、第三方與營運條件</h2>
<p>商家管理者可依現有正式 Core 與帳號實際權限管理菜單、價格、分類、上下架、訂單、點餐、KDS 及營業設定。LINE、金流、信用卡、列印或其他第三方服務之實際開通、費率、審核、API 及可用性，依第三方條件及乙方帳號資格為準。</p>
<h2>第八條｜終止、功能停用與資料保留</h2>
<p>乙方不續用、週期屆滿未續約或契約終止時，甲方得停止付費正式服務功能。甲方應依適用法令、資料保存政策、交易與稽核需要保留必要記錄；已簽契約、付款記錄、PDF、Evidence、Hash 及 Audit 不得因功能停用而任意刪除或覆寫。乙方可在法令與平台匯出能力允許範圍內申請取得可提供之商家資料。</p>
<h2>第九條｜電子簽署、證據與版本</h2>
<p>雙方同意沿用 Common Contract Engine 以勾選確認、手寫簽名、簽署前預覽、PDF v2、私人 Evidence、R2、內容與文件 Hash 及 Audit 完成電子簽署。已簽文件不可變；條款或續約變更應建立新版本、新週期或補充協議，不得修改舊 Evidence。本手寫簽署為一般電子契約證據，不得宣稱為憑證式數位簽章。</p>
<h2>第十條｜法律審閱與生產環境 Gate</h2>
<p>本版本 legal status 為 pending_review，僅可於隔離 Staging 驗證。未經人工法律審閱、平台授權管理員核准、核准 Hash 與內容 Hash 一致且啟用 Production Legal Gate 前，不得於 Production 簽署或作為正式生產契約。</p>',
  'P-xbKa3C_s7E_5FFZU1xoXNv9GA752UPnpQgIPY4sJg','2026-09-02','pending_review',1,0,1,1
);

INSERT OR IGNORE INTO merchant_service_plan_versions(
  plan_id,contract_version,contract_version_id,formal_name,public_hardware_claim,
  activation_fee,deposit,trial_months,cycle_months,cycle_fee,first_cycle_credit,
  first_cycle_balance,currency,installment_count,installment_interest_rate_bps,
  legal_status,environment
) VALUES(
  'baiye_softpos_24000','merchant_softpos_v1_0_24000','merchant_softpos_v1_0_24000',
  '創百業智慧鏈｜免 POS 機智慧點餐系統','免專用 POS 主機',
  300000,600000,3,24,2400000,600000,1800000,'TWD',24,0,'pending_review','staging'
);

INSERT OR IGNORE INTO merchant_contract_payment_provider_capabilities(
  plan_id,provider_code,installment_count,zero_interest_enabled,production_verified
) VALUES('baiye_softpos_24000','unconfigured',24,0,0);
