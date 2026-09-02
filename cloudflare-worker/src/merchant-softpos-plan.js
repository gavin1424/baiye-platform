import { ContractError, hashCanonical } from "./contract-engine.js";

export const SOFTPOS_PLAN_ID = "baiye_softpos_24000";
export const SOFTPOS_CONTRACT_VERSION_ID = "merchant_softpos_v1_0_24000";
export const SOFTPOS_CONTRACT_VERSION = "merchant_softpos_v1_0_24000";
export const SOFTPOS_FORMAL_NAME = "創百業智慧鏈｜免 POS 機智慧點餐系統";
export const INSTALLMENT_DISCLOSURE = "24 期零利率須依合作金融／支付機構核准與實際可用方案為準。";

const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;

function taipeiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addMonths(isoDate, months, minusOneDay = false) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const targetMonth = month - 1 + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const target = new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay)));
  if (minusOneDay) target.setUTCDate(target.getUTCDate() - 1);
  return target.toISOString().slice(0, 10);
}

export function softposCommercialTermsSnapshot(now = new Date()) {
  const trialStart = taipeiDate(now);
  const formalStart = addMonths(trialStart, 3);
  return {
    plan_code: SOFTPOS_PLAN_ID,
    plan_name: SOFTPOS_FORMAL_NAME,
    list_price_minor: 2400000,
    discount_price_minor: 1800000,
    currency: "TWD",
    contract_term_months: 24,
    payment_plan: "upfront_18000",
    upfront_amount_minor: 1800000,
    offset_target_amount_minor: 0,
    tax_reserve_enabled: 0,
    withholding_enabled: 0,
    included_services: [
      "QR Ordering（沿用現有 Ordering Core）",
      "Booking / Ordering Core、KDS、Browser Print 與 Order State Machine",
      "現有可用之庫存、Merchant Admin 與會員功能",
      "LINE Optional，依第三方實際啟用能力為準",
    ],
    excluded_services: [
      "專用 POS 主機（本方案不強制購買）",
      "商家實際營運所需的手機、平板、電腦、網路、顯示或列印設備",
      "未經 Provider 確認支援之 24 期實際交易",
    ],
    attachments: {
      acceptance: "依現有正式 Core 實際開放功能與商家帳號權限驗收。",
      third_party: INSTALLMENT_DISCLOSURE,
      trial_start: trialStart,
      trial_months: 3,
      activation_fee_minor: 300000,
      deposit_minor: 600000,
      cycle_fee_minor: 2400000,
      first_cycle_credit_minor: 600000,
      first_cycle_balance_minor: 1800000,
    },
    start_date: formalStart,
    service_period_end: addMonths(formalStart, 24, true),
    renewal_terms: "後續每 24 個月建立新週期，標準續約費 NT$24,000；不再收取保證金，不修改前期 Evidence。",
    custom_quote_reference: null,
  };
}

export function isSoftposCommercialTerms(terms) {
  return terms?.plan_code === SOFTPOS_PLAN_ID
    && Number(terms?.list_price_minor) === 2400000
    && Number(terms?.discount_price_minor) === 1800000
    && Number(terms?.contract_term_months) === 24
    && Number(terms?.upfront_amount_minor) === 1800000
    && Number(terms?.offset_target_amount_minor) === 0
    && terms?.currency === "TWD"
    && terms?.service_plan_version_id === SOFTPOS_PLAN_ID;
}

export async function ensureSoftposCommercialTerms(db, merchantId, now = new Date()) {
  const current = await db.prepare("SELECT * FROM merchant_contract_commercial_terms WHERE merchant_id=? AND plan_code=? AND status='approved' ORDER BY approved_at DESC,created_at DESC LIMIT 1")
    .bind(merchantId, SOFTPOS_PLAN_ID).first();
  if (current) return { terms: current, created: false };
  const snapshot = softposCommercialTermsSnapshot(now);
  const termsHash = await hashCanonical(snapshot);
  const id = uid("mcterms_softpos");
  await db.prepare(`INSERT INTO merchant_contract_commercial_terms(
      id,merchant_id,plan_code,plan_name,list_price_minor,discount_price_minor,currency,
      contract_term_months,payment_plan,upfront_amount_minor,offset_target_amount_minor,
      tax_reserve_enabled,withholding_enabled,included_services_json,excluded_services_json,
      attachments_json,start_date,service_period_end,renewal_terms,custom_quote_reference,
      status,created_by,approved_by,approved_at,terms_hash,source_preset_id,service_plan_version_id
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'approved','platform_softpos_terms','platform_softpos_terms',CURRENT_TIMESTAMP,?,?,?)`)
    .bind(id, merchantId, snapshot.plan_code, snapshot.plan_name, snapshot.list_price_minor,
      snapshot.discount_price_minor, snapshot.currency, snapshot.contract_term_months,
      snapshot.payment_plan, snapshot.upfront_amount_minor, snapshot.offset_target_amount_minor,
      snapshot.tax_reserve_enabled, snapshot.withholding_enabled,
      JSON.stringify(snapshot.included_services), JSON.stringify(snapshot.excluded_services),
      JSON.stringify(snapshot.attachments), snapshot.start_date, snapshot.service_period_end,
      snapshot.renewal_terms, snapshot.custom_quote_reference, termsHash, SOFTPOS_PLAN_ID, SOFTPOS_PLAN_ID).run();
  return { terms: await db.prepare("SELECT * FROM merchant_contract_commercial_terms WHERE id=?").bind(id).first(), created: true };
}

