export const SETTLEMENT_CALCULATION_VERSION = "settlement-v1";
export const DEFAULT_OFFSET_TARGET_MINOR = 1_800_000;
const BP_DENOMINATOR = 10_000n;

export function integer(value, { min = 0, max = Number.MAX_SAFE_INTEGER, signed = false } = {}) {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (!Number.isSafeInteger(parsed)) return null;
  if (!signed && parsed < min) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

export function decimalMajorToMinor(value) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const result = BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
  return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : null;
}

export function roundByBasisPoints(amountMinor, rateBp) {
  const amount = integer(amountMinor);
  const rate = integer(rateBp, { max: 10_000 });
  if (amount === null || rate === null) throw new TypeError("Invalid integer amount or basis points");
  const result = (BigInt(amount) * BigInt(rate) + BP_DENOMINATOR / 2n) / BP_DENOMINATOR;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Amount exceeds safe integer range");
  return Number(result);
}

export function normalizeSettlementProfile(input = {}) {
  const plan = input.payment_plan;
  if (!['upfront_18000', 'sales_offset_18000'].includes(plan)) throw new TypeError("Invalid payment plan");
  const profile = {
    enabled: input.enabled === true || Number(input.enabled) === 1,
    payment_plan: plan,
    deposit_rate_bp: integer(input.deposit_rate_bp ?? 3000, { max: 10_000 }),
    platform_fee_rate_bp: integer(input.platform_fee_rate_bp ?? 200, { max: 10_000 }),
    processing_fee_mode: input.processing_fee_mode ?? "actual_or_estimated",
    processing_fee_basis: input.processing_fee_basis ?? "deposit_collected",
    estimated_processing_fee_rate_bp: integer(input.estimated_processing_fee_rate_bp ?? 0, { max: 10_000 }),
    tax_reserve_mode: input.tax_reserve_mode ?? "disabled",
    tax_reserve_rate_bp: integer(input.tax_reserve_rate_bp ?? 0, { max: 10_000 }),
    withholding_mode: input.withholding_mode ?? "disabled",
    withholding_rate_bp: integer(input.withholding_rate_bp ?? 0, { max: 10_000 }),
    withholding_income_type: input.withholding_income_type ? String(input.withholding_income_type).slice(0, 100) : null,
    offset_target_amount_minor: integer(input.offset_target_amount_minor ?? DEFAULT_OFFSET_TARGET_MINOR),
    continue_platform_fee_after_offset: input.continue_platform_fee_after_offset === true || Number(input.continue_platform_fee_after_offset) === 1,
    settlement_day: integer(input.settlement_day ?? 10, { min: 1, max: 28 }),
    legal_review_status: input.legal_review_status ?? "pending",
    accounting_review_status: input.accounting_review_status ?? "pending",
    effective_from: input.effective_from || null,
    effective_to: input.effective_to || null,
    calculation_version: SETTLEMENT_CALCULATION_VERSION,
  };
  if ([profile.deposit_rate_bp, profile.platform_fee_rate_bp, profile.estimated_processing_fee_rate_bp, profile.tax_reserve_rate_bp, profile.withholding_rate_bp, profile.offset_target_amount_minor, profile.settlement_day].includes(null)) throw new TypeError("Invalid profile integer");
  if (!['actual_only','estimated','actual_or_estimated'].includes(profile.processing_fee_mode)) throw new TypeError("Invalid processing fee mode");
  if (!['deposit_collected','order_total'].includes(profile.processing_fee_basis)) throw new TypeError("Invalid processing fee basis");
  if (!['disabled','manual','percentage'].includes(profile.tax_reserve_mode) || !['disabled','manual','percentage'].includes(profile.withholding_mode)) throw new TypeError("Invalid tax mode");
  if (!['pending','approved','rejected'].includes(profile.legal_review_status) || !['pending','approved','rejected'].includes(profile.accounting_review_status)) throw new TypeError("Invalid review status");
  if (profile.effective_from && profile.effective_to && profile.effective_to < profile.effective_from) throw new TypeError("Invalid effective period");
  return profile;
}

