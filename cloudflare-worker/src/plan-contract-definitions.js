import { MERCHANT_PLANS } from "./commercial-catalog.js";

const money = (minor) => `NT$${Math.round(Number(minor) / 100).toLocaleString("en-US")}`;

const SPECIFIC_TERMS = Object.freeze({
  baiye_standard_18000_addons: Object.freeze({
    payment_terms: "方案費用 NT$18,000；實際付款方式由雙方於既有申請／付款流程另行確認，不因本草稿自動扣款。",
    service_period: "自雙方確認之服務啟用日起 24 個月。",
    delivery_items: ["品牌網站", "AI 智能客服", "LINE 官方帳號", "會員與預約", "Google 地圖預約導流", "百工協助上架 20 項商品／服務"],
    limitations: ["網站主要內容由百工協助維護，不開放完整 CMS。", "基礎協助上架以 20 項商品／服務為限。", "超過 20 項或原方案外功能，以加購報價及補充協議辦理。"],
  }),
  baiye_commerce_ai_45000: Object.freeze({
    payment_terms: "方案費用 NT$45,000；實際付款方式由雙方於既有申請／付款流程另行確認，不因本草稿自動扣款。",
    service_period: "自雙方確認之服務啟用日起 24 個月。",
    delivery_items: ["AI 智慧營運", "完整商城", "商品、價格與圖片管理", "分類、規格與上下架", "購物車與訂單管理", "標準金流串接能力"],
    limitations: ["商家可自行管理商品、價格、圖片、分類、規格與上下架。", "實際金流啟用仍依 Provider readiness、第三方審核及服務條件。", "非標準客製、第三方費用與額外 AI 用量另行確認。"],
  }),
  baiye_softpos_24000: Object.freeze({
    payment_terms: "前 3 個月系統服務費 NT$0；首次開通費 NT$3,000；首次保證金 NT$6,000，可抵第一個 24 個月週期，首週期尚需 NT$18,000；後續每 24 個月 NT$24,000。實際付款方式由雙方於既有申請／付款流程另行確認。",
    service_period: "前 3 個月系統服務費免費，其後為 24 個月正式服務週期。",
    delivery_items: ["QR 手機點餐", "訂單與出餐看板", "庫存與售完同步", "會員營運", "手機／平板接單", "點餐購物車"],
    limitations: ["不包含專用 POS 主機。", "第三方金流、發票、通訊與設備費用依實際啟用條件另計。", "分期方案依合作銀行／金流服務商核准及當時可用條件為準。"],
  }),
});

export function planContractSnapshot(plan) {
  const specific = SPECIFIC_TERMS[plan.plan_id];
  if (!specific) throw new Error(`Unknown plan contract mapping: ${plan.plan_id}`);
  return {
    plan_id: plan.plan_id,
    plan_slug: plan.plan_slug,
    plan_name: plan.display_name,
    plan_price_minor: plan.price_minor,
    plan_price_display: money(plan.price_minor),
    currency: plan.currency,
    term_months: plan.term_months,
    trial_months: plan.trial_months,
    activation_fee_minor: plan.activation_fee_minor,
    deposit_minor: plan.deposit_minor,
    first_cycle_balance_minor: plan.first_cycle_balance_minor,
    payment_terms: specific.payment_terms,
    service_period: specific.service_period,
    summary: plan.summary,
    service_items: specific.delivery_items,
    limitations: specific.limitations,
    renewal_terms: plan.renewal_terms,
    addon_policy: plan.addon_policy,
  };
}

