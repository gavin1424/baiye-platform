PRAGMA foreign_keys = ON;

-- Shared legal-review and evidence fields for the existing partner contract flow.
ALTER TABLE contract_versions ADD COLUMN legal_review_status TEXT NOT NULL DEFAULT 'pending_review'
  CHECK(legal_review_status IN ('draft','pending_review','approved','revoked'));
ALTER TABLE contract_versions ADD COLUMN reviewed_by TEXT;
ALTER TABLE contract_versions ADD COLUMN reviewed_at TEXT;
ALTER TABLE contract_versions ADD COLUMN legal_counsel_reference TEXT;
ALTER TABLE contract_versions ADD COLUMN approved_content_hash TEXT;

ALTER TABLE contract_signatures ADD COLUMN signature_assurance_level TEXT NOT NULL DEFAULT 'standard_electronic_agreement_evidence'
  CHECK(signature_assurance_level IN ('standard_electronic_agreement_evidence','certificate_digital_signature'));
ALTER TABLE contract_signatures ADD COLUMN public_id TEXT;
ALTER TABLE contract_signatures ADD COLUMN evidence_object_key TEXT;
ALTER TABLE contract_signatures ADD COLUMN session_id_hash TEXT;
ALTER TABLE contract_signatures ADD COLUMN status TEXT NOT NULL DEFAULT 'VALID'
  CHECK(status IN ('VALID','SUPERSEDED','REVOKED'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_contract_public_id
  ON contract_signatures(public_id) WHERE public_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS merchant_contract_versions (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  legal_review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK(legal_review_status IN ('draft','pending_review','approved','revoked')),
  legal_review_required INTEGER NOT NULL DEFAULT 1 CHECK(legal_review_required IN (0,1)),
  reviewed_by TEXT,
  reviewed_at TEXT,
  legal_counsel_reference TEXT,
  approved_content_hash TEXT,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN (0,1)),
  requires_resign INTEGER NOT NULL DEFAULT 0 CHECK(requires_resign IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_contract_commercial_terms (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  list_price_minor INTEGER NOT NULL CHECK(list_price_minor >= 0),
  discount_price_minor INTEGER NOT NULL CHECK(discount_price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency = 'TWD'),
  contract_term_months INTEGER NOT NULL CHECK(contract_term_months > 0),
  payment_plan TEXT NOT NULL CHECK(payment_plan IN ('upfront_18000','sales_offset_18000')),
  upfront_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(upfront_amount_minor >= 0),
  offset_target_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(offset_target_amount_minor >= 0),
  tax_reserve_enabled INTEGER NOT NULL DEFAULT 0 CHECK(tax_reserve_enabled IN (0,1)),
  withholding_enabled INTEGER NOT NULL DEFAULT 0 CHECK(withholding_enabled IN (0,1)),
  included_services_json TEXT NOT NULL,
  excluded_services_json TEXT NOT NULL,
  attachments_json TEXT NOT NULL,
  start_date TEXT NOT NULL,
  service_period_end TEXT NOT NULL,
  renewal_terms TEXT NOT NULL,
  custom_quote_reference TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','superseded','revoked')),
  created_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  terms_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id),
  CHECK((payment_plan='upfront_18000' AND offset_target_amount_minor=0)
     OR (payment_plan='sales_offset_18000' AND upfront_amount_minor=0))
);

CREATE TABLE IF NOT EXISTS merchant_contract_invites (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  commercial_terms_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id),
  FOREIGN KEY(merchant_id,commercial_terms_id) REFERENCES merchant_contract_commercial_terms(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS merchant_contract_signatures (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  merchant_id TEXT NOT NULL,
  merchant_user_id TEXT NOT NULL,
  contract_version_id TEXT NOT NULL,
  commercial_terms_id TEXT NOT NULL,
  signatory_legal_name TEXT NOT NULL,
  signatory_role TEXT NOT NULL CHECK(signatory_role IN ('legal_representative','authorized_representative')),
  legal_representative_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  tax_id TEXT,
  authorization_declaration_version TEXT,
  signed_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  contract_content_hash TEXT NOT NULL,
  commercial_terms_hash TEXT NOT NULL,
  signature_hash TEXT NOT NULL,
  signature_data TEXT NOT NULL,
  document_hash TEXT NOT NULL,
  pdf_hash TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  signature_assurance_level TEXT NOT NULL DEFAULT 'standard_electronic_agreement_evidence'
    CHECK(signature_assurance_level IN ('standard_electronic_agreement_evidence','certificate_digital_signature')),
  invite_id TEXT NOT NULL,
  session_id_hash TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  evidence_object_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VALID' CHECK(status IN ('VALID','SUPERSEDED','REVOKED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,contract_version_id),
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id),
  FOREIGN KEY(merchant_id,merchant_user_id) REFERENCES merchant_users(merchant_id,id),
  FOREIGN KEY(contract_version_id) REFERENCES merchant_contract_versions(id),
  FOREIGN KEY(merchant_id,commercial_terms_id) REFERENCES merchant_contract_commercial_terms(merchant_id,id),
  FOREIGN KEY(merchant_id,invite_id) REFERENCES merchant_contract_invites(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS merchant_contract_artifacts (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  signature_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK(artifact_type IN ('signed_pdf','evidence_json')),
  object_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(signature_id,artifact_type),
  FOREIGN KEY(merchant_id,signature_id) REFERENCES merchant_contract_signatures(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS merchant_contract_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  signature_id TEXT,
  invite_id TEXT,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('admin','merchant','system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id) REFERENCES merchants(id)
);

CREATE TABLE IF NOT EXISTS contract_sign_operations (
  id TEXT PRIMARY KEY,
  party_type TEXT NOT NULL CHECK(party_type IN ('partner','merchant')),
  party_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK(operation_type IN ('sign_preview','sign','invite_accept','invite_create','commercial_terms','version_create','version_update','legal_review')),
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','completed','failed')),
  result_json TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE(party_type,party_id,operation_type,idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_merchant_contract_terms_current
  ON merchant_contract_commercial_terms(merchant_id,status,approved_at);
CREATE INDEX IF NOT EXISTS idx_merchant_contract_invites_lookup
  ON merchant_contract_invites(token_hash,expires_at,used_at,revoked_at);
CREATE INDEX IF NOT EXISTS idx_merchant_contract_signatures_merchant
  ON merchant_contract_signatures(merchant_id,signed_at);
CREATE INDEX IF NOT EXISTS idx_merchant_contract_events_merchant
  ON merchant_contract_events(merchant_id,created_at);
CREATE INDEX IF NOT EXISTS idx_contract_operations_recovery
  ON contract_sign_operations(status,expires_at);

CREATE TRIGGER IF NOT EXISTS trg_partner_contract_signature_immutable_update
BEFORE UPDATE ON contract_signatures BEGIN SELECT RAISE(ABORT,'SIGNED_CONTRACT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_partner_contract_signature_immutable_delete
BEFORE DELETE ON contract_signatures BEGIN SELECT RAISE(ABORT,'SIGNED_CONTRACT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_merchant_contract_signature_immutable_update
BEFORE UPDATE ON merchant_contract_signatures BEGIN SELECT RAISE(ABORT,'SIGNED_CONTRACT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_merchant_contract_signature_immutable_delete
BEFORE DELETE ON merchant_contract_signatures BEGIN SELECT RAISE(ABORT,'SIGNED_CONTRACT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_merchant_contract_artifact_immutable_update
BEFORE UPDATE ON merchant_contract_artifacts BEGIN SELECT RAISE(ABORT,'SIGNED_ARTIFACT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_merchant_contract_artifact_immutable_delete
BEFORE DELETE ON merchant_contract_artifacts BEGIN SELECT RAISE(ABORT,'SIGNED_ARTIFACT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_merchant_contract_terms_approved_immutable
BEFORE UPDATE ON merchant_contract_commercial_terms
WHEN OLD.status='approved' BEGIN SELECT RAISE(ABORT,'APPROVED_COMMERCIAL_TERMS_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_merchant_contract_version_approved_content
BEFORE UPDATE OF content_html,content_hash ON merchant_contract_versions
WHEN OLD.legal_review_status='approved' BEGIN SELECT RAISE(ABORT,'APPROVED_CONTRACT_CONTENT_IMMUTABLE'); END;

-- Existing versions stay legally locked until an authorized administrator records
-- external counsel approval. Existing signatures and PDFs remain untouched.
UPDATE contract_versions
SET legal_review_status='pending_review', approved_content_hash=NULL
WHERE legal_review_required=1;

INSERT OR IGNORE INTO contract_versions (
  id,version,title,content_html,content_hash,effective_date,is_active,requires_resign,
  legal_review_required,legal_review_status
) VALUES (
  'contractor_partner_v1_4','v1.4','創百業智慧鏈｜承攬夥伴合作契約（法律審閱草稿）',
  '<h1>創百業智慧鏈｜承攬夥伴合作契約 v1.4</h1><p><strong>STAGING / DRAFT FOR LEGAL REVIEW</strong></p><h2>一、契約雙方與合作性質</h2><p>甲方為平台正式設定所載法律主體；乙方為經核准之承攬夥伴。本合作屬獨立承攬／居間合作，非僱傭關係，不設打卡、固定工時、排班或固定工作地點。</p><h2>二、有效成交與五級獎勵</h2><p>有效成交須具正確推薦歸因、完成當期標準方案全額付款，且非續約、維護費、重複、取消、退款、虛假、拆單或測試案件。歷史累計 1～10 件每件 NT$1,000；11～30 件每件 NT$1,500；31～70 件每件 NT$2,000；71～120 件每件 NT$2,500；121 件以上每件 NT$3,000。升級非追溯，自下一有效成交適用。</p><h2>三、資格維持與升降級</h2><p>初階、進階每月最低 1 件；中階 2 件；高階 3 件；資深 4 件。高階身份未達最低資格時，次月獎勵降一階但歷史身份不變。初階自啟用後第一個完整曆月起，連續兩個完整曆月 0 件者依契約終止。</p><h2>四、VIP 獎勵</h2><p>每三年為獨立週期；單一週期累計 1,000 家有效新商家，經正式審核後可取得一次性稅前 NT$1,000,000，每週期最多一次且不得跨期累計。</p><h2>五、退款、稅務與禁止行為</h2><p>退款或失效案件之佣金與獎勵依約沖回。稅務依適用法令及乙方實際稅務身分辦理，不硬列固定稅率。乙方不得私收平台服務款、假交易、拆單、不實廣告、未授權承諾或洩漏商業機密。</p><h2>六、個資、歸因、終止與既有案件</h2><p>乙方應依合法目的最小化處理個資；推薦歸因以平台稽核紀錄為準。終止後之既有案件、報酬及資料保存依本契約與法令處理。</p><h2>七、電子形式與契約版本</h2><p>雙方同意以電子形式完成契約程序。手寫簽名軌跡、明確同意、時間、Session、IP、User-Agent 與雜湊為線上簽署證據，不等同憑證式數位簽章或政府認證。條款變更以新版本或補充協議處理，舊文件永久保留。</p><h2>八、準據法與管轄</h2><p>依中華民國法律；管轄條款須於正式法律審閱時確認。</p><p><strong>LEGAL_REVIEW_REQUIRED：未經台灣執業律師審閱及平台授權管理員核准前，不得於 Production 簽署。</strong></p>',
  'm4OO-8UPRpS7P12fsfOnILjRslbAlc1caPbwHyIopWs','2026-08-29',0,1,1,'pending_review'
);

INSERT OR IGNORE INTO merchant_contract_versions (
  id,version,title,content_html,content_hash,effective_date,legal_review_status,
  legal_review_required,is_active,requires_resign
) VALUES (
  'merchant_service_v1_0','v1.0','創百業智慧鏈｜商家平台服務契約（法律審閱草稿）',
  '<h1>創百業智慧鏈｜商家平台服務契約 v1.0</h1><p><strong>STAGING / NOT A REAL CONTRACT / DRAFT FOR LEGAL REVIEW</strong></p><h2>一、契約雙方、方案與費用</h2><p>雙方資料、服務方案、價格、付款方式、服務期間及續約條件以簽署時不可變之附件 A 商業條件為準。</p><h2>二、服務範圍</h2><p>可能包含標準規格網站、網域、AI 客服、LINE、Booking、CRM、QR Ordering、Finance 及另行申請之 Settlement；實際交付以附件 B 為準，排除及另報價項目以附件 C 為準。</p><h2>三、第三方服務</h2><p>金流、LINE、AI、外送、憑證及其他第三方服務之實際啟用、費率、審核與服務條件，依第三方業者及個別契約為準，不保證核准、永久免費或永久不中斷。</p><h2>四、交付與驗收</h2><p>商家應提供正確且合法之品牌、商品、服務及聯絡資料；驗收方式依附件 D。超出標準規格之客製設計、程式、API 或自動化另行評估報價。</p><h2>五、個資、AI、智慧財產與資料</h2><p>雙方依適用法令處理個資。AI 產出應由商家確認，不保證正確率、營收或搜尋排名。既有智慧財產與商家資料權利歸屬、授權、保存及匯出依契約約定。</p><h2>六、維護、費用、退款與終止</h2><p>維護窗口、第三方中斷、付款、退款、取消、違約、終止及不可抗力依主契約與附件處理。不得解讀為政府補助、政府保證、營收保證或第三方核准保證。</p><h2>七、電子形式、版本及爭議</h2><p>簽署人同意以電子形式完成程序；明確同意、身份聲明、手寫簽名軌跡、時間、Session、IP、User-Agent 與雜湊作為線上簽署證據，不等同憑證式數位簽章。主契約與附件形成單一完整 Hash；變更須使用新版本或補充協議。準據法及管轄由正式法律審閱確認。</p><p><strong>附件 A：商業條件；附件 B：正式交付項目；附件 C：不包含／另報價項目；附件 D：驗收標準；附件 E：第三方服務與費用。</strong></p><p><strong>LEGAL_REVIEW_REQUIRED：未經台灣執業律師審閱及平台授權管理員核准前，不得於 Production 簽署。</strong></p>',
  'qkW0kyL1uCzVOBD_qIyk0Fe2Jy9PXPwJ1HO8AN5CxsY','2026-08-29','pending_review',1,0,1
);
