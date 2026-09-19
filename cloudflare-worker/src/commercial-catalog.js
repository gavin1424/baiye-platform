export const COMMERCIAL_CATALOG_VERSION = "2026-09-20.ai-commerce-50000-v1";

export const MERCHANT_PLANS = Object.freeze([
  Object.freeze({
    plan_id: "baiye_standard_18000_addons",
    plan_slug: "standard-digital-18000",
    contract_template_id: "plan_contract_standard_production_v1_0",
    plan_contract_version: "v1.0",
    display_name: "百工標準方案",
    short_name: "標準數位升級",
    price_minor: 1800000,
    list_price_minor: 3000000,
    currency: "TWD",
    term_months: 24,
    trial_months: 0,
    activation_fee_minor: 0,
    deposit_minor: 0,
    first_cycle_balance_minor: 1800000,
    contract_version: "merchant_service_v1_2_18000_addons",
    contract_review_status: "approved",
    merchant_content_editable: false,
    merchant_product_editable: false,
    cart_enabled: false,
    commerce_full: false,
    base_product_limit: 20,
    badge: "基礎數位升級",
    summary: "品牌網站、AI 智能客服、LINE、會員、預約與 Google 地圖預約導流。",
    features: ["品牌網站", "AI 智能客服", "LINE 官方帳號", "會員與預約", "Google 地圖預約導流", "百工協助上架 20 項商品／服務"],
    renewal_terms: "第 3 年起如選擇續用：平台上架 NT$3,000、網域 NT$1,000、後台／網站維持 NT$3,000，合計 NT$7,000／年。",
    addon_policy: "超過 20 項商品或原方案外功能，以加購報價及補充協議辦理。",
  }),
  Object.freeze({
    plan_id: "baiye_commerce_ai_45000",
    plan_slug: "ai-commerce-45000",
    contract_template_id: "plan_contract_commerce_production_v1_1_50000",
    plan_contract_version: "v1.1",
    display_name: "AI 智慧商城完整版",
    short_name: "AI 智慧商城",
    price_minor: 5000000,
    list_price_minor: 5000000,
    currency: "TWD",
    term_months: 24,
    trial_months: 0,
    activation_fee_minor: 0,
    deposit_minor: 0,
    first_cycle_balance_minor: 5000000,
    contract_version: "merchant_commerce_ai_v1_1_50000",
    contract_review_status: "approved",
    merchant_content_editable: true,
    merchant_product_editable: true,
    cart_enabled: true,
    commerce_full: true,
    base_product_limit: null,
    badge: "完整商城",
    summary: "AI、完整商城、商品管理、購物車、訂單與標準金流串接能力。",
    features: ["AI 智慧營運", "完整商城", "商品、價格與圖片管理", "分類、規格與上下架", "購物車與訂單管理", "標準金流串接能力"],
    renewal_terms: "期滿續用條件由雙方另行確認，不會未經商家同意自動扣款。",
    addon_policy: "非標準客製、第三方費用與額外 AI 用量另行確認。",
  }),
  Object.freeze({
    plan_id: "baiye_softpos_24000",
    plan_slug: "softpos-24000",
    contract_template_id: "plan_contract_softpos_production_v1_0",
    plan_contract_version: "v1.0",
    display_name: "免 POS 機智慧點餐",
    short_name: "免 POS 機智慧點餐",
    price_minor: 2400000,
    list_price_minor: 2400000,
    currency: "TWD",
    term_months: 24,
    trial_months: 3,
    activation_fee_minor: 300000,
    deposit_minor: 600000,
    first_cycle_balance_minor: 1800000,
    contract_version: "merchant_softpos_v1_0_24000",
    contract_review_status: "approved",
    merchant_content_editable: false,
    merchant_product_editable: true,
    cart_enabled: true,
    commerce_full: false,
    base_product_limit: null,
    badge: "前 3 個月免費",
    summary: "QR 點餐、訂單、庫存、出餐看板與會員營運，不必購買專用 POS 主機。",
    features: ["前 3 個月系統服務費 NT$0", "QR 手機點餐", "訂單與出餐看板", "庫存與售完同步", "會員營運", "手機／平板即可接單"],
    renewal_terms: "首個正式週期以保證金 NT$6,000 抵充，尚需 NT$18,000；後續每 24 個月 NT$24,000。",
    addon_policy: "第三方金流、發票、通訊與設備費用依實際啟用條件另計。",
  }),
]);

export const STANDARD_ADDONS = Object.freeze([
  Object.freeze({ code: "simple_cart", label: "簡易購物車", pricing_model: "fixed", amount_minor: 800000, display_price: "NT$8,000" }),
  Object.freeze({ code: "external_checkout_cart", label: "購物車＋外部安全結帳", pricing_model: "fixed", amount_minor: 1400000, display_price: "NT$14,000" }),
  Object.freeze({ code: "payment_api", label: "正式金流 API", pricing_model: "quote_required", minimum_minor: 2200000, display_price: "NT$22,000 起", admin_quote_required: true }),
  Object.freeze({ code: "bulk_products_50", label: "大量商品上架", pricing_model: "per_block", amount_minor: 300000, unit_size: 50, included_units: 20, display_price: "超過 20 項後，每增加 50 項 NT$3,000" }),
  Object.freeze({ code: "manual_content_changes", label: "少量人工修改", pricing_model: "tiered_minimum", minimum_minor: 60000, included_units: 3, per_unit_minor: 20000, display_price: "最低 NT$600／次（含 3 件），第 4 件起 NT$200／件" }),
  Object.freeze({ code: "new_product_listing", label: "全新商品少量上架", pricing_model: "tiered_minimum", minimum_minor: 60000, per_unit_minor: 20000, display_price: "NT$200／件，最低 NT$600" }),
]);

export function publicCommercialCatalog(plans = MERCHANT_PLANS) {
  return {
    version: COMMERCIAL_CATALOG_VERSION,
    currency: "TWD",
    server_authoritative: true,
    final_contract_amount_server_calculated: true,
    legal_gate_preserved: true,
    plans,
    standard_addons: STANDARD_ADDONS,
    installment_disclosure: "實際分期方案依合作銀行／金流服務商核准及當時可用條件為準。",
  };
}

export async function handleCommercialCatalog(request, env, cors = {}) {
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "content-type": "application/json; charset=UTF-8", ...cors } });
  try {
    const result = await env.FINANCE_DB.prepare("SELECT id,plan_id,plan_slug,contract_version,plan_details_snapshot FROM service_plan_contract_templates WHERE is_active=1 AND status='approved'").all();
    const current = new Map((result.results || []).map((row) => [row.plan_slug, row]));
    const plans = MERCHANT_PLANS.map((config) => {
      const row = current.get(config.plan_slug);
      if (!row) throw new Error(`Missing active plan: ${config.plan_slug}`);
      const snapshot = JSON.parse(row.plan_details_snapshot);
      return Object.freeze({
        ...config,
        contract_template_id: row.id,
        plan_contract_version: row.contract_version,
        price_minor: Number(snapshot.plan_price_minor),
        list_price_minor: Number(snapshot.plan_price_minor),
        first_cycle_balance_minor: Number(snapshot.first_cycle_balance_minor ?? snapshot.plan_price_minor),
      });
    });
    return new Response(JSON.stringify(publicCommercialCatalog(plans)), { headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...cors } });
  } catch (error) {
    console.error(JSON.stringify({ service: "commercial_catalog", error: error instanceof Error ? error.message : "unknown" }));
    return new Response(JSON.stringify({ error: "方案資料暫時無法載入" }), { status: 503, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...cors } });
  }
}
