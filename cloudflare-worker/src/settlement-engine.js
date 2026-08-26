export const SETTLEMENT_CALCULATION_VERSION = "settlement-v3";
export const DEFAULT_OFFSET_TARGET_MINOR = 1_800_000;
const BP_DENOMINATOR = 10_000n;
const POLICY_VALUES = ["pro_rata_reverse", "no_reverse", "manual_review"];

export function integer(
  value,
  { min = 0, max = Number.MAX_SAFE_INTEGER, signed = false } = {},
) {
  const parsed =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;
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
  if (amount === null || rate === null)
    throw new TypeError("Invalid integer amount or basis points");
  const result =
    (BigInt(amount) * BigInt(rate) + BP_DENOMINATOR / 2n) / BP_DENOMINATOR;
  if (result > BigInt(Number.MAX_SAFE_INTEGER))
    throw new RangeError("Amount exceeds safe integer range");
  return Number(result);
}

export function normalizeSettlementProfile(input = {}) {
  const profile = {
    enabled: input.enabled === true || Number(input.enabled) === 1,
    payment_plan: input.payment_plan,
    deposit_rate_bp: integer(input.deposit_rate_bp ?? 3000, { max: 10_000 }),
    platform_fee_rate_bp: integer(input.platform_fee_rate_bp ?? 200, {
      max: 10_000,
    }),
    processing_fee_mode: input.processing_fee_mode ?? "actual_or_estimated",
    processing_fee_basis: input.processing_fee_basis ?? "deposit_collected",
    estimated_processing_fee_rate_bp: integer(
      input.estimated_processing_fee_rate_bp ?? 0,
      { max: 10_000 },
    ),
    tax_reserve_mode: input.tax_reserve_mode ?? "disabled",
    tax_reserve_rate_bp: integer(input.tax_reserve_rate_bp ?? 0, {
      max: 10_000,
    }),
    withholding_mode: input.withholding_mode ?? "disabled",
    withholding_rate_bp: integer(input.withholding_rate_bp ?? 0, {
      max: 10_000,
    }),
    withholding_income_type: input.withholding_income_type
      ? String(input.withholding_income_type).slice(0, 100)
      : null,
    refund_platform_fee_policy:
      input.refund_platform_fee_policy ?? "pro_rata_reverse",
    refund_offset_policy: input.refund_offset_policy ?? "pro_rata_reverse",
    provider_fee_refund_policy:
      input.provider_fee_refund_policy ?? "no_reverse",
    offset_target_amount_minor: integer(
      input.offset_target_amount_minor ?? DEFAULT_OFFSET_TARGET_MINOR,
    ),
    continue_platform_fee_after_offset:
      input.continue_platform_fee_after_offset === true ||
      Number(input.continue_platform_fee_after_offset) === 1,
    settlement_day: integer(input.settlement_day ?? 10, { min: 1, max: 28 }),
    legal_review_status: input.legal_review_status ?? "pending",
    accounting_review_status: input.accounting_review_status ?? "pending",
    effective_from: input.effective_from || null,
    effective_to: input.effective_to || null,
    calculation_version: SETTLEMENT_CALCULATION_VERSION,
  };
  if (!["upfront_18000", "sales_offset_18000"].includes(profile.payment_plan))
    throw new TypeError("Invalid payment plan");
  if (
    [
      profile.deposit_rate_bp,
      profile.platform_fee_rate_bp,
      profile.estimated_processing_fee_rate_bp,
      profile.tax_reserve_rate_bp,
      profile.withholding_rate_bp,
      profile.offset_target_amount_minor,
      profile.settlement_day,
    ].includes(null)
  )
    throw new TypeError("Invalid profile integer");
  if (
    !["actual_only", "estimated", "actual_or_estimated"].includes(
      profile.processing_fee_mode,
    )
  )
    throw new TypeError("Invalid processing fee mode");
  if (
    !["deposit_collected", "order_total"].includes(profile.processing_fee_basis)
  )
    throw new TypeError("Invalid processing fee basis");
  if (
    !["disabled", "manual", "percentage"].includes(profile.tax_reserve_mode) ||
    !["disabled", "manual", "percentage"].includes(profile.withholding_mode)
  )
    throw new TypeError("Invalid tax mode");
  for (const value of [
    profile.refund_platform_fee_policy,
    profile.refund_offset_policy,
    profile.provider_fee_refund_policy,
  ])
    if (!POLICY_VALUES.includes(value))
      throw new TypeError("Invalid refund policy");
  if (
    !["pending", "approved", "rejected"].includes(
      profile.legal_review_status,
    ) ||
    !["pending", "approved", "rejected"].includes(
      profile.accounting_review_status,
    )
  )
    throw new TypeError("Invalid review status");
  if (
    profile.effective_from &&
    profile.effective_to &&
    profile.effective_to < profile.effective_from
  )
    throw new TypeError("Invalid effective period");
  return profile;
}

