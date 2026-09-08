import { hashCanonical } from "./contract-engine.js";

export const COMMERCE_AI_PLAN_ID = "baiye_commerce_ai_45000";
export const COMMERCE_AI_CONTRACT_ID = "merchant_commerce_ai_v1_0_45000";
export const COMMERCE_AI_CONTRACT_VERSION = "merchant_commerce_ai_v1_0_45000";
export const COMMERCE_AI_PLAN_NAME = "創百業智慧鏈｜AI 智慧商城完整版";
export const COMMERCE_AI_PRICE_MINOR = 4500000;

export const COMMERCE_AI_CONTRACT_CONTENT_HTML = `<h1>創百業智慧鏈｜AI 智慧商城完整版服務契約</h1>
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
<p>本正文、附件 A 及經雙方另行確認之補充協議構成完整契約。Production 僅得使用經正式法律審閱、核准 Hash 一致且已啟用之版本；pending_review 版本僅限隔離 Staging 測試簽署。</p>`;

const money = (minor) => `NT$${Math.round(Number(minor || 0) / 100).toLocaleString("en-US")}`;

export function commerceAiAttachmentA(terms) {
  return [{
    title: "附件 A｜AI 智慧商城完整版",
    contentHtml: `<h2>附件 A｜方案與固定總價</h2><p>方案：AI 智慧商城完整版</p><p>方案 ID：${COMMERCE_AI_PLAN_ID}</p><p><strong>總價：${money(terms.discount_price_minor)}</strong></p><p>本附件不產生細項報價；下列僅為包含功能類別，價格均包含於固定總價 NT$45,000。</p><ul><li>商城建置</li><li>商家管理者後台與基本商城內容管理</li><li>商品、分類、價格、圖片、規格與上下架</li><li>購物車與訂單管理</li><li>平台當期實際啟用之 AI 輔助功能</li><li>標準金流串接建置（實際啟用依 Provider readiness）</li></ul><p>商家透過管理者後台自行修改方案內資料不另收費，不適用每項 NT$200 人工代修改規則。</p><p>不包含：金流交易手續費、電子發票第三方費用、LINE 超額訊息、簡訊、物流、廣告、第三方平台月費及額外 AI 超量費用。</p>`,
  }];
}

function taipeiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addMonthsMinusDay(isoDate, months) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, day));
  target.setUTCDate(target.getUTCDate() - 1);
  return target.toISOString().slice(0, 10);
}

export function commerceAiTermsSnapshot(now = new Date()) {
  const startDate = taipeiDate(now);
  return {
    plan_code: COMMERCE_AI_PLAN_ID,
    plan_name: COMMERCE_AI_PLAN_NAME,
    list_price_minor: COMMERCE_AI_PRICE_MINOR,
    discount_price_minor: COMMERCE_AI_PRICE_MINOR,
    currency: "TWD",
    contract_term_months: 24,
    payment_plan: "upfront_18000",
    upfront_amount_minor: COMMERCE_AI_PRICE_MINOR,
    offset_target_amount_minor: 0,
    tax_reserve_enabled: 0,
    withholding_enabled: 0,
    included_services: ["AI 智慧商城完整版（固定完整方案）"],
    excluded_services: ["第三方交易、發票、通訊、物流、廣告、平台月費與額外 AI 超量費用"],
    attachments: { pricing_model: "fixed_total_no_line_item_pricing", payment_provider: "standard_integration_build_subject_to_provider_readiness" },
    start_date: startDate,
    service_period_end: addMonthsMinusDay(startDate, 24),
    renewal_terms: "期滿續用條件須由雙方另行確認，不得未經商家同意自動扣款。",
    custom_quote_reference: null,
  };
}

