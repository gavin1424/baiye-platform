PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS platform_service_plans (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  base_price_minor INTEGER NOT NULL CHECK(base_price_minor>=0),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency='TWD'),
  service_months INTEGER NOT NULL CHECK(service_months>0),
  base_product_limit INTEGER NOT NULL CHECK(base_product_limit>=0),
  merchant_content_editable INTEGER NOT NULL DEFAULT 0 CHECK(merchant_content_editable IN (0,1)),
  contract_version_id TEXT NOT NULL REFERENCES merchant_contract_versions(id),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_addon_pricing_config (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  pricing_model TEXT NOT NULL CHECK(pricing_model IN ('fixed','per_block','tiered_minimum','quote_required')),
  amount_minor INTEGER,
  unit_size INTEGER,
  included_units INTEGER NOT NULL DEFAULT 0,
  per_unit_minor INTEGER,
  minimum_minor INTEGER,
  minimum_label TEXT,
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency='TWD'),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_content_change_requests (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  request_type TEXT NOT NULL DEFAULT 'content_change',
  items_text TEXT NOT NULL,
  requested_copy TEXT,
  image_refs_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN ('SUBMITTED','REVIEWING','QUOTED','APPROVED','IN_PROGRESS','COMPLETED','CANCELLED')),
  warranty_covered INTEGER NOT NULL DEFAULT 0 CHECK(warranty_covered IN (0,1)),
  quote_id TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_addon_quotes (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  change_request_id TEXT REFERENCES merchant_content_change_requests(id),
  quote_no TEXT NOT NULL UNIQUE,
  plan_code TEXT NOT NULL DEFAULT 'baiye_standard_18000_addons' REFERENCES platform_service_plans(code),
  base_amount_minor INTEGER NOT NULL DEFAULT 1800000 CHECK(base_amount_minor=1800000),
  addon_amount_minor INTEGER NOT NULL CHECK(addon_amount_minor>=0),
  contract_total_minor INTEGER NOT NULL CHECK(contract_total_minor=base_amount_minor+addon_amount_minor),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency='TWD'),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ISSUED','ACCEPTED','DECLINED','EXPIRED','CANCELLED')),
  expires_at TEXT,
  issued_by TEXT NOT NULL,
  issued_at TEXT,
  accepted_by TEXT,
  accepted_at TEXT,
  acceptance_ip TEXT,
  acceptance_user_agent TEXT,
  pricing_snapshot_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_addon_quote_items (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES merchant_addon_quotes(id),
  pricing_code TEXT NOT NULL REFERENCES platform_addon_pricing_config(code),
  label TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity>0),
  unit_amount_minor INTEGER,
  amount_minor INTEGER NOT NULL CHECK(amount_minor>=0),
  admin_quoted INTEGER NOT NULL DEFAULT 0 CHECK(admin_quoted IN (0,1)),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS merchant_contract_addenda (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  quote_id TEXT NOT NULL UNIQUE REFERENCES merchant_addon_quotes(id),
  parent_signature_id TEXT NOT NULL REFERENCES merchant_contract_signatures(id),
  addendum_version TEXT NOT NULL DEFAULT 'addendum_v1',
  annex_b_json TEXT NOT NULL,
  base_amount_minor INTEGER NOT NULL CHECK(base_amount_minor=1800000),
  addon_amount_minor INTEGER NOT NULL CHECK(addon_amount_minor>=0),
  contract_total_minor INTEGER NOT NULL CHECK(contract_total_minor=base_amount_minor+addon_amount_minor),
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AWAITING_SIGNATURE' CHECK(status IN ('AWAITING_SIGNATURE','SIGNED','VOID')),
  payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(payment_status IN ('UNPAID','PENDING','PAID','REFUNDED','VOID')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  signed_at TEXT,
  signatory_legal_name TEXT,
  signature_hash TEXT,
  signature_data TEXT,
  document_hash TEXT,
  pdf_hash TEXT,
  r2_key TEXT,
  evidence_object_key TEXT
);

CREATE TABLE IF NOT EXISTS merchant_addon_audit_logs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  actor_type TEXT NOT NULL CHECK(actor_type IN ('admin','merchant','system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_change_request_merchant ON merchant_content_change_requests(merchant_id,created_at);
CREATE INDEX IF NOT EXISTS idx_addon_quote_merchant ON merchant_addon_quotes(merchant_id,created_at);
CREATE INDEX IF NOT EXISTS idx_addon_audit_merchant ON merchant_addon_audit_logs(merchant_id,created_at);

CREATE TRIGGER IF NOT EXISTS trg_addon_quote_accepted_immutable
BEFORE UPDATE OF base_amount_minor,addon_amount_minor,contract_total_minor,pricing_snapshot_hash ON merchant_addon_quotes
WHEN OLD.status='ACCEPTED' BEGIN SELECT RAISE(ABORT,'ACCEPTED_ADDON_QUOTE_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_addendum_signed_immutable
BEFORE UPDATE OF quote_id,parent_signature_id,addendum_version,annex_b_json,base_amount_minor,addon_amount_minor,contract_total_minor,content_hash,signed_at,signatory_legal_name,signature_hash,signature_data,document_hash,pdf_hash,r2_key,evidence_object_key ON merchant_contract_addenda WHEN OLD.status='SIGNED'
BEGIN SELECT RAISE(ABORT,'SIGNED_ADDENDUM_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_addendum_signed_delete
BEFORE DELETE ON merchant_contract_addenda WHEN OLD.status='SIGNED'
BEGIN SELECT RAISE(ABORT,'SIGNED_ADDENDUM_IMMUTABLE'); END;

INSERT OR IGNORE INTO merchant_contract_versions(
  id,version,title,content_html,content_hash,effective_date,legal_review_status,
  legal_review_required,is_active,requires_resign,staging_signing_enabled
) VALUES (
  'merchant_service_v1_2_18000_addons','merchant_service_v1_2_18000_addons','創百業智慧鏈｜NT$18,000 標準版＋加價購服務契約 V2',
  '<h1>創百業智慧鏈｜標準版服務契約 V2</h1><h2>標準方案</h2><p>契約固定價新臺幣 18,000 元，服務期間 24 個月，由百工協助建立與維護標準網站，並協助上架最多 20 項商品或服務。</p><h2>商家管理中心</h2><p>商家可登入查看契約、預約、會員、Google 地圖預約、LINE 狀態及基本營運資料；本方案不提供完整網站內容編輯器、完整商品 CMS 或網站版型自行修改權限。</p><h2>內容修改</h2><p>網站主要內容、商品主要建檔及版型由百工協助修改。商家應透過「申請內容修改」提交文字、圖片與需求；保固或百工應處理事項得為 NT$0，額外人工服務須另行報價。</p><h2>加購及附件 B</h2><p>加購項目不屬於本主契約固定價。只有實際選購時，始以報價、商家接受及附件 B／補充協議記載品項與金額；正式金流 API 等起價項目之最終金額須由百工管理員確認，不得由系統自行決定。</p><h2>契約證據</h2><p>已簽署之主契約 PDF 不得修改。任何使契約金額變動之加購，均須建立新的報價接受紀錄、補充協議、電子簽署、付款狀態及稽核證據。</p>',
  'merchant-service-v1-2-18000-addons-pending-runtime-hash','2026-09-02','pending_review',1,0,0,1
);

INSERT OR IGNORE INTO platform_service_plans(code,label,base_price_minor,currency,service_months,base_product_limit,merchant_content_editable,contract_version_id)
VALUES('baiye_standard_18000_addons','創百業智慧鏈｜NT$18,000 標準版＋加價購',1800000,'TWD',24,20,0,'merchant_service_v1_2_18000_addons');

INSERT OR REPLACE INTO platform_addon_pricing_config(code,label,pricing_model,amount_minor,unit_size,included_units,per_unit_minor,minimum_minor,minimum_label,currency,enabled) VALUES
  ('simple_cart','簡易購物車','fixed',800000,NULL,0,NULL,NULL,NULL,'TWD',1),
  ('external_checkout_cart','購物車＋外部安全結帳','fixed',1400000,NULL,0,NULL,NULL,NULL,'TWD',1),
  ('payment_api','正式金流 API','quote_required',NULL,NULL,0,NULL,2200000,'NT$22,000 起，須百工 Admin 確認 Quote','TWD',1),
  ('bulk_products_50','大量商品上架','per_block',300000,50,20,NULL,NULL,'超過基礎 20 項後，每增加 50 項','TWD',1),
  ('manual_content_changes','少量人工修改','tiered_minimum',NULL,NULL,3,20000,60000,'最低 NT$600／次，含 3 件；第 4 件起 NT$200／件','TWD',1),
  ('new_product_listing','全新商品少量上架','tiered_minimum',NULL,NULL,0,20000,60000,'NT$200／件，最低 NT$600','TWD',1),
  ('custom_page','客製頁面','quote_required',NULL,NULL,0,NULL,0,'須百工 Admin 確認 Quote','TWD',1),
  ('second_language','第二語言','quote_required',NULL,NULL,0,NULL,0,'須百工 Admin 確認 Quote','TWD',1),
  ('third_party_api','第三方 API','quote_required',NULL,NULL,0,NULL,0,'須百工 Admin 確認 Quote','TWD',1),
  ('special_inventory_order','特殊庫存／訂單','quote_required',NULL,NULL,0,NULL,0,'須百工 Admin 確認 Quote','TWD',1),
  ('other_formal_addon','其他百工正式加購項目','quote_required',NULL,NULL,0,NULL,0,'須百工 Admin 確認 Quote','TWD',1);

-- Standard-plan owners can view operations, but cannot mutate website/product CMS.
DELETE FROM merchant_role_permissions WHERE role_id IN (SELECT id FROM merchant_roles WHERE code='owner')
  AND permission_code IN ('merchant.content.write','merchant.products.write');
INSERT OR IGNORE INTO merchant_permissions(code,module,description) VALUES
  ('merchant.content_change.create','merchant','提出內容修改申請'),
  ('merchant.addon_quote.read','merchant','查看加購報價'),
  ('merchant.addon_quote.accept','merchant','接受加購報價'),
  ('merchant.addendum.sign','merchant','簽署加購補充協議');
INSERT OR IGNORE INTO merchant_role_permissions(role_id,permission_code)
SELECT r.id,p.code FROM merchant_roles r CROSS JOIN merchant_permissions p
WHERE r.code='owner' AND p.code IN ('merchant.content_change.create','merchant.addon_quote.read','merchant.addon_quote.accept','merchant.addendum.sign');