function normalizedSources(input, profile) {
  if (Array.isArray(input.sources)) {
    return input.sources.map((source) => {
      const orderTotal = integer(source.order_total_amount_minor);
      const actual = integer(source.actual_collected_amount_minor);
      const expected =
        source.expected_deposit_amount_minor == null
          ? roundByBasisPoints(orderTotal, profile.deposit_rate_bp)
          : integer(source.expected_deposit_amount_minor);
      const actualFee =
        source.provider_fee_actual_minor == null
          ? null
          : integer(source.provider_fee_actual_minor);
      if (
        [orderTotal, actual, expected].includes(null) ||
        (source.provider_fee_actual_minor != null && actualFee === null)
      )
        throw new TypeError("Invalid settlement source");
      return {
        ...source,
        order_total_amount_minor: orderTotal,
        expected_deposit_amount_minor: expected,
        actual_collected_amount_minor: actual,
        provider_fee_actual_minor: actualFee,
      };
    });
  }
  const orderTotal = integer(input.total_order_amount_minor);
  if (orderTotal === null) throw new TypeError("Invalid settlement amount");
  const expected = roundByBasisPoints(orderTotal, profile.deposit_rate_bp);
  const actual =
    input.actual_deposit_collected_minor == null
      ? expected
      : integer(input.actual_deposit_collected_minor);
  if (actual === null) throw new TypeError("Invalid settlement amount");
  return [
    {
      order_total_amount_minor: orderTotal,
      expected_deposit_amount_minor: expected,
      actual_collected_amount_minor: actual,
      provider_fee_actual_minor:
        input.actual_processing_fee_minor == null
          ? null
          : integer(input.actual_processing_fee_minor),
    },
  ];
}

export function calculateProcessingFees(sources, profile) {
  let actualTotal = 0;
  let estimatedTotal = 0;
  let missingCount = 0;
  const items = sources.map((source) => {
    const basis =
      profile.processing_fee_basis === "order_total"
        ? source.order_total_amount_minor
        : source.actual_collected_amount_minor;
    if (
      profile.processing_fee_mode !== "estimated" &&
      source.provider_fee_actual_minor != null
    ) {
      actualTotal += source.provider_fee_actual_minor;
      return {
        processing_fee_minor: source.provider_fee_actual_minor,
        processing_fee_source: "actual",
      };
    }
    if (profile.processing_fee_mode === "actual_only") {
      missingCount += 1;
      return { processing_fee_minor: 0, processing_fee_source: "unavailable" };
    }
    const estimated = roundByBasisPoints(
      basis,
      profile.estimated_processing_fee_rate_bp,
    );
    estimatedTotal += estimated;
    return {
      processing_fee_minor: estimated,
      processing_fee_source: "estimated",
    };
  });
  return {
    items,
    actual_fee_total_minor: actualTotal,
    estimated_fee_total_minor: estimatedTotal,
    missing_actual_fee_count: missingCount,
    processing_fee_minor: actualTotal + estimatedTotal,
  };
}