const list = (items) => `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
const agreementName = (planName) => `${planName}${planName.endsWith("方案") ? "" : "方案"}合作契約`;

function reviewedTerms(plan) {
  const snapshot = planContractSnapshot(plan);
  return [
    `<h1>創百業智慧鏈｜${agreementName(snapshot.plan_name)} v1.0</h1>`,
    `<h2>一、契約雙方與所選方案</h2><p>甲方：陳靈有限公司（創百業智慧鏈）；乙方：完成電子簽署之商家或其合法授權代表。乙方所選方案為「${snapshot.plan_name}」，方案識別碼為 ${snapshot.plan_id}。</p>`,
    `<h2>二、方案費用與付款方式</h2><p>${snapshot.payment_terms}</p><p>公開頁面或後續報價如有變動，不影響已簽署契約所保存之費用及方案 Snapshot。未經乙方另行確認，不視為同意自動續約或自動扣款。</p>`,
    `<h2>三、服務期間、內容與交付範圍</h2><p>${snapshot.service_period}</p><p>${snapshot.summary}</p>${list(snapshot.service_items)}`,
    `<h2>四、方案限制與另行約定事項</h2>${list(snapshot.limitations)}<p>續用條件：${snapshot.renewal_terms}</p><p>加購政策：${snapshot.addon_policy}</p>`,
    "<h2>五、雙方權利義務</h2><p>甲方依本契約 Snapshot 所列標準範圍提供建置、平台或營運工具；乙方應提供正確、合法且有權使用之商家、品牌、商品、服務與聯絡資料，並配合必要確認、測試及驗收。超出本方案範圍之需求，應另經雙方書面確認。</p>",
    "<h2>六、第三方服務、交付與驗收</h2><p>金流、分期、電子發票、LINE、簡訊、物流、AI 或其他第三方服務之啟用、費率、審核與持續提供，依第三方業者及個別約定為準。甲方不保證第三方必然核准、永久免費或永久不中斷。交付及驗收依本方案服務清單與雙方後續確認之執行紀錄辦理。</p>",
    "<h2>七、個資、AI、智慧財產與資料</h2><p>雙方應依適用法令處理個人資料。AI 產出應由乙方確認，不保證正確率、營收或搜尋排名。雙方既有智慧財產權仍歸原權利人；商家資料之合法性、授權及使用責任由提供資料之一方負責。</p>",
    "<h2>八、費用、變更、終止與爭議</h2><p>退款、取消、違約、終止、不可抗力及其他未盡事項，應以完成法律審閱之正式版本、個別報價或補充協議為準。方案變更不得直接覆寫既有契約；改選其他方案時應建立並重新簽署該方案之新契約。</p>",
    "<h2>九、電子形式、版本與證據</h2><p>雙方同意以電子形式完成程序；法定姓名、明確同意、手寫簽名軌跡、時間、Session、IP、User-Agent、方案 Snapshot、契約 Snapshot 與雜湊作為線上簽署證據。已簽署文件不得覆寫，條款或方案內容變更應建立新版本。</p>",
  ];
}

export function approvedPlanContractHtml(plan) {
  return reviewedTerms(plan).join("");
}

export function planContractHtml(plan) {
  const terms = reviewedTerms(plan);
  return [
    terms[0],
    "<p><strong>法律審閱草稿｜pending_review｜目前不可於 Production 正式簽署</strong></p>",
    ...terms.slice(1),
    "<h2>十、法律審閱 Gate</h2><p>本版本尚待正式法律審閱。未經平台授權管理員依實際法律審閱結果核准並鎖定內容 Hash 前，不得於 Production 正式簽署；準據法、管轄及依法不得排除之權利義務，以完成法律審閱後之正式版本為準。</p>",
  ].join("");
}

const DRAFT_TEMPLATE_IDS = Object.freeze({
  baiye_standard_18000_addons: "plan_contract_standard_v1_0",
  baiye_commerce_ai_45000: "plan_contract_commerce_v1_0",
  baiye_softpos_24000: "plan_contract_softpos_v1_0",
});

export const PLAN_CONTRACT_DRAFTS = Object.freeze(MERCHANT_PLANS.map((plan) => Object.freeze({
  contract_template_id: DRAFT_TEMPLATE_IDS[plan.plan_id],
  contract_type: "service_plan_agreement",
  plan_id: plan.plan_id,
  plan_slug: plan.plan_slug,
  contract_name: `創百業智慧鏈｜${agreementName(plan.display_name)}`,
  contract_version: "draft-v1.0-20260908",
  plan_snapshot: planContractSnapshot(plan),
  contract_snapshot: planContractHtml(plan),
  effective_at: "2026-09-08",
  status: "pending_review",
})));

export const PLAN_CONTRACTS = Object.freeze(MERCHANT_PLANS.map((plan) => Object.freeze({
  contract_template_id: plan.contract_template_id,
  contract_type: "service_plan_agreement",
  plan_id: plan.plan_id,
  plan_slug: plan.plan_slug,
  contract_name: `創百業智慧鏈｜${agreementName(plan.display_name)}`,
  contract_version: plan.plan_contract_version,
  plan_snapshot: planContractSnapshot(plan),
  contract_snapshot: approvedPlanContractHtml(plan),
  effective_at: "2026-09-08",
  status: "approved",
})));

export function findPlanContractDefinition(slug) {
  return PLAN_CONTRACTS.find((item) => item.plan_slug === slug) || null;
}
