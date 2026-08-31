import { hashCanonical } from "./contract-engine.js";

export const STANDARD_MERCHANT_TERMS_PRESET_ID = "baiye_standard_18000";
export const STANDARD_MERCHANT_PLAN_CODE = "baiye_standard_18000";

function taipeiCalendarDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addMonthsMinusDay(isoDate, months) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, day));
  target.setUTCDate(target.getUTCDate() - 1);
  return target.toISOString().slice(0, 10);
}

export function standardCommercialTermsSnapshot(now = new Date()) {
  const startDate = taipeiCalendarDate(now);
  return {
    plan_code: STANDARD_MERCHANT_PLAN_CODE,
    plan_name: "創百業智慧鏈｜AI 行銷推廣及數位服務方案",
    list_price_minor: 3000000,
    discount_price_minor: 1800000,
    currency: "TWD",
    contract_term_months: 24,
    payment_plan: "upfront_18000",
    upfront_amount_minor: 1800000,
    offset_target_amount_minor: 0,
    tax_reserve_enabled: 0,
    withholding_enabled: 0,
    included_services: [
      "標準規格網站基礎建置（NT$0）",
      "創百業智慧鏈數位服務方案之標準交付項目",
    ],
    excluded_services: [
      "超出標準規格之客製設計、程式、API 或第三方整合",
      "第三方服務之審核、費率及啟用結果",
    ],
    attachments: {
      acceptance: "依商家契約附件與雙方核准之交付清單逐項驗收。",
      third_party: "第三方服務的實際啟用、費率、審核與服務條件，依第三方業者及個別契約為準。",
    },
    start_date: startDate,
    service_period_end: addMonthsMinusDay(startDate, 24),
    renewal_terms: "續約、終止及後續合作方式，依雙方當時有效之契約版本、平台規範及雙方約定辦理。",
    custom_quote_reference: null,
  };
}

export function isStandardCommercialTerms(terms) {
  return terms?.plan_code === STANDARD_MERCHANT_PLAN_CODE
    && Number(terms?.list_price_minor) === 3000000
    && Number(terms?.discount_price_minor) === 1800000
    && terms?.currency === "TWD"
    && terms?.payment_plan === "upfront_18000"
    && Number(terms?.upfront_amount_minor) === 1800000
    && Number(terms?.offset_target_amount_minor) === 0
    && !terms?.custom_quote_reference;
}

export async function ensureStandardCommercialTerms(db, merchantId, now = new Date()) {
  const current = await db.prepare("SELECT * FROM merchant_contract_commercial_terms WHERE merchant_id=? AND status='approved' ORDER BY approved_at DESC,created_at DESC LIMIT 1")
    .bind(merchantId).first();
  if (current) return { terms: current, created: false };

  const snapshot = standardCommercialTermsSnapshot(now);
  const termsHash = await hashCanonical(snapshot);
  const id = `mcterms_${crypto.randomUUID().replaceAll("-", "")}`;
  await db.prepare(`INSERT INTO merchant_contract_commercial_terms(
      id,merchant_id,plan_code,plan_name,list_price_minor,discount_price_minor,currency,
      contract_term_months,payment_plan,upfront_amount_minor,offset_target_amount_minor,
      tax_reserve_enabled,withholding_enabled,included_services_json,excluded_services_json,
      attachments_json,start_date,service_period_end,renewal_terms,custom_quote_reference,
      status,created_by,approved_by,approved_at,terms_hash,source_preset_id
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'approved','platform_standard_terms','platform_standard_terms',CURRENT_TIMESTAMP,?,?)`)
    .bind(
      id, merchantId, snapshot.plan_code, snapshot.plan_name, snapshot.list_price_minor,
      snapshot.discount_price_minor, snapshot.currency, snapshot.contract_term_months,
      snapshot.payment_plan, snapshot.upfront_amount_minor, snapshot.offset_target_amount_minor,
      snapshot.tax_reserve_enabled, snapshot.withholding_enabled,
      JSON.stringify(snapshot.included_services), JSON.stringify(snapshot.excluded_services),
      JSON.stringify(snapshot.attachments), snapshot.start_date, snapshot.service_period_end,
      snapshot.renewal_terms, snapshot.custom_quote_reference, termsHash,
      STANDARD_MERCHANT_TERMS_PRESET_ID,
    ).run();
  return { terms: await db.prepare("SELECT * FROM merchant_contract_commercial_terms WHERE id=? AND merchant_id=?").bind(id, merchantId).first(), created: true };
}