export function calculateRefundReversal({
  depositMinor,
  platformFeeMinor,
  currentOffsetMinor,
  providerFeeMinor = 0,
  refundMinor,
  providerFeeRefundMinor = null,
  providerFeeRefundReviewed = false,
  profile,
}) {
  const refunded = Math.min(
    integer(refundMinor) ?? 0,
    integer(depositMinor) ?? 0,
  );
  const ratioBp =
    depositMinor > 0
      ? Number(
          (BigInt(refunded) * 10_000n + BigInt(depositMinor) / 2n) /
            BigInt(depositMinor),
        )
      : 0;
  const policyAmount = (policy, amount) =>
    policy === "pro_rata_reverse" ? roundByBasisPoints(amount, ratioBp) : 0;
  const negative = (value) => (value === 0 ? 0 : -value);
  const providerPolicy = profile.provider_fee_refund_policy;
  const providerProRata = policyAmount("pro_rata_reverse", providerFeeMinor);
  const providerFeeReversal =
    providerPolicy === "pro_rata_reverse" && providerFeeRefundReviewed
      ? Math.min(
          providerProRata,
          integer(providerFeeRefundMinor ?? providerProRata) ?? 0,
        )
      : 0;
  return {
    deposit_reversal_minor: -refunded,
    platform_fee_reversal_minor: negative(policyAmount(
      profile.refund_platform_fee_policy,
      platformFeeMinor,
    )),
    offset_reversal_minor: negative(policyAmount(
      profile.refund_offset_policy,
      currentOffsetMinor,
    )),
    provider_fee_retained_minor:
      providerPolicy === "no_reverse"
        ? providerFeeMinor
        : Math.max(0, providerProRata - providerFeeReversal),
    provider_fee_reversal_minor: providerFeeReversal,
    requires_manual_review: [
      profile.refund_platform_fee_policy,
      profile.refund_offset_policy,
      providerPolicy,
    ].includes("manual_review"),
    requires_provider_fee_review:
      providerPolicy === "pro_rata_reverse" && !providerFeeRefundReviewed,
  };
}

