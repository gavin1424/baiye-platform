-- Advisor Marketplace commercial, cancellation and settlement policy drafts.
-- These records are immutable drafts. This migration does not grant legal,
-- finance or accounting approval and does not enable Production payments.

CREATE TABLE advisor_commercial_policies (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','approved','retired')),
  legal_review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK(legal_review_status IN('pending_review','approved','rejected')),
  finance_review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK(finance_review_status IN('pending_review','approved','rejected')),
  accounting_review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK(accounting_review_status IN('pending_review','approved','rejected')),
  commission_policy_version TEXT NOT NULL,
  cancellation_policy_version TEXT NOT NULL,
  settlement_policy_version TEXT NOT NULL,
  provider_fee_policy TEXT NOT NULL,
  rounding_policy TEXT NOT NULL,
  tax_mode TEXT NOT NULL,
  withholding_mode TEXT NOT NULL,
  effective_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE advisor_cancellation_policies (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','approved','retired')),
  legal_review_status TEXT NOT NULL DEFAULT 'pending_review',
  policy_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  effective_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE advisor_settlement_policies (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','approved','retired')),
  legal_review_status TEXT NOT NULL DEFAULT 'pending_review',
  finance_review_status TEXT NOT NULL DEFAULT 'pending_review',
  accounting_review_status TEXT NOT NULL DEFAULT 'pending_review',
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
  period_type TEXT NOT NULL DEFAULT 'calendar_month',
  draft_day INTEGER NOT NULL,
  reconciliation_start_day INTEGER NOT NULL,
  reconciliation_end_day INTEGER NOT NULL,
  lock_target_day INTEGER NOT NULL,
  payout_target_day INTEGER NOT NULL,
  target_dates_are_guaranteed INTEGER NOT NULL DEFAULT 0 CHECK(target_dates_are_guaranteed IN(0,1)),
  effective_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE advisor_bookings ADD COLUMN lead_source TEXT NOT NULL DEFAULT 'organic'
  CHECK(lead_source IN('platform_referred','advisor_referred','organic','campaign','admin_import'));
ALTER TABLE advisor_bookings ADD COLUMN cancellation_policy_version TEXT;
ALTER TABLE advisor_bookings ADD COLUMN cancellation_policy_hash TEXT;
ALTER TABLE advisor_bookings ADD COLUMN refunded_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(refunded_amount_minor>=0);
ALTER TABLE advisor_bookings ADD COLUMN fraud_suspected INTEGER NOT NULL DEFAULT 0 CHECK(fraud_suspected IN(0,1));

ALTER TABLE advisor_commission_ledger ADD COLUMN tier_at_completion TEXT;
ALTER TABLE advisor_commission_ledger ADD COLUMN gross_amount_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE advisor_commission_ledger ADD COLUMN provider_fee_actual_minor INTEGER;
ALTER TABLE advisor_commission_ledger ADD COLUMN provider_fee_estimated_minor INTEGER;
ALTER TABLE advisor_commission_ledger ADD COLUMN provider_fee_source TEXT NOT NULL DEFAULT 'none'
  CHECK(provider_fee_source IN('none','test_estimate','provider_actual','manual_review'));
ALTER TABLE advisor_commission_ledger ADD COLUMN provider_fee_policy_version TEXT NOT NULL DEFAULT 'advisor_commercial_policy_v1_0';
ALTER TABLE advisor_commission_ledger ADD COLUMN commission_base_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE advisor_commission_ledger ADD COLUMN rounding_policy TEXT NOT NULL DEFAULT 'platform_remainder';
ALTER TABLE advisor_commission_ledger ADD COLUMN reversal_amount_minor INTEGER;

ALTER TABLE advisor_settlement_statements ADD COLUMN settlement_policy_version TEXT NOT NULL DEFAULT 'advisor_settlement_policy_v1_0';
ALTER TABLE advisor_settlement_statements ADD COLUMN transfer_reference TEXT;
ALTER TABLE advisor_settlement_statements ADD COLUMN admin_confirmed_at TEXT;

CREATE TRIGGER trg_advisor_commercial_policy_immutable_update BEFORE UPDATE ON advisor_commercial_policies BEGIN SELECT RAISE(ABORT,'ADVISOR_COMMERCIAL_POLICY_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_commercial_policy_immutable_delete BEFORE DELETE ON advisor_commercial_policies BEGIN SELECT RAISE(ABORT,'ADVISOR_COMMERCIAL_POLICY_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_cancellation_policy_immutable_update BEFORE UPDATE ON advisor_cancellation_policies BEGIN SELECT RAISE(ABORT,'ADVISOR_CANCELLATION_POLICY_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_cancellation_policy_immutable_delete BEFORE DELETE ON advisor_cancellation_policies BEGIN SELECT RAISE(ABORT,'ADVISOR_CANCELLATION_POLICY_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_settlement_policy_immutable_update BEFORE UPDATE ON advisor_settlement_policies BEGIN SELECT RAISE(ABORT,'ADVISOR_SETTLEMENT_POLICY_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_settlement_policy_immutable_delete BEFORE DELETE ON advisor_settlement_policies BEGIN SELECT RAISE(ABORT,'ADVISOR_SETTLEMENT_POLICY_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_settlement_paid_guard BEFORE UPDATE OF status ON advisor_settlement_statements
WHEN NEW.status='paid' AND (NEW.transfer_reference IS NULL OR NEW.admin_confirmed_at IS NULL)
BEGIN SELECT RAISE(ABORT,'ADVISOR_PAYOUT_EVIDENCE_REQUIRED'); END;

INSERT INTO advisor_cancellation_policies(id,version,status,legal_review_status,policy_json,content_hash)
VALUES('advisor_cancellation_policy_v1_0','advisor_cancellation_policy_v1_0','draft','pending_review',
'{"customer_before_24h":"FULL_REFUND","customer_within_24h":"PARTIAL_REFUND_CONFIG_REQUIRED","advisor_cancel":"FULL_REFUND","advisor_no_show":["FULL_REFUND","ADMIN_REVIEW"],"customer_no_show":"NO_SHOW_POLICY_CONFIG_REQUIRED","refund_percentage":"LEGAL_REVIEW_REQUIRED"}',
'ef5571e5ff95a5201c224dc44c11087f79cc279db6f8dc0f50ef48ae29ab6d96');

INSERT INTO advisor_settlement_policies(id,version,status,legal_review_status,finance_review_status,accounting_review_status,timezone,period_type,draft_day,reconciliation_start_day,reconciliation_end_day,lock_target_day,payout_target_day,target_dates_are_guaranteed)
VALUES('advisor_settlement_policy_v1_0','advisor_settlement_policy_v1_0','draft','pending_review','pending_review','pending_review','Asia/Taipei','calendar_month',1,1,5,10,15,0);

INSERT INTO advisor_commission_policies(id,version,status,commission_application_mode,provider_fee_policy,tax_withholding_mode,tiers_json,refund_policy_version,legal_review_status,finance_review_status)
VALUES('advisor_commission_policy_v1_0','advisor_commission_policy_v1_0','DRAFT','progressive_nonretroactive','before_split','manual_review',
'[{"min":1,"max":30,"advisor_bp":5000,"platform_bp":5000},{"min":31,"max":60,"advisor_bp":5200,"platform_bp":4800},{"min":61,"max":99,"advisor_bp":5300,"platform_bp":4700},{"min":100,"max":199,"advisor_bp":5500,"platform_bp":4500},{"min":200,"max":null,"advisor_bp":6000,"platform_bp":4000}]',
'advisor_cancellation_policy_v1_0','pending_review','pending_review');

INSERT INTO advisor_commercial_policies(id,version,status,legal_review_status,finance_review_status,accounting_review_status,commission_policy_version,cancellation_policy_version,settlement_policy_version,provider_fee_policy,rounding_policy,tax_mode,withholding_mode)
VALUES('advisor_commercial_policy_v1_0','advisor_commercial_policy_v1_0','draft','pending_review','pending_review','pending_review','advisor_commission_policy_v1_0','advisor_cancellation_policy_v1_0','advisor_settlement_policy_v1_0','before_split','platform_remainder','disabled','manual_review');

INSERT OR REPLACE INTO advisor_platform_policies(policy_key,policy_value,status) VALUES
('OFF_PLATFORM_CIRCUMVENTION_POLICY','LEGAL_REVIEW_REQUIRED','DRAFT'),
('customer_lead_source_policy','platform_referred|advisor_referred|organic|campaign|admin_import','DRAFT'),
('provider_fee_policy','before_split','DRAFT'),
('provider_fee_policy_version','advisor_commercial_policy_v1_0','DRAFT'),
('rounding_policy','platform_remainder','DRAFT'),
('tax_mode','disabled','DRAFT'),
('tax_withholding_policy','manual_review|ACCOUNTING_REVIEW_REQUIRED','DRAFT');

INSERT INTO advisor_contract_versions(id,version,title,content_html,content_hash,legal_review_status,approved_content_hash,is_active,commission_policy_version,customer_relationship_policy,cancellation_policy)
VALUES('advisor_partner_v1_1_draft','advisor_partner_v1_1_draft','創百業智慧鏈｜身心靈生活顧問合作契約',
'<h1>創百業智慧鏈｜身心靈生活顧問合作契約</h1><p><strong>DRAFT／LEGAL REVIEW REQUIRED</strong></p><h2>合作定位與獨立關係</h2><p>平台提供品牌、預約、會員、線上營運與推廣導流工具；顧問為獨立服務提供者。平台不保證客戶、流量或收入。</p><h2>平台服務與顧問義務</h2><p>顧問應提供真實、合法、安全的服務資訊並遵守內容、評價、個資與客戶資料使用規範。</p><h2>分潤與有效完成服務</h2><p>採 progressive_nonretroactive；1–30 筆 50%，31–60 筆 52%，61–99 筆 53%，100–199 筆 55%，200 筆以上 60%。各級僅適用達級後交易，不追溯。有效服務須 PAID、COMPLETED、未全額退款、未作廢、非詐欺且非測試。</p><h2>金流手續費與整數計算</h2><p>provider_fee_policy 為 before_split，分潤基礎為總額減金流費；金額均使用 TWD minor units，每筆保存政策、級距、費用、基礎與雙方分潤快照。尾差政策由版本化設定管理。</p><h2>結算</h2><p>Asia/Taipei 曆月制；每月 1 日草稿、1–5 日對帳緩衝、10 日鎖定目標、15 日撥款目標。目標日不保證銀行到帳；未具真實撥款 Provider、Admin 確認與轉帳憑證不得標記 paid。</p><h2>取消、退款、No-show 與 Chargeback</h2><p>開始前 24 小時以上預設全額退款；24 小時內須待比例設定；顧問取消為全額退款；顧問未到為全額退款並進 Admin Review；客戶未到須待政策設定。退款以不可變 reversal 記錄，爭議款依人工審核處理。</p><h2>客戶資料與平台內成交</h2><p>顧問僅得取得完成該次服務必要且遮罩後的資料，不得批量匯出、跨顧問存取或未經同意行銷。由平台 Booking、Lead、AI Match 或 Marketplace Inquiry 產生並於平台成交者，不得要求客戶改用私下轉帳或私人付款連結規避平台分潤；法律效果與違約處理仍須法律審閱。</p><h2>個資、評價與內容規範</h2><p>禁止醫療診斷、治療或停藥指示，禁止投資獲利、法律結果、婚姻結果或百分之百準確保證；評價依已完成且已付款服務及審核流程。</p><h2>AI 素材、肖像與智慧財產</h2><p>照片、肖像、聲音、AI 影片與推廣使用須有明確授權；未簽授權不得生成或發布。顧問應確保素材權利完整。</p><h2>終止、歷史資料與電子簽署</h2><p>合作終止後 Profile 與 Media 依政策處理；歷史訂單、財務、稽核及契約依法保存。電子簽署建立 Canonical Hash、PDF、Private R2 Evidence 與驗證紀錄。</p>',
'752ddbe2756ba45a26d5b48e1caf12c9bafaad0c2ea1a05e0cc3ec33462993d4','pending_review',NULL,0,'advisor_commission_policy_v1_0','LEGAL_REVIEW_REQUIRED','advisor_cancellation_policy_v1_0');

INSERT INTO advisor_consumer_terms_versions(id,version,title,content_html,content_hash,legal_review_status,approved_content_hash,cancellation_policy_status,is_active)
VALUES('advisor_consumer_service_terms_v1_1_draft','advisor_consumer_service_terms_v1_1_draft','身心靈生活顧問服務條款',
'<h1>身心靈生活顧問服務條款</h1><p><strong>DRAFT／LEGAL REVIEW REQUIRED</strong></p><h2>平台角色與服務提供者</h2><p>平台提供資訊、預約與付款準備工具；Advisor 為獨立服務提供者。</p><h2>服務、價格、預約與付款</h2><p>消費者應於付款前確認服務內容、價格、時間、方式與聯絡安排；Staging 僅使用 Test Provider。</p><h2>取消、退款與 No-show</h2><p>服務開始前 24 小時以上預設 FULL_REFUND；24 小時內為 PARTIAL_REFUND_CONFIG_REQUIRED；顧問取消為 FULL_REFUND；顧問未到為 FULL_REFUND 並由 Admin Review；客戶未到為 NO_SHOW_POLICY_CONFIG_REQUIRED。正式比例與法律效果仍待法律審閱。</p><h2>爭議與評價</h2><p>爭議、Chargeback 與客訴依人工審核流程；僅已完成且已付款服務可依規則評價。</p><h2>個資與聯絡</h2><p>僅蒐集服務必要資料，顧問端手機遮罩；不得跨顧問取得資料或未經同意用於行銷。客服聯絡方式以平台公開頁為準。</p><h2>服務定位與重要聲明</h2><p>服務屬文化、娛樂、生活探索、個人成長與一般陪談用途，不替代醫療、心理治療、法律、投資或其他依法須由專業資格人員提供的服務。</p>',
'20fcb880acc3d703e61a917944e406fd856d19d48577900bdf920b0ea4e4e01b','pending_review',NULL,'LEGAL_REVIEW_REQUIRED',0);
