export const ADVISOR_COMMERCIAL_POLICY_VERSION = "advisor_commercial_policy_v1_0";
export const ADVISOR_COMMISSION_POLICY_VERSION = "advisor_commission_policy_v1_0";
export const ADVISOR_REFUND_POLICY_VERSION = "advisor_cancellation_policy_v1_0";
export const ADVISOR_SETTLEMENT_POLICY_VERSION = "advisor_settlement_policy_v1_0";
export const ADVISOR_COMMISSION_MODE = "progressive_nonretroactive";
export const ADVISOR_PROVIDER_FEE_POLICY = "before_split";
export const ADVISOR_ROUNDING_POLICY = "platform_remainder";
export const ADVISOR_TIERS = Object.freeze([
  { min: 1, max: 30, advisorRateBp: 5000 },
  { min: 31, max: 60, advisorRateBp: 5200 },
  { min: 61, max: 99, advisorRateBp: 5300 },
  { min: 100, max: 199, advisorRateBp: 5500 },
  { min: 200, max: Infinity, advisorRateBp: 6000 },
]);

export function advisorTierForCount(count) {
  const value = Number(count);
  if (!Number.isInteger(value) || value < 1) throw new TypeError("Completed service count must be a positive integer");
  return ADVISOR_TIERS.find((tier) => value >= tier.min && value <= tier.max);
}

export function advisorCommissionSnapshot({ servicePriceMinor, providerFeeMinor = 0, monthlyCompletedCount, providerFeePolicy = ADVISOR_PROVIDER_FEE_POLICY, providerFeeActualMinor = null, providerFeeEstimatedMinor = null, providerFeeSource = "none" }) {
  if (![servicePriceMinor, providerFeeMinor, monthlyCompletedCount].every(Number.isInteger) || servicePriceMinor < 0 || providerFeeMinor < 0) throw new TypeError("Amounts and count must be integer minor units");
  if (!['platform_absorbs','advisor_absorbs','before_split','pro_rata','custom'].includes(providerFeePolicy)) throw new TypeError("Provider fee policy required");
  const tier = advisorTierForCount(monthlyCompletedCount);
  const splitBase = providerFeePolicy === "before_split" ? Math.max(0, servicePriceMinor - providerFeeMinor) : servicePriceMinor;
  let advisorShareMinor = Math.floor(splitBase * tier.advisorRateBp / 10000);
  let platformShareMinor = splitBase - advisorShareMinor;
  if (providerFeePolicy === "advisor_absorbs") advisorShareMinor = Math.max(0, advisorShareMinor - providerFeeMinor);
  if (providerFeePolicy === "platform_absorbs") platformShareMinor -= providerFeeMinor;
  if (providerFeePolicy === "pro_rata") {
    const advisorFee = Math.floor(providerFeeMinor * tier.advisorRateBp / 10000);
    advisorShareMinor = Math.max(0, advisorShareMinor - advisorFee);
    platformShareMinor -= providerFeeMinor - advisorFee;
  }
  return {
    servicePriceMinor, grossAmountMinor: servicePriceMinor, providerFeeMinor,
    providerFeeActualMinor, providerFeeEstimatedMinor, providerFeeSource,
    providerFeePolicyVersion: ADVISOR_COMMERCIAL_POLICY_VERSION,
    commissionBaseMinor: splitBase, tierAtCompletion: `${tier.min}-${tier.max === Infinity ? "plus" : tier.max}`,
    advisorRateBp: tier.advisorRateBp,
    platformRateBp: 10000 - tier.advisorRateBp, monthlyCompletedCountAtSnapshot: monthlyCompletedCount,
    advisorShareMinor, platformShareMinor, commissionPolicyVersion: ADVISOR_COMMISSION_POLICY_VERSION,
    commissionApplicationMode: ADVISOR_COMMISSION_MODE,
    refundPolicyVersion: ADVISOR_REFUND_POLICY_VERSION, roundingPolicy: ADVISOR_ROUNDING_POLICY,
  };
}

export function advisorRefundReversalSnapshot(original, refundAmountMinor) {
  const gross = Number(original.grossAmountMinor ?? original.servicePriceMinor);
  if (!Number.isInteger(gross) || gross <= 0 || !Number.isInteger(refundAmountMinor) || refundAmountMinor <= 0 || refundAmountMinor > gross) throw new TypeError("Refund amount must be a positive integer no greater than gross");
  const base = Number(original.commissionBaseMinor ?? gross);
  const reversalBaseMinor = Math.floor(base * refundAmountMinor / gross);
  const advisorReversalMinor = Math.floor(reversalBaseMinor * Number(original.advisorRateBp) / 10000);
  return {
    refundAmountMinor,
    reversalBaseMinor,
    advisorReversalMinor,
    platformReversalMinor: reversalBaseMinor - advisorReversalMinor,
    roundingPolicy: original.roundingPolicy || ADVISOR_ROUNDING_POLICY,
    policyVersion: original.refundPolicyVersion || ADVISOR_REFUND_POLICY_VERSION,
  };
}