export async function buildCommerceAiAssignment(db, merchantId, actorId, now = new Date()) {
  const merchant = await db.prepare("SELECT id FROM merchants WHERE id=?").bind(merchantId).first();
  if (!merchant) return null;
  const snapshot = commerceAiTermsSnapshot(now);
  const termsHash = await hashCanonical(snapshot);
  const compact = () => crypto.randomUUID().replaceAll("-", "");
  const termsId = `mcterms_${compact()}`;
  const assignmentId = `mplan_${compact()}`;
  await db.batch([
    db.prepare(`INSERT INTO merchant_contract_commercial_terms(
      id,merchant_id,plan_code,plan_name,list_price_minor,discount_price_minor,currency,
      contract_term_months,payment_plan,upfront_amount_minor,offset_target_amount_minor,
      tax_reserve_enabled,withholding_enabled,included_services_json,excluded_services_json,
      attachments_json,start_date,service_period_end,renewal_terms,custom_quote_reference,
      status,created_by,approved_by,approved_at,terms_hash,source_preset_id
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'approved',?,?,CURRENT_TIMESTAMP,?,?)`)
      .bind(termsId, merchantId, snapshot.plan_code, snapshot.plan_name, snapshot.list_price_minor,
        snapshot.discount_price_minor, snapshot.currency, snapshot.contract_term_months,
        snapshot.payment_plan, snapshot.upfront_amount_minor, snapshot.offset_target_amount_minor,
        snapshot.tax_reserve_enabled, snapshot.withholding_enabled, JSON.stringify(snapshot.included_services),
        JSON.stringify(snapshot.excluded_services), JSON.stringify(snapshot.attachments), snapshot.start_date,
        snapshot.service_period_end, snapshot.renewal_terms, null, actorId, actorId, termsHash, COMMERCE_AI_PLAN_ID),
    db.prepare("UPDATE merchant_plan_assignments SET status='superseded',superseded_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND status='assigned'").bind(merchantId),
    db.prepare("INSERT INTO merchant_plan_assignments(id,merchant_id,plan_id,commercial_terms_id,status,assigned_by) VALUES(?,?,?,?,'assigned',?)")
      .bind(assignmentId, merchantId, COMMERCE_AI_PLAN_ID, termsId, actorId),
    db.prepare(`INSERT INTO merchant_plan_entitlements(assignment_id,merchant_id,plan_id,commerce_full,cart,merchant_product_edit,merchant_content_editable,merchant_product_editable)
      VALUES(?,?,?,1,1,1,1,1)`).bind(assignmentId, merchantId, COMMERCE_AI_PLAN_ID),
    db.prepare(`INSERT INTO merchant_onboarding_states(merchant_id,registration_mode,state,operation_locked,commercial_terms_approval_required,commercial_terms_id)
      VALUES(?,'custom_quote','contract_required',1,0,?) ON CONFLICT(merchant_id) DO UPDATE SET registration_mode='custom_quote',state='contract_required',operation_locked=1,commercial_terms_approval_required=0,commercial_terms_id=excluded.commercial_terms_id,contract_signed_at=NULL,updated_at=CURRENT_TIMESTAMP`)
      .bind(merchantId, termsId),
  ]);
  return { assignment_id: assignmentId, commercial_terms_id: termsId, terms_hash: termsHash, snapshot };
}

export async function commerceEntitlements(db, merchantId) {
  const row = await db.prepare(`SELECT e.* FROM merchant_plan_entitlements e JOIN merchant_plan_assignments a ON a.id=e.assignment_id
    WHERE e.merchant_id=? AND e.plan_id=? AND a.status='assigned' ORDER BY a.assigned_at DESC LIMIT 1`).bind(merchantId, COMMERCE_AI_PLAN_ID).first();
  return {
    plan_id: row?.plan_id || null,
    commerce_full: Number(row?.commerce_full) === 1,
    cart: Number(row?.cart) === 1,
    merchant_product_edit: Number(row?.merchant_product_edit) === 1,
    merchant_content_editable: Number(row?.merchant_content_editable) === 1,
    merchant_product_editable: Number(row?.merchant_product_editable) === 1,
  };
}

export async function paymentReadiness(db, merchantId) {
  const rows = await db.prepare(`SELECT provider,mode,enabled,production_ready,provider_status,legal_review_status,technical_review_status
    FROM merchant_payment_integrations WHERE merchant_id=? ORDER BY provider,mode`).bind(merchantId).all();
  const providers = (rows.results || []).map((row) => ({
    provider: row.provider,
    mode: row.mode,
    ready: Number(row.enabled) === 1 && Number(row.production_ready) === 1 && row.provider_status === "active" && row.legal_review_status === "approved" && row.technical_review_status === "approved",
    status: row.provider_status,
  }));
  return { production_payment_enabled: providers.some((provider) => provider.ready), providers, credentials_exposed: false };
}