export async function softposPlanSummary(db) {
  const plan = await db.prepare("SELECT * FROM merchant_service_plan_versions WHERE plan_id=?").bind(SOFTPOS_PLAN_ID).first();
  if (!plan) throw new ContractError("SOFTPOS_PLAN_MISSING", "SoftPOS 方案設定不完整。", 500);
  const capability = await db.prepare("SELECT provider_code,installment_count,zero_interest_enabled,production_verified FROM merchant_contract_payment_provider_capabilities WHERE plan_id=? AND zero_interest_enabled=1 AND production_verified=1 LIMIT 1")
    .bind(SOFTPOS_PLAN_ID).first();
  return {
    plan_id: plan.plan_id,
    contract_version: plan.contract_version,
    formal_name: plan.formal_name,
    public_hardware_claim: plan.public_hardware_claim,
    activation_fee: Number(plan.activation_fee),
    deposit: Number(plan.deposit),
    trial_months: Number(plan.trial_months),
    cycle_months: Number(plan.cycle_months),
    cycle_fee: Number(plan.cycle_fee),
    first_cycle_credit: Number(plan.first_cycle_credit),
    first_cycle_balance: Number(plan.first_cycle_balance),
    renewal_fee: Number(plan.cycle_fee),
    legal_status: plan.legal_status,
    payment_terms: { installment_count: 24, interest_rate_bps: 0 },
    payment_provider: {
      ready: Boolean(capability),
      provider_code: capability?.provider_code || null,
      disclosure: INSTALLMENT_DISCLOSURE,
      transaction_created: false,
    },
  };
}

const money = (minor) => `NT$${Math.trunc(Number(minor || 0) / 100).toLocaleString("en-US")}`;

export function softposAttachmentA(terms, plan) {
  return [{
    title: "附件 A｜SoftPOS 商業條件與付款排程",
    contentHtml: `<h2>附件 A｜商業條件</h2><p>方案：${plan.formal_name}</p><p>開通費：${money(plan.activation_fee)}（獨立收取，不抵服務費）</p><p>履約／服務保證金：${money(plan.deposit)}（僅首次收取）</p><p>前 ${plan.trial_months} 個月系統服務費：NT$0；Trial 期間不建立服務費應收。</p><p>正式計價：${money(plan.cycle_fee)}／${plan.cycle_months} 個月（平均等值 NT$1,000／月，非逐月短約）</p><p>第一週期：${money(plan.cycle_fee)} - 保證金抵充 ${money(plan.first_cycle_credit)} = 尚應支付 ${money(plan.first_cycle_balance)}</p><p>後續週期：${money(plan.renewal_fee)}／${plan.cycle_months} 個月，不再收取保證金。</p><p>${INSTALLMENT_DISCLOSURE}</p><p>實際 Provider 就緒：${plan.payment_provider.ready ? "是" : "否；不會產生假交易"}</p><p>正式服務期間：${terms.start_date} 至 ${terms.service_period_end}</p>`,
  }];
}

export function softposTrialStatement(db, { merchantId, signatureId, signedAt }) {
  const trialStart = taipeiDate(new Date(signedAt));
  const trialEnd = addMonths(trialStart, 3, true);
  return db.prepare(`INSERT INTO merchant_service_subscriptions(
      id,merchant_id,plan_id,initial_contract_signature_id,renewal_state,trial_started_at,
      trial_ends_at,activation_fee_minor,deposit_minor,deposit_collected_once,current_cycle_number
    ) VALUES(?,?,? ,?,'TRIAL',?,?,300000,600000,0,0)`)
    .bind(uid("softpos_subscription"), merchantId, SOFTPOS_PLAN_ID, signatureId, trialStart, trialEnd);
}