export function calculateSettlement(input) {
  const profile = normalizeSettlementProfile(input.profile);
  if (!profile.enabled) throw new TypeError("Settlement service is not enabled");
  const orderTotal = integer(input.total_order_amount_minor);
  const priorOffset = integer(input.prior_offset_amount_minor ?? 0);
  const adjustments = integer(input.adjustments_minor ?? 0, { min: Number.MIN_SAFE_INTEGER, signed: true });
  const actualFee = input.actual_processing_fee_minor == null ? null : integer(input.actual_processing_fee_minor);
  const manualTax = input.manual_tax_reserve_minor == null ? 0 : integer(input.manual_tax_reserve_minor);
  const manualWithholding = input.manual_withholding_minor == null ? 0 : integer(input.manual_withholding_minor);
  if ([orderTotal, priorOffset, adjustments, manualTax, manualWithholding].includes(null) || actualFee === null && input.actual_processing_fee_minor != null) throw new TypeError("Invalid settlement amount");

  const deposit = roundByBasisPoints(orderTotal, profile.deposit_rate_bp);
  const processingBasis = profile.processing_fee_basis === "order_total" ? orderTotal : deposit;
  const estimatedFee = roundByBasisPoints(processingBasis, profile.estimated_processing_fee_rate_bp);
  let processingFee = estimatedFee, processingFeeSource = "estimated";
  if (profile.processing_fee_mode === "actual_only") {
    if (actualFee === null) throw new TypeError("Actual processing fee is required");
    processingFee = actualFee; processingFeeSource = "actual";
  } else if (profile.processing_fee_mode === "actual_or_estimated" && actualFee !== null) {
    processingFee = actualFee; processingFeeSource = "actual";
  }

  const rawPlatformFee = roundByBasisPoints(orderTotal, profile.platform_fee_rate_bp);
  const taxReserve = profile.tax_reserve_mode === "disabled" ? 0 : profile.tax_reserve_mode === "manual" ? manualTax : roundByBasisPoints(orderTotal, profile.tax_reserve_rate_bp);
  const withholding = profile.withholding_mode === "disabled" ? 0 : profile.withholding_mode === "manual" ? manualWithholding : roundByBasisPoints(orderTotal, profile.withholding_rate_bp);

  let currentOffset = 0, cumulativeOffset = 0, remainingOffset = 0, ongoingFee = rawPlatformFee, chargedPlatformFee = rawPlatformFee;
  if (profile.payment_plan === "sales_offset_18000") {
    const eligiblePrior = Math.min(priorOffset, profile.offset_target_amount_minor);
    const remainingBefore = Math.max(0, profile.offset_target_amount_minor - eligiblePrior);
    currentOffset = Math.min(rawPlatformFee, remainingBefore);
    cumulativeOffset = eligiblePrior + currentOffset;
    remainingOffset = Math.max(0, profile.offset_target_amount_minor - cumulativeOffset);
    ongoingFee = profile.continue_platform_fee_after_offset ? Math.max(0, rawPlatformFee - currentOffset) : 0;
    chargedPlatformFee = currentOffset + ongoingFee;
  }
  if (profile.payment_plan === "upfront_18000") {
    currentOffset = 0; cumulativeOffset = 0; remainingOffset = 0;
  }

  const payable = deposit - processingFee - chargedPlatformFee - taxReserve - withholding + adjustments;
  if (!Number.isSafeInteger(payable) || payable < 0) throw new RangeError("Merchant payable cannot be negative");
  return {
    total_order_amount_minor: orderTotal,
    deposit_collected_minor: deposit,
    processing_fee_minor: processingFee,
    processing_fee_source: processingFeeSource,
    platform_service_fee_minor: chargedPlatformFee,
    raw_platform_service_fee_minor: rawPlatformFee,
    tax_reserve_minor: taxReserve,
    withholding_minor: withholding,
    adjustments_minor: adjustments,
    merchant_payable_minor: payable,
    prior_offset_amount_minor: profile.payment_plan === "sales_offset_18000" ? Math.min(priorOffset, profile.offset_target_amount_minor) : 0,
    current_offset_amount_minor: currentOffset,
    cumulative_offset_amount_minor: cumulativeOffset,
    remaining_offset_amount_minor: remainingOffset,
    ongoing_platform_fee_minor: ongoingFee,
    calculation_version: SETTLEMENT_CALCULATION_VERSION,
    rules_snapshot: profile,
  };
}

export function settlementSnapshot(result) {
  return JSON.stringify({ calculation_version: result.calculation_version, profile: result.rules_snapshot, processing_fee_source: result.processing_fee_source });
}
