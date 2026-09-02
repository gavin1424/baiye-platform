-- Merchant administrator V1. Internal owner keys remain unchanged for auth compatibility.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS merchant_admin_profiles (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),
  brand_name TEXT,
  business_description TEXT,
  support_phone TEXT,
  support_email TEXT,
  business_address TEXT,
  business_hours TEXT,
  transportation_info TEXT,
  social_links_json TEXT NOT NULL DEFAULT '{}',
  homepage_notice TEXT,
  shopping_cart_enabled INTEGER NOT NULL DEFAULT 0 CHECK(shopping_cart_enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor_member_id TEXT,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_pricing_config (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'TWD',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_line_integrations (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  basic_id TEXT,
  display_name TEXT,
  add_friend_url TEXT,
  integration_mode TEXT NOT NULL DEFAULT 'add_friend_link'
    CHECK(integration_mode IN ('add_friend_link','linked_line_login','future_multi_account_liff')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO platform_pricing_config(code,label,amount_minor,currency) VALUES
  ('simple_cart','簡易購物車',800000,'TWD'),
  ('external_checkout_cart','購物車＋外部安全結帳',1400000,'TWD'),
  ('payment_api','正式金流 API',2200000,'TWD');

INSERT OR IGNORE INTO merchant_permissions(code,module,description) VALUES
  ('merchant.profile.read','merchant','查看商家基本資料'),
  ('merchant.profile.write','merchant','編輯商家一般資料'),
  ('merchant.content.read','merchant','查看網站內容資料'),
  ('merchant.content.write','merchant','編輯網站內容資料'),
  ('merchant.products.read','merchant','查看商品與菜單'),
  ('merchant.products.write','merchant','編輯商品與菜單'),
  ('merchant.bookings.read','merchant','查看本商家預約'),
  ('merchant.bookings.write','merchant','管理本商家預約'),
  ('merchant.members.read','merchant','查看本商家會員 relationship'),
  ('merchant.orders.read','merchant','查看本商家訂單'),
  ('merchant.orders.write','merchant','管理本商家訂單'),
  ('merchant.google_booking.read','merchant','查看 Google 地圖預約申請'),
  ('merchant.google_booking.apply','merchant','申請 Google 地圖預約'),
  ('merchant.line.read','merchant','查看 LINE 官方帳號狀態'),
  ('merchant.contract.read','merchant','查看商家契約'),
  ('merchant.contract.download','merchant','下載已簽商家契約'),
  ('merchant.settings.read','merchant','查看商家設定'),
  ('merchant.settings.write','merchant','編輯商家一般設定');

INSERT OR IGNORE INTO merchant_role_permissions(role_id,permission_code)
SELECT r.id,p.code FROM merchant_roles r CROSS JOIN merchant_permissions p
WHERE r.code='owner' AND (p.code LIKE 'merchant.%' OR p.code LIKE 'ordering.%');

CREATE INDEX IF NOT EXISTS idx_merchant_admin_audit_merchant
  ON merchant_admin_audit_logs(merchant_id,created_at);

-- Fixed-price AI commerce plan. No component price rows are stored here.
CREATE TABLE IF NOT EXISTS merchant_service_plans (
  plan_id TEXT PRIMARY KEY,
  contract_version_id TEXT NOT NULL REFERENCES merchant_contract_versions(id),
  plan_name TEXT NOT NULL,
  fixed_price_minor INTEGER NOT NULL CHECK(fixed_price_minor=4500000),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency='TWD'),
  pricing_model TEXT NOT NULL CHECK(pricing_model='fixed_complete_package'),
  merchant_content_editable INTEGER NOT NULL DEFAULT 1 CHECK(merchant_content_editable=1),
  merchant_product_editable INTEGER NOT NULL DEFAULT 1 CHECK(merchant_product_editable=1),
  status TEXT NOT NULL DEFAULT 'staging' CHECK(status IN('staging','active','retired')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_plan_assignments (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  plan_id TEXT NOT NULL REFERENCES merchant_service_plans(plan_id),
  commercial_terms_id TEXT NOT NULL REFERENCES merchant_contract_commercial_terms(id),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN('assigned','superseded','cancelled')),
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  superseded_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_active_plan_assignment
  ON merchant_plan_assignments(merchant_id) WHERE status='assigned';

CREATE TABLE IF NOT EXISTS merchant_plan_entitlements (
  assignment_id TEXT PRIMARY KEY REFERENCES merchant_plan_assignments(id),
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  plan_id TEXT NOT NULL REFERENCES merchant_service_plans(plan_id),
  commerce_full INTEGER NOT NULL DEFAULT 0 CHECK(commerce_full IN(0,1)),
  cart INTEGER NOT NULL DEFAULT 0 CHECK(cart IN(0,1)),
  merchant_product_edit INTEGER NOT NULL DEFAULT 0 CHECK(merchant_product_edit IN(0,1)),
  merchant_content_editable INTEGER NOT NULL DEFAULT 0 CHECK(merchant_content_editable IN(0,1)),
  merchant_product_editable INTEGER NOT NULL DEFAULT 0 CHECK(merchant_product_editable IN(0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO merchant_commercial_terms_presets(
  id,plan_code,plan_name,list_price_minor,discount_price_minor,currency,
  standard_website_build_minor,contract_term_months,payment_plan,preset_version
) VALUES(
  'baiye_commerce_ai_45000','baiye_commerce_ai_45000','創百業智慧鏈｜AI 智慧商城完整版',
  4500000,4500000,'TWD',0,24,'upfront_18000','commerce-ai-fixed-45000-v1'
);

INSERT OR IGNORE INTO merchant_contract_versions(
  id,version,title,content_html,content_hash,effective_date,legal_review_status,
  legal_review_required,is_active,requires_resign,staging_signing_enabled
) VALUES(
  'merchant_commerce_ai_v1_0_45000','merchant_commerce_ai_v1_0_45000','創百業智慧鏈｜AI 智慧商城完整版服務契約',
  '<h1>創百業智慧鏈｜AI 智慧商城完整版服務契約</h1>
<h2>第一條｜契約雙方</h2>
<p>本契約由創百業智慧鏈平台營運主體（以下稱「甲方」）與完成商家註冊並於附件 A 留存資料之商家（以下稱「乙方」）共同訂立。雙方身分以簽署當時保存之不可變快照為準。</p>
<h2>第二條｜固定完整方案與總價</h2>
<p>乙方採用「創百業智慧鏈｜AI 智慧商城完整版」，方案 ID 為 baiye_commerce_ai_45000，固定總價為新臺幣 45,000 元整（NT$45,000）。</p>
<p>本方案為完整方案，不將商品後台、購物車、金流串接或 AI 拆分計價，亦不以舊單項價格加總。附件 A 僅列功能類別，不構成細項加購報價。</p>
<h2>第三條｜商城建置與方案內容</h2>
<p>本方案包含標準響應式商城建置、商家管理者後台、商品與分類管理、價格與圖片管理、商品規格／選項、上下架、購物車流程、訂單管理，以及平台當期實際提供之 AI 輔助功能。每日限量等庫存相關能力，僅於現有正式 Core 已支援之範圍內提供；未完成之一般化庫存扣減功能不列為已包含。</p>
<h2>第四條｜商家管理者後台與自行維護</h2>
<p>乙方管理者得於權限範圍內自行管理商家基本商城內容、商品、分類、價格、圖片、規格、上下架及訂單。乙方透過後台自行完成上述修改，不另收人工修改費，且不適用「每修改一項 NT$200」之人工代修改規則。</p>
<p>乙方不得修改 React 或其他程式、存取原始碼或 GitHub、Cloudflare、D1、R2、Secrets，亦不得查看或操作其他 Merchant 資料。非標準客製開發仍須另行書面確認，不因本方案而取得平台程式或基礎設施管理權。</p>
<h2>第五條｜商品、規格、訂單與購物車</h2>
<p>商品及訂單功能以平台實際啟用之 Commerce／Order Core 為準。乙方應確認商品名稱、價格、圖片、規格、供應狀態及訂單處理資料正確。購物車負責彙整顧客選購內容並建立訂單，不代表款項已完成支付。</p>
<h2>第六條｜AI 功能與限制</h2>
<p>本方案包含平台當期實際啟用之 AI 輔助客服、內容或營運工具。AI 產出可能錯誤、不完整或不適合特定情境，乙方應於發布或用於價格、商品、付款、退款、法律及重大客訴前自行審核。</p>
<p>甲方不保證 AI 產生特定營收、流量、排名或其他商業成果。超出方案合理額度或第三方模型配額之額外 AI 用量，須經乙方另行確認後始得計費或啟用。</p>
<h2>第七條｜第三方金流與支付服務商限制</h2>
<p>本方案包含標準金流串接建置；實際啟用仍依第三方支付服務商審核、帳號申請及技術可用性為準。</p>
<p>簽署本契約、建立訂單或顯示付款選項，均不等同已付款或支付 Provider 已正式啟用。只有 Provider credentials、商家帳號審核、法務／技術檢查及 Production E2E 均通過時，系統才得依 readiness Gate 開啟真實交易。甲方不得保證第三方必然核准或持續提供服務。</p>
<h2>第八條｜不包含之第三方費用</h2>
<p>固定總價 NT$45,000 不包含：金流交易手續費、電子發票第三方費用、LINE 超額訊息費、簡訊費、物流費、廣告費、第三方平台月費及額外 AI 超量費用。前述費用由第三方或經乙方另行確認後收取，不得混入本方案固定總價或以功能細項重複計價。</p>
<h2>第九條｜商家資料義務</h2>
<p>乙方應提供並持續維護正確、合法且有權使用之商家、商品、價格、圖片、商標、聯絡、金流及發票資料。因乙方資料錯誤、延遲、侵權或第三方帳號未通過審核所生之延遲或損害，不視為甲方已承諾之功能故障。</p>
<h2>第十條｜資料安全</h2>
<p>甲方應採合理之伺服器端授權、商家資料隔離、安全 Session、最小權限、稽核紀錄及必要安全更新。乙方應妥善保管帳號與裝置，不得繞過 Gate、攻擊平台、竄改交易或嘗試跨商家存取。</p>
<h2>第十一條｜個人資料</h2>
<p>雙方應依中華民國個人資料保護法及適用法令，在特定目的必要範圍內處理顧客、會員與簽署資料。涉及金流、LINE、簡訊、物流、電子發票或 AI 第三方服務時，資料僅得於完成服務必要範圍內提供予相應服務商。</p>
<h2>第十二條｜智慧財產權</h2>
<p>乙方原有之商標、照片、文字與商品資料權利仍歸乙方或原權利人。甲方既有及通用之平台程式、React 應用、系統架構、API、設計系統、資料庫結構與技術文件，仍歸甲方或合法授權人所有。乙方僅於契約有效期間取得約定功能之使用權。</p>
<h2>第十三條｜維護與服務可用性</h2>
<p>甲方提供方案範圍內之標準維護、安全修補及合理故障處理。因例行維護、重大資安事件、網路或第三方服務異常，甲方得於必要範圍暫停部分功能並盡合理努力降低影響；不保證網路或第三方服務永不中斷。</p>
<h2>第十四條｜電子簽署與不可變證據</h2>
<p>雙方同意以電子形式閱讀、確認及簽署本契約。系統得保存 Checkbox 同意、簽署人資料、手寫簽名軌跡、預覽確認、Idempotency 紀錄、契約與商業條件 Hash、PDF v2、Private R2 物件及 Evidence JSON，作為簽署與完整性證據。</p>
<p>手寫電子簽署屬一般電子契約證據，不宣稱為政府憑證式數位簽章。已簽版本及其證據不得直接覆寫；條款變更須建立新版本或補充協議。</p>
<h2>第十五條｜契約終止</h2>
<p>任一方依約終止時，雙方應處理已發生之交易、第三方成本、資料匯出與必要保存。已簽契約、付款、訂單、發票及安全稽核紀錄，得依法律、爭議處理與保存政策於必要期間留存。尚未履行部分及退款依實際履行情形與適用法律處理。</p>
<h2>第十六條｜準據法與爭議處理</h2>
<p>本契約以中華民國法律為準據法。爭議應先本誠信原則協議；未能解決時，以甲方登記所在地有管轄權之法院為第一審管轄法院，但不排除法律之強制管轄。</p>
<h2>第十七條｜契約完整性與法律審閱 Gate</h2>
<p>本正文、附件 A 及經雙方另行確認之補充協議構成完整契約。Production 僅得使用經正式法律審閱、核准 Hash 一致且已啟用之版本；pending_review 版本僅限隔離 Staging 測試簽署。</p>',
  'jInk1FaQJIL-q96GKco7NBuWkcP4GRJuHXJXvkfdcOg','2026-09-02','pending_review',1,0,0,1
);

INSERT OR IGNORE INTO merchant_service_plans(
  plan_id,contract_version_id,plan_name,fixed_price_minor,currency,pricing_model,
  merchant_content_editable,merchant_product_editable,status
) VALUES(
  'baiye_commerce_ai_45000','merchant_commerce_ai_v1_0_45000','創百業智慧鏈｜AI 智慧商城完整版',
  4500000,'TWD','fixed_complete_package',1,1,'staging'
);

CREATE TRIGGER IF NOT EXISTS trg_commerce_ai_plan_immutable_update
BEFORE UPDATE ON merchant_service_plans
WHEN OLD.plan_id='baiye_commerce_ai_45000'
BEGIN SELECT RAISE(ABORT,'COMMERCE_AI_PLAN_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_commerce_ai_plan_immutable_delete
BEFORE DELETE ON merchant_service_plans
WHEN OLD.plan_id='baiye_commerce_ai_45000'
BEGIN SELECT RAISE(ABORT,'COMMERCE_AI_PLAN_IMMUTABLE'); END;