export function advisorSettlementStageForDay(day) {
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new TypeError("Calendar day required");
  if (day === 1) return "draft_created";
  if (day <= 5) return "reconciliation_buffer";
  if (day < 10) return "review";
  if (day < 15) return "lock_target";
  return "payout_target";
}

export function advisorStarLevel(completed) {
  const count = Number(completed || 0);
  if (count >= 1000) return { code: "principal", level: "principal", label: "首席顧問", note: "平台服務等級" };
  if (count >= 500) return { code: "platinum", level: "platinum", label: "白金顧問", note: "平台服務等級" };
  if (count >= 200) return { code: "gold", level: "gold", label: "金牌顧問", note: "平台服務等級" };
  return { code: "standard", level: "standard", label: "生活顧問", note: "平台服務等級" };
}

const BLOCK_PATTERNS = [
  /治[癒療].*(癌|疾病|憂鬱|焦慮)/i, /不用(吃|服)藥|停藥/i,
  /100\s*%.*(投資|獲利|準確)|投資.*100\s*%|保證.*(獲利|賺錢)/i,
  /(災禍|死亡).*(加購|付款|付費)/i,
];
const REVIEW_PATTERNS = [/保證(復合|結婚|離婚|感情結果)/i, /一定會(離婚|破財|復合)/i, /最準|最靈|百分之百準確/i];

export function moderateAdvisorContent(value) {
  const text = String(value || "").trim();
  if (BLOCK_PATTERNS.some((pattern) => pattern.test(text))) return { status: "blocked", severity: "blocked", code: "PROHIBITED_GUARANTEE_OR_MEDICAL_CLAIM" };
  if (REVIEW_PATTERNS.some((pattern) => pattern.test(text))) return { status: "review_required", severity: "review", code: "HIGH_RISK_OUTCOME_CLAIM" };
  return { status: "pending_review", severity: null, code: null };
}

export const ADVISOR_BOOKING_TRANSITIONS = Object.freeze({
  DRAFT: ["SLOT_HELD", "CANCELLED"], SLOT_HELD: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["IN_SERVICE", "CANCELLED", "DISPUTED"],
  IN_SERVICE: ["COMPLETED", "DISPUTED"], COMPLETED: ["REFUND_PENDING", "DISPUTED"],
  REFUND_PENDING: ["REFUNDED", "DISPUTED"], DISPUTED: ["REFUND_PENDING", "COMPLETED"],
  CANCELLED: [], REFUNDED: [],
});

export function assertAdvisorBookingTransition(from, to) {
  if (!ADVISOR_BOOKING_TRANSITIONS[from]?.includes(to)) throw Object.assign(new Error("Invalid advisor booking transition"), { code: "INVALID_BOOKING_TRANSITION", status: 409 });
  return true;
}

export function advisorPaymentReadiness(env = {}) {
  const realPayment = String(env.REAL_ADVISOR_PAYMENT_ENABLED || "false") === "true";
  const realPayout = String(env.REAL_ADVISOR_PAYOUT_ENABLED || "false") === "true";
  const approvals = [env.ADVISOR_PROVIDER_CREDENTIALS_READY, env.ADVISOR_LEGAL_REVIEW_APPROVED, env.ADVISOR_FINANCE_POLICY_APPROVED, env.ADVISOR_REFUND_POLICY_APPROVED].every((value) => String(value) === "true");
  return {
    paymentProvider: env.APP_MODE === "staging" ? "TEST_PROVIDER" : "PAYMENT_PROVIDER_DISABLED",
    realPaymentEnabled: realPayment && approvals,
    realPayoutEnabled: realPayout && approvals,
    payoutBlockReason: realPayout && approvals ? null : "PAYOUT_BLOCKED_POLICY_REQUIRED",
  };
}

const MATCH_RULES = [
  { slug: "career", terms: ["工作", "職涯", "換工作", "事業", "主管", "職場"] },
  { slug: "relationship-life", terms: ["感情", "關係", "人生", "復合", "方向"] },
  { slug: "dream", terms: ["夢", "夢境", "解夢"] },
  { slug: "tarot", terms: ["塔羅", "牌卡"] },
  { slug: "meditation", terms: ["冥想", "壓力", "放鬆", "覺察"] },
  { slug: "ziwei", terms: ["紫微", "命盤"] },
  { slug: "bazi", terms: ["八字", "命理"] },
];

export function classifyAdvisorNeed(input) {
  const text = String(input || "").slice(0, 1000);
  const matched = MATCH_RULES.find((rule) => rule.terms.some((term) => text.includes(term)));
  return matched?.slug || "relationship-life";
}

export function advisorMatchCopy(categoryName) {
  return `如果您希望從人生規劃與自我探索角度整理目前的方向，可以看看「${categoryName}」類型的顧問。推薦僅供比較，不代表保證結果。`;
}