export function calculateSettlement(input) {
  const profile = normalizeSettlementProfile(input.profile);
  if (!profile.enabled)
    throw new TypeError("Settlement service is not enabled");
  const sources = normalizedSources(input, profile);
  const priorOffset = integer(input.prior_offset_amount_minor ?? 0);
  const adjustments = integer(input.adjustments_minor ?? 0, {
    min: Number.MIN_SAFE_INTEGER,
    signed: true,
  });
  const manualTax =
    input.manual_tax_reserve_minor == null
      ? 0
      : integer(input.manual_tax_reserve_minor);
  const manualWithholding =
    input.manual_withholding_minor == null
      ? 0
      : integer(input.manual_withholding_minor);
  const priorCarry = integer(input.prior_carry_forward_minor ?? 0, {
    min: Number.MIN_SAFE_INTEGER,
    signed: true,
  });
  if (
    [priorOffset, adjustments, manualTax, manualWithholding, priorCarry].includes(
      null,
    )
  )
    throw new TypeError("Invalid settlement amount");

  const uniqueOrders = new Map();
  for (const source of sources) {
    const orderKey = source.order_id || source.orderId || "single-order";
    if (uniqueOrders.has(orderKey))
      throw new TypeError(`同一訂單不可有多筆合格平台訂金：${orderKey}`);
    uniqueOrders.set(orderKey, source);
  }
  const orderSources = [...uniqueOrders.values()];
  const orderTotal = orderSources.reduce(
    (sum, source) => sum + source.order_total_amount_minor,
    0,
  );
  const expectedDeposit = orderSources.reduce(
    (sum, source) => sum + source.expected_deposit_amount_minor,
    0,
  );
  const actualDeposit = sources.reduce(
    (sum, source) => sum + source.actual_collected_amount_minor,
    0,
  );
  const variance = actualDeposit - expectedDeposit;
  const fees = calculateProcessingFees(sources, profile);
  if (
    profile.processing_fee_mode === "actual_only" &&
    fees.missing_actual_fee_count > 0 &&
    input.allow_missing_actual_fee !== true
  )
    throw new TypeError(
      "Actual processing fee is required for every eligible payment",
    );

  const rawPlatformFee = orderSources.reduce(
    (sum, source) =>
      sum +
      (source.platform_fee_amount_minor == null
        ? roundByBasisPoints(
            source.order_total_amount_minor,
            profile.platform_fee_rate_bp,
          )
        : integer(source.platform_fee_amount_minor)),
    0,
  );
  const offsetEligibleFee = orderSources.reduce(
    (sum, source) =>
      sum +
      (source.offset_fee_amount_minor == null
        ? roundByBasisPoints(
            source.order_total_amount_minor,
            profile.platform_fee_rate_bp,
          )
        : integer(source.offset_fee_amount_minor)),
    0,
  );
  if ([rawPlatformFee, offsetEligibleFee].includes(null))
    throw new TypeError("Invalid refund fee calculation");
  const taxReserve =
    profile.tax_reserve_mode === "disabled"
      ? 0
      : profile.tax_reserve_mode === "manual"
        ? manualTax
        : roundByBasisPoints(orderTotal, profile.tax_reserve_rate_bp);
  const withholding =
    profile.withholding_mode === "disabled"
      ? 0
      : profile.withholding_mode === "manual"
        ? manualWithholding
        : roundByBasisPoints(orderTotal, profile.withholding_rate_bp);

  let currentOffset = 0;
  let cumulativeOffset = 0;
  let remainingOffset = 0;
  let ongoingFee = rawPlatformFee;
  let chargedPlatformFee = rawPlatformFee;
  if (profile.payment_plan === "sales_offset_18000") {
    const eligiblePrior = Math.min(
      priorOffset,
      profile.offset_target_amount_minor,
    );
    const remainingBefore = Math.max(
      0,
      profile.offset_target_amount_minor - eligiblePrior,
    );
    currentOffset = Math.min(offsetEligibleFee, remainingBefore);
    cumulativeOffset = eligiblePrior + currentOffset;
    remainingOffset = Math.max(
      0,
      profile.offset_target_amount_minor - cumulativeOffset,
    );
    ongoingFee = profile.continue_platform_fee_after_offset
      ? Math.max(0, rawPlatformFee - currentOffset)
      : 0;
    chargedPlatformFee = currentOffset + ongoingFee;
  }
  if (profile.payment_plan === "upfront_18000") ongoingFee = rawPlatformFee;

  const net =
    actualDeposit -
    fees.processing_fee_minor -
    chargedPlatformFee -
    taxReserve -
    withholding +
    adjustments +
    priorCarry;
  if (!Number.isSafeInteger(net))
    throw new RangeError("Settlement net exceeds safe integer range");
  const payable = Math.max(0, net);
  const dueToPlatform = Math.max(0, -net);
  return {
    total_order_amount_minor: orderTotal,
    expected_deposit_amount_minor: expectedDeposit,
    actual_deposit_collected_minor: actualDeposit,
    deposit_collected_minor: actualDeposit,
    deposit_variance_minor: variance,
    processing_fee_minor: fees.processing_fee_minor,
    processing_fee_source:
      fees.actual_fee_total_minor > 0 && fees.estimated_fee_total_minor > 0
        ? "mixed"
        : fees.actual_fee_total_minor > 0
          ? "actual"
          : fees.missing_actual_fee_count > 0
            ? "unavailable"
            : "estimated",
    actual_fee_total_minor: fees.actual_fee_total_minor,
    estimated_fee_total_minor: fees.estimated_fee_total_minor,
    missing_actual_fee_count: fees.missing_actual_fee_count,
    fee_items: fees.items,
    platform_service_fee_minor: chargedPlatformFee,
    raw_platform_service_fee_minor: rawPlatformFee,
    tax_reserve_minor: taxReserve,
    withholding_minor: withholding,
    adjustments_minor: adjustments,
    net_settlement_minor: net,
    merchant_payable_minor: payable,
    merchant_due_to_platform_minor: dueToPlatform,
    carry_forward_balance_minor: net < 0 ? net : 0,
    prior_offset_amount_minor:
      profile.payment_plan === "sales_offset_18000"
        ? Math.min(priorOffset, profile.offset_target_amount_minor)
        : 0,
    current_offset_amount_minor: currentOffset,
    cumulative_offset_amount_minor: cumulativeOffset,
    remaining_offset_amount_minor: remainingOffset,
    ongoing_platform_fee_minor: ongoingFee,
    calculation_version: SETTLEMENT_CALCULATION_VERSION,
    rules_snapshot: profile,
  };
}

export function settlementSnapshot(result) {
  return JSON.stringify({
    calculation_version: result.calculation_version,
    profile: result.rules_snapshot,
    fee_breakdown: {
      actual_fee_total_minor: result.actual_fee_total_minor,
      estimated_fee_total_minor: result.estimated_fee_total_minor,
      missing_actual_fee_count: result.missing_actual_fee_count,
    },
  });
}