function daysBetween(from, to) {
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function deriveRenewalState(subscription, cycle, today = taipeiDate()) {
  if (!cycle) {
    const remaining = daysBetween(today, subscription.trial_ends_at);
    if (remaining < 0) return subscription.renewal_state === "EXPIRED" ? "EXPIRED" : "RENEWAL_REQUIRED";
    return remaining <= 30 ? "TRIAL_ENDING" : "TRIAL";
  }
  if (cycle.status === "PAYMENT_REQUIRED") return "RENEWAL_REQUIRED";
  if (cycle.status === "DECLINED" || cycle.status === "EXPIRED") return "EXPIRED";
  const remaining = daysBetween(today, cycle.service_period_end);
  if (remaining < 0) return "EXPIRED";
  if (remaining <= 30 || cycle.status === "EXPIRING") return "EXPIRING";
  return "ACTIVE";
}

export async function getSoftposRenewal(db, merchantId, now = new Date()) {
  const subscription = await db.prepare("SELECT * FROM merchant_service_subscriptions WHERE merchant_id=? AND plan_id=?").bind(merchantId, SOFTPOS_PLAN_ID).first();
  if (!subscription) return null;
  const cycle = await db.prepare("SELECT * FROM merchant_service_cycles WHERE subscription_id=? ORDER BY cycle_number DESC LIMIT 1").bind(subscription.id).first();
  const state = deriveRenewalState(subscription, cycle, taipeiDate(now));
  if (state !== subscription.renewal_state) await db.prepare("UPDATE merchant_service_subscriptions SET renewal_state=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(state, subscription.id).run();
  return { subscription: { ...subscription, renewal_state: state }, cycle, prompt: state === "RENEWAL_REQUIRED" ? "是否續用免 POS 機智慧點餐系統" : null };
}

export async function prepareSoftposRenewal(db, merchantId, now = new Date()) {
  const current = await getSoftposRenewal(db, merchantId, now);
  if (!current) throw new ContractError("SOFTPOS_SUBSCRIPTION_MISSING", "找不到 SoftPOS 試用與續約狀態。", 404);
  if (!["RENEWAL_REQUIRED", "EXPIRED"].includes(current.subscription.renewal_state)) throw new ContractError("SOFTPOS_RENEWAL_NOT_DUE", "目前尚未進入續用確認階段。", 409);
  if (current.cycle?.status === "PAYMENT_REQUIRED") return current.cycle;
  const cycleNumber = Number(current.subscription.current_cycle_number) + 1;
  const credit = cycleNumber === 1 ? 600000 : 0;
  const balance = cycleNumber === 1 ? 1800000 : 2400000;
  const id = uid("softpos_cycle");
  await db.prepare(`INSERT INTO merchant_service_cycles(
      id,subscription_id,cycle_number,cycle_months,cycle_fee_minor,deposit_credit_minor,
      balance_due_minor,deposit_charge_minor,status
    ) VALUES(?,?,?,24,2400000,?,?,0,'PAYMENT_REQUIRED')`)
    .bind(id, current.subscription.id, cycleNumber, credit, balance).run();
  return db.prepare("SELECT * FROM merchant_service_cycles WHERE id=?").bind(id).first();
}

export async function declineSoftposRenewal(db, merchantId, now = new Date()) {
  const current = await getSoftposRenewal(db, merchantId, now);
  if (!current) throw new ContractError("SOFTPOS_SUBSCRIPTION_MISSING", "找不到 SoftPOS 試用與續約狀態。", 404);
  if (!["RENEWAL_REQUIRED", "EXPIRED"].includes(current.subscription.renewal_state)) throw new ContractError("SOFTPOS_RENEWAL_NOT_DUE", "目前尚未進入續用確認階段。", 409);
  const statements = [
    db.prepare("UPDATE merchant_service_subscriptions SET renewal_state='EXPIRED',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(current.subscription.id),
    db.prepare("UPDATE merchant_onboarding_states SET state='closed',operation_locked=1,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=?").bind(merchantId),
  ];
  if (current.cycle?.status === "PAYMENT_REQUIRED") statements.push(db.prepare("UPDATE merchant_service_cycles SET status='DECLINED' WHERE id=? AND renewal_contract_signature_id IS NULL").bind(current.cycle.id));
  await db.batch(statements);
  return { renewal_state: "EXPIRED", operation_locked: true, data_retention: "已簽契約、付款記錄、PDF、Evidence、Hash 及 Audit 依契約與法令保留。" };
}
