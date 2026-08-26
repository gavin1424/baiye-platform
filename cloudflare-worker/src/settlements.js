import {
  calculateRefundReversal,
  calculateSettlement,
  decimalMajorToMinor,
  normalizeSettlementProfile,
  roundByBasisPoints,
  settlementSnapshot,
} from "./settlement-engine.js";
import { createSettlementPdf, settlementCsv } from "./settlement-pdf.js";
import { sha256 } from "./contract-pdf.js";
import {
  isDate,
  taipeiDateToUtcEndExclusive,
  taipeiDateToUtcStart,
} from "./taipei-date.js";

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8", ...headers },
  });
const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const safeText = (value, max = 300) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const actor = (session) => session?.admin_user_id || session?.id || "admin";
const collectionRoles = new Set([
  "platform_deposit",
  "merchant_direct",
  "order_balance",
  "full_payment",
  "manual_unclassified",
  "test",
]);
const adjustmentTypes = new Set([
  "refund",
  "fee_difference",
  "chargeback",
  "correction",
  "reversal",
  "other",
]);

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
async function merchant(db, merchantId) {
  return db
    .prepare(
      "SELECT id,merchant_code,name,status FROM merchants WHERE id=? LIMIT 1",
    )
    .bind(merchantId)
    .first();
}
async function profile(db, merchantId) {
  return db
    .prepare(
      "SELECT * FROM merchant_settlement_profiles WHERE merchant_id=? LIMIT 1",
    )
    .bind(merchantId)
    .first();
}
function major(value) {
  const converted = decimalMajorToMinor(value ?? 0);
  if (converted === null) throw new TypeError("既有財務金額格式無法安全轉換。");
  return converted;
}
function statementNumber(periodStart) {
  return `CBS-${periodStart.slice(0, 7).replace("-", "")}-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}
function operationKey(request, body = {}) {
  return safeText(
    request.headers.get("idempotency-key") || body.idempotency_key,
    150,
  );
}

function profilePayload(data) {
  const normalized = normalizeSettlementProfile(data);
  if (normalized.enabled && normalized.legal_review_status !== "approved")
    throw new TypeError("啟用前必須完成契約／法務確認。");
  if (normalized.enabled && !normalized.effective_from)
    throw new TypeError("啟用前必須設定契約生效日。");
  if (
    (normalized.tax_reserve_mode !== "disabled" ||
      normalized.withholding_mode !== "disabled") &&
    normalized.accounting_review_status !== "approved"
  )
    throw new TypeError("稅務預留或扣繳須先取得記帳士／稅務專業人員核准。");
  return normalized;
}

async function audit(db, session, action, entityType, entityId, metadata = {}) {
  await db
    .prepare(
      "INSERT INTO audit_logs (id,actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?,?,?)",
    )
    .bind(
      uid("audit"),
      "admin",
      actor(session),
      action,
      entityType,
      entityId,
      JSON.stringify(metadata),
    )
    .run();
}

async function event(
  db,
  session,
  settlementId,
  merchantId,
  type,
  fromStatus,
  toStatus,
  metadata = {},
  key = null,
) {
  await db
    .prepare(
      "INSERT INTO merchant_settlement_events (id,settlement_id,merchant_id,actor_type,actor_id,event_type,from_status,to_status,idempotency_key,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      uid("stev"),
      settlementId,
      merchantId,
      "admin",
      actor(session),
      type,
      fromStatus,
      toStatus,
      key,
      JSON.stringify(metadata),
    )
    .run();
  await audit(
    db,
    session,
    `merchant_settlement_${type}`,
    "merchant_settlement",
    settlementId || merchantId,
    metadata,
  );
}

async function beginOperation(db, session, statement, type, key) {
  if (!key)
    return { error: json({ error: "此操作需要 Idempotency-Key。" }, 400) };
  const previous = await db
    .prepare(
      "SELECT status,http_status,response_json FROM merchant_settlement_operations WHERE operation_type=? AND idempotency_key=?",
    )
    .bind(type, key)
    .first();
  if (previous?.status === "completed")
    return {
      replay: json(
        JSON.parse(previous.response_json),
        Number(previous.http_status || 200),
        { "idempotent-replay": "true" },
      ),
    };
  if (previous)
    return {
      error: json({ error: "相同操作仍在處理中，請勿重複送出。" }, 409),
    };
  try {
    await db
      .prepare(
        "INSERT INTO merchant_settlement_operations(id,settlement_id,merchant_id,operation_type,idempotency_key,created_by) VALUES (?,?,?,?,?,?)",
      )
      .bind(
        uid("stop"),
        statement.id,
        statement.merchant_id,
        type,
        key,
        actor(session),
      )
      .run();
    return {};
  } catch {
    return { error: json({ error: "相同操作已送出，請查詢最新狀態。" }, 409) };
  }
}

async function completeOperation(db, type, key, payload, status = 200) {
  await db
    .prepare(
      "UPDATE merchant_settlement_operations SET status='completed',http_status=?,response_json=?,completed_at=CURRENT_TIMESTAMP WHERE operation_type=? AND idempotency_key=? AND status='processing'",
    )
    .bind(status, JSON.stringify(payload), type, key)
    .run();
}

async function abandonOperation(db, type, key) {
  await db
    .prepare(
      "DELETE FROM merchant_settlement_operations WHERE operation_type=? AND idempotency_key=? AND status='processing'",
    )
    .bind(type, key)
    .run();
}

function period(valueStart, valueEnd) {
  if (!isDate(valueStart) || !isDate(valueEnd) || valueEnd < valueStart)
    throw new TypeError("商家或對帳期間格式錯誤。");
  return {
    start: valueStart,
    end: valueEnd,
    startUtc: taipeiDateToUtcStart(valueStart),
    endExclusiveUtc: taipeiDateToUtcEndExclusive(valueEnd),
  };
}

async function eligibleSources(
  db,
  merchantId,
  range,
  excludeStatementId = null,
) {
  const rows = await db
    .prepare(
      `SELECT s.*,p.status payment_status,p.source payment_source,p.gross_amount,p.fee_amount,p.payment_no,o.order_no
    FROM merchant_settlement_sources s
    JOIN payments p ON p.id=s.payment_id AND p.merchant_id=s.merchant_id
    JOIN orders o ON o.id=s.order_id AND o.merchant_id=s.merchant_id
    WHERE s.merchant_id=? AND s.collection_role='platform_deposit' AND s.settlement_eligible=1
      AND s.occurred_at>=? AND s.occurred_at<?
      AND (s.reserved_statement_id IS NULL OR s.reserved_statement_id=?)
    ORDER BY s.occurred_at,s.id`,
    )
    .bind(merchantId, range.startUtc, range.endExclusiveUtc, excludeStatementId)
    .all();
  const anomalies = [];
  const sources = [];
  for (const row of rows.results) {
    if (
      !row.order_id ||
      !Number.isSafeInteger(Number(row.order_total_amount_minor)) ||
      Number(row.order_total_amount_minor) <= 0
    )
      anomalies.push({
        payment_id: row.payment_id,
        reason: "缺少核准的訂單總額快照",
      });
    if (
      !["paid", "partially_refunded", "refunded"].includes(row.payment_status)
    )
      anomalies.push({
        payment_id: row.payment_id,
        reason: "付款尚未成功 captured／paid",
      });
    if (
      row.payment_source === "manual" &&
      row.collection_role === "manual_unclassified"
    )
      anomalies.push({
        payment_id: row.payment_id,
        reason: "人工付款尚未分類",
      });
    const refunds = await db
      .prepare(
        `SELECT id,amount,refunded_at,created_at FROM refunds
      WHERE payment_id=? AND status='refunded' AND COALESCE(refunded_at,created_at)>=? AND COALESCE(refunded_at,created_at)<?
      ORDER BY COALESCE(refunded_at,created_at),id`,
      )
      .bind(row.payment_id, range.startUtc, range.endExclusiveUtc)
      .all();
    const refundMinor = refunds.results.reduce(
      (sum, refund) => sum + major(refund.amount),
      0,
    );
    const initialActual = Number(row.actual_collected_amount_minor);
    const actual = Math.max(0, initialActual - refundMinor);
    const ratioBp =
      initialActual > 0
        ? Number(
            (BigInt(actual) * 10_000n + BigInt(initialActual) / 2n) /
              BigInt(initialActual),
          )
        : 0;
    const selectedProfile = await profile(db, merchantId);
    if (
      refundMinor > 0 &&
      [
        selectedProfile?.refund_platform_fee_policy,
        selectedProfile?.refund_offset_policy,
        selectedProfile?.provider_fee_refund_policy,
      ].includes("manual_review")
    )
      anomalies.push({
        payment_id: row.payment_id,
        reason: "退款政策需要人工覆核",
      });
    const effectiveOrderTotal =
      refundMinor > 0 &&
      selectedProfile?.refund_platform_fee_policy === "pro_rata_reverse"
        ? roundByBasisPoints(Number(row.order_total_amount_minor), ratioBp)
        : Number(row.order_total_amount_minor);
    sources.push({
      ...row,
      order_total_amount_minor: effectiveOrderTotal,
      expected_deposit_amount_minor: roundByBasisPoints(
        effectiveOrderTotal,
        Number(selectedProfile?.deposit_rate_bp || 0),
      ),
      actual_collected_amount_minor: actual,
      provider_fee_actual_minor:
        row.provider_fee_actual_minor == null
          ? null
          : Number(row.provider_fee_actual_minor),
      refunds: refunds.results,
      refund_minor: refundMinor,
    });
  }
  if (anomalies.length)
    throw Object.assign(
      new Error("存在不可納入的異常交易，請先完成來源與退款覆核。"),
      { status: 422, anomalies },
    );
  return sources;
}

async function pendingAdjustments(db, merchantId) {
  const rows = await db
    .prepare(
      "SELECT * FROM merchant_settlement_adjustments WHERE merchant_id=? AND status='pending' ORDER BY created_at,id",
    )
    .bind(merchantId)
    .all();
  return rows.results;
}

async function priorOffset(db, merchantId, excludeId = null) {
  const row = await db
    .prepare(
      `SELECT COALESCE(MAX(cumulative_offset_amount_minor),0) total FROM merchant_settlements
    WHERE merchant_id=? AND status IN ('locked','paid') ${excludeId ? "AND id<>?" : ""}`,
    )
    .bind(...(excludeId ? [merchantId, excludeId] : [merchantId]))
    .first();
  const reversals = await db
    .prepare(
      "SELECT COALESCE(SUM(offset_reversal_minor),0) total FROM merchant_settlement_adjustments WHERE merchant_id=? AND status='pending'",
    )
    .bind(merchantId)
    .first();
  return Math.max(0, Number(row?.total || 0) + Number(reversals?.total || 0));
}

async function computation(
  db,
  merchantId,
  range,
  manual = {},
  excludeId = null,
) {
  const selectedProfile = await profile(db, merchantId);
  if (!selectedProfile)
    throw Object.assign(new Error("此商家尚未建立訂金代收規則。"), {
      status: 404,
    });
  if (
    !Number(selectedProfile.enabled) ||
    selectedProfile.legal_review_status !== "approved"
  )
    throw new TypeError("此商家尚未完成選配服務契約啟用。");
  if (
    (selectedProfile.effective_from &&
      selectedProfile.effective_from > range.end) ||
    (selectedProfile.effective_to && selectedProfile.effective_to < range.start)
  )
    throw new TypeError("對帳期間不在有效契約期間內。");
  const sources = await eligibleSources(db, merchantId, range, excludeId);
  const adjustmentRows = await pendingAdjustments(db, merchantId);
  const adjustments = adjustmentRows.reduce(
    (sum, row) => sum + Number(row.amount_minor),
    0,
  );
  const result = calculateSettlement({
    profile: selectedProfile,
    sources,
    prior_offset_amount_minor: await priorOffset(db, merchantId, excludeId),
    adjustments_minor: adjustments,
    manual_tax_reserve_minor: manual.manual_tax_reserve_minor,
    manual_withholding_minor: manual.manual_withholding_minor,
    allow_missing_actual_fee: manual.allow_missing_actual_fee === true,
  });
  const items = sources.map((source, index) => ({
    settlement_source_id: source.id,
    item_type: "deposit",
    source_type: "payment",
    source_id: source.payment_id,
    order_id: source.order_id,
    payment_id: source.payment_id,
    refund_id: null,
    order_total_amount_minor: source.order_total_amount_minor,
    expected_deposit_amount_minor: source.expected_deposit_amount_minor,
    actual_deposit_amount_minor: source.actual_collected_amount_minor,
    processing_fee_minor: result.fee_items[index].processing_fee_minor,
    processing_fee_source: result.fee_items[index].processing_fee_source,
    amount_minor: source.actual_collected_amount_minor,
    occurred_at: source.occurred_at,
    source_snapshot_json: JSON.stringify({
      payment_no: source.payment_no,
      order_no: source.order_no,
      collection_role: source.collection_role,
      source_version: source.source_version,
      refund_minor: source.refund_minor,
    }),
  }));
  return { profile: selectedProfile, sources, items, adjustmentRows, result };
}

function statementValues(id, no, merchantId, profileId, range, result) {
  return [
    id,
    no,
    merchantId,
    profileId,
    range.start,
    range.end,
    range.startUtc,
    range.endExclusiveUtc,
    "draft",
    "TWD",
    result.total_order_amount_minor,
    result.expected_deposit_amount_minor,
    result.actual_deposit_collected_minor,
    result.deposit_variance_minor,
    result.processing_fee_minor,
    result.actual_fee_total_minor,
    result.estimated_fee_total_minor,
    result.missing_actual_fee_count,
    result.platform_service_fee_minor,
    result.tax_reserve_minor,
    result.withholding_minor,
    result.adjustments_minor,
    result.merchant_payable_minor,
    result.prior_offset_amount_minor,
    result.current_offset_amount_minor,
    result.cumulative_offset_amount_minor,
    result.remaining_offset_amount_minor,
    result.ongoing_platform_fee_minor,
    result.calculation_version,
    settlementSnapshot(result),
  ];
}

function itemStatement(db, statementId, merchantId, item) {
  return db
    .prepare(
      `INSERT INTO merchant_settlement_items
    (id,settlement_id,merchant_id,settlement_source_id,item_type,source_type,source_id,order_id,payment_id,refund_id,order_total_amount_minor,expected_deposit_amount_minor,actual_deposit_amount_minor,processing_fee_minor,processing_fee_source,amount_minor,occurred_at,source_snapshot_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      uid("stit"),
      statementId,
      merchantId,
      item.settlement_source_id,
      item.item_type,
      item.source_type,
      item.source_id,
      item.order_id,
      item.payment_id,
      item.refund_id,
      item.order_total_amount_minor,
      item.expected_deposit_amount_minor,
      item.actual_deposit_amount_minor,
      item.processing_fee_minor,
      item.processing_fee_source,
      item.amount_minor,
      item.occurred_at,
      item.source_snapshot_json,
    );
}

async function getStatement(db, id) {
  return db
    .prepare(
      "SELECT s.*,m.name merchant_name,m.merchant_code FROM merchant_settlements s JOIN merchants m ON m.id=s.merchant_id WHERE s.id=? LIMIT 1",
    )
    .bind(id)
    .first();
}

export async function createSettlementRefundAdjustment(db, session, refundId) {
  const row = await db
    .prepare(
      `SELECT r.id,r.amount,r.refunded_at,p.id payment_id,i.settlement_id,i.actual_deposit_amount_minor item_deposit_minor,i.order_total_amount_minor item_order_total_minor,i.processing_fee_minor item_processing_fee_minor,s.merchant_id,s.status,s.total_order_amount_minor,s.platform_service_fee_minor,s.current_offset_amount_minor,sp.refund_platform_fee_policy,sp.refund_offset_policy,sp.provider_fee_refund_policy
    FROM refunds r JOIN payments p ON p.id=r.payment_id
    JOIN merchant_settlement_items i ON i.payment_id=p.id
    JOIN merchant_settlements s ON s.id=i.settlement_id
    JOIN merchant_settlement_profiles sp ON sp.id=s.profile_id
    WHERE r.id=? AND r.status='refunded' AND s.status IN ('locked','paid') LIMIT 1`,
    )
    .bind(refundId)
    .first();
  if (!row) return null;
  const itemShareBp =
    Number(row.total_order_amount_minor) > 0
      ? Number(
          (BigInt(Number(row.item_order_total_minor)) * 10_000n +
            BigInt(Number(row.total_order_amount_minor)) / 2n) /
            BigInt(Number(row.total_order_amount_minor)),
        )
      : 0;
  const reversal = calculateRefundReversal({
    depositMinor: Number(row.item_deposit_minor),
    platformFeeMinor: roundByBasisPoints(
      Number(row.platform_service_fee_minor),
      itemShareBp,
    ),
    currentOffsetMinor: roundByBasisPoints(
      Number(row.current_offset_amount_minor),
      itemShareBp,
    ),
    providerFeeMinor: Number(row.item_processing_fee_minor),
    refundMinor: major(row.amount),
    profile: row,
  });
  if (reversal.requires_manual_review) return { requires_manual_review: true };
  const amount =
    reversal.deposit_reversal_minor - reversal.platform_fee_reversal_minor;
  const key = `refund:${refundId}`;
  try {
    await db
      .prepare(
        `INSERT INTO merchant_settlement_adjustments
      (id,merchant_id,source_settlement_id,adjustment_type,deposit_reversal_minor,platform_fee_reversal_minor,offset_reversal_minor,provider_fee_retained_minor,amount_minor,reason,source_reference,idempotency_key,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        uid("stad"),
        row.merchant_id,
        row.settlement_id,
        "reversal",
        reversal.deposit_reversal_minor,
        reversal.platform_fee_reversal_minor,
        reversal.offset_reversal_minor,
        reversal.provider_fee_retained_minor,
        amount,
        "鎖定後退款自動帶入下一期",
        refundId,
        key,
        actor(session),
      )
      .run();
    await event(
      db,
      session,
      row.settlement_id,
      row.merchant_id,
      "refund_reversal_created",
      row.status,
      row.status,
      { refund_id: refundId, ...reversal },
      key,
    );
    return { ...reversal, amount_minor: amount };
  } catch (error) {
    if (/UNIQUE/.test(String(error?.message))) return { duplicate: true };
    throw error;
  }
}

export async function handleSettlementRequest(
  request,
  env,
  url,
  cors,
  adminSession,
) {
  const db = env.FINANCE_DB;
  if (url.pathname === "/api/finance/settlement-settings/platform") {
    if (request.method === "GET") {
      const item = await db
        .prepare(
          "SELECT brand_name,legal_entity_name,tax_id,invoice_title,invoice_address,reviewed_by,reviewed_at,updated_at FROM platform_finance_settings WHERE id='default'",
        )
        .first();
      return json(
        {
          settings: item || {
            brand_name: "創百業智慧鏈",
            legal_entity_name: null,
            tax_id: null,
            invoice_title: null,
            invoice_address: null,
          },
        },
        200,
        cors,
      );
    }
    if (request.method === "PATCH") {
      const input = await readJson(request);
      const brand = safeText(input.brand_name, 100) || "創百業智慧鏈";
      const legal = safeText(input.legal_entity_name, 200);
      const taxId = safeText(input.tax_id, 20);
      if (!legal || !taxId || input.confirm_legal_identity !== true)
        return json(
          { error: "公司法律主體與統編須由管理員確認後保存。" },
          400,
          cors,
        );
      await db
        .prepare(
          "INSERT INTO platform_finance_settings(id,brand_name,legal_entity_name,tax_id,invoice_title,invoice_address,reviewed_by,reviewed_at,updated_at) VALUES ('default',?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET brand_name=excluded.brand_name,legal_entity_name=excluded.legal_entity_name,tax_id=excluded.tax_id,invoice_title=excluded.invoice_title,invoice_address=excluded.invoice_address,reviewed_by=excluded.reviewed_by,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP",
        )
        .bind(
          brand,
          legal,
          taxId,
          safeText(input.invoice_title, 200) || legal,
          safeText(input.invoice_address, 300) || null,
          actor(adminSession),
        )
        .run();
      await audit(
        db,
        adminSession,
        "platform_finance_identity_updated",
        "platform_finance_settings",
        "default",
        { brand_name: brand, tax_id_masked: `***${taxId.slice(-4)}` },
      );
      return json({ ok: true }, 200, cors);
    }
  }

  const sourceMatch = url.pathname.match(
    /^\/api\/finance\/settlement-sources(?:\/([^/]+))?$/,
  );
  if (sourceMatch) {
    if (!sourceMatch[1] && request.method === "GET") {
      const merchantId = url.searchParams.get("merchant_id");
      const rows = await db
        .prepare(
          `SELECT p.id payment_id,p.payment_no,p.order_id,p.gross_amount,p.fee_amount,p.status,p.source,p.created_at,m.name merchant_name,o.order_no,s.collection_role,s.settlement_eligible,s.order_total_amount_minor,s.expected_deposit_amount_minor,s.actual_collected_amount_minor,s.provider_fee_actual_minor,s.reviewed_at,s.reserved_statement_id
        FROM payments p JOIN merchants m ON m.id=p.merchant_id LEFT JOIN orders o ON o.id=p.order_id LEFT JOIN merchant_settlement_sources s ON s.payment_id=p.id
        WHERE (? IS NULL OR p.merchant_id=?) ORDER BY p.created_at DESC LIMIT 200`,
        )
        .bind(merchantId, merchantId)
        .all();
      return json({ items: rows.results }, 200, cors);
    }
    if (sourceMatch[1] && request.method === "PATCH") {
      const paymentId = decodeURIComponent(sourceMatch[1]);
      const input = await readJson(request);
      const payment = await db
        .prepare(
          "SELECT p.*,o.amount_due,o.merchant_id order_merchant_id FROM payments p LEFT JOIN orders o ON o.id=p.order_id WHERE p.id=?",
        )
        .bind(paymentId)
        .first();
      if (!payment) return json({ error: "找不到付款。" }, 404, cors);
      const role = collectionRoles.has(input.collection_role)
        ? input.collection_role
        : "manual_unclassified";
      const eligible = input.settlement_eligible === true;
      if (
        eligible &&
        (role !== "platform_deposit" ||
          !payment.order_id ||
          payment.order_merchant_id !== payment.merchant_id ||
          input.confirm_source_review !== true)
      )
        return json(
          { error: "只有已連結同商家訂單且完成覆核的平台訂金可納入月結。" },
          400,
          cors,
        );
      const orderTotal =
        input.order_total_amount_minor == null
          ? payment.amount_due == null
            ? null
            : major(payment.amount_due)
          : Number(input.order_total_amount_minor);
      const actual =
        input.actual_collected_amount_minor == null
          ? major(payment.gross_amount)
          : Number(input.actual_collected_amount_minor);
      const fee =
        input.provider_fee_actual_minor == null
          ? payment.fee_amount == null
            ? null
            : major(payment.fee_amount)
          : Number(input.provider_fee_actual_minor);
      if (
        !Number.isSafeInteger(orderTotal) ||
        orderTotal <= 0 ||
        !Number.isSafeInteger(actual) ||
        actual < 0 ||
        (fee != null && (!Number.isSafeInteger(fee) || fee < 0))
      )
        return json({ error: "來源金額快照格式錯誤。" }, 400, cors);
      const selectedProfile = await profile(db, payment.merchant_id);
      const expected = roundByBasisPoints(
        orderTotal,
        Number(selectedProfile?.deposit_rate_bp || 3000),
      );
      await db
        .prepare(
          `INSERT INTO merchant_settlement_sources(id,merchant_id,payment_id,order_id,collection_role,settlement_eligible,order_total_amount_minor,expected_deposit_amount_minor,actual_collected_amount_minor,provider_fee_actual_minor,occurred_at,reviewed_by,reviewed_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT(payment_id) DO UPDATE SET collection_role=excluded.collection_role,settlement_eligible=excluded.settlement_eligible,order_total_amount_minor=excluded.order_total_amount_minor,expected_deposit_amount_minor=excluded.expected_deposit_amount_minor,actual_collected_amount_minor=excluded.actual_collected_amount_minor,provider_fee_actual_minor=excluded.provider_fee_actual_minor,occurred_at=excluded.occurred_at,reviewed_by=excluded.reviewed_by,reviewed_at=CURRENT_TIMESTAMP,source_version='settlement-source-v1',updated_at=CURRENT_TIMESTAMP`,
        )
        .bind(
          uid("stsrc"),
          payment.merchant_id,
          payment.id,
          payment.order_id,
          role,
          eligible ? 1 : 0,
          orderTotal,
          expected,
          actual,
          fee,
          payment.paid_at || payment.created_at,
          actor(adminSession),
        )
        .run();
      await audit(
        db,
        adminSession,
        "settlement_source_reviewed",
        "payment",
        payment.id,
        {
          merchant_id: payment.merchant_id,
          collection_role: role,
          settlement_eligible: eligible,
        },
      );
      return json({ ok: true }, 200, cors);
    }
  }

  const profileMatch = url.pathname.match(
    /^\/api\/finance\/settlement-profiles\/([^/]+)$/,
  );
  if (profileMatch && request.method === "GET") {
    const item = await profile(db, decodeURIComponent(profileMatch[1]));
    return item
      ? json(item, 200, cors)
      : json({ error: "尚未建立規則設定。" }, 404, cors);
  }
  if (profileMatch && request.method === "PATCH") {
    const merchantId = decodeURIComponent(profileMatch[1]);
    if (!(await merchant(db, merchantId)))
      return json({ error: "找不到商家。" }, 404, cors);
    try {
      const input = await readJson(request);
      const normalized = profilePayload(input);
      const existing = await profile(db, merchantId);
      const profileId = existing?.id || uid("stpf");
      if (normalized.enabled) {
        const settings = await db
          .prepare(
            "SELECT legal_entity_name,tax_id FROM platform_finance_settings WHERE id='default'",
          )
          .first();
        if (!settings?.legal_entity_name || !settings?.tax_id)
          return json(
            { error: "啟用前必須先設定正式公司法律主體與統編。" },
            400,
            cors,
          );
      }
      await db
        .prepare(
          `INSERT INTO merchant_settlement_profiles
        (id,merchant_id,enabled,payment_plan,deposit_rate_bp,platform_fee_rate_bp,processing_fee_mode,processing_fee_basis,estimated_processing_fee_rate_bp,tax_reserve_mode,tax_reserve_rate_bp,withholding_mode,withholding_rate_bp,withholding_income_type,refund_platform_fee_policy,refund_offset_policy,provider_fee_refund_policy,offset_target_amount_minor,continue_platform_fee_after_offset,settlement_day,legal_review_status,accounting_review_status,effective_from,effective_to,calculation_version,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(merchant_id) DO UPDATE SET enabled=excluded.enabled,payment_plan=excluded.payment_plan,deposit_rate_bp=excluded.deposit_rate_bp,platform_fee_rate_bp=excluded.platform_fee_rate_bp,processing_fee_mode=excluded.processing_fee_mode,processing_fee_basis=excluded.processing_fee_basis,estimated_processing_fee_rate_bp=excluded.estimated_processing_fee_rate_bp,tax_reserve_mode=excluded.tax_reserve_mode,tax_reserve_rate_bp=excluded.tax_reserve_rate_bp,withholding_mode=excluded.withholding_mode,withholding_rate_bp=excluded.withholding_rate_bp,withholding_income_type=excluded.withholding_income_type,refund_platform_fee_policy=excluded.refund_platform_fee_policy,refund_offset_policy=excluded.refund_offset_policy,provider_fee_refund_policy=excluded.provider_fee_refund_policy,offset_target_amount_minor=excluded.offset_target_amount_minor,continue_platform_fee_after_offset=excluded.continue_platform_fee_after_offset,settlement_day=excluded.settlement_day,legal_review_status=excluded.legal_review_status,accounting_review_status=excluded.accounting_review_status,effective_from=excluded.effective_from,effective_to=excluded.effective_to,calculation_version=excluded.calculation_version,updated_at=CURRENT_TIMESTAMP`,
        )
        .bind(
          profileId,
          merchantId,
          normalized.enabled ? 1 : 0,
          normalized.payment_plan,
          normalized.deposit_rate_bp,
          normalized.platform_fee_rate_bp,
          normalized.processing_fee_mode,
          normalized.processing_fee_basis,
          normalized.estimated_processing_fee_rate_bp,
          normalized.tax_reserve_mode,
          normalized.tax_reserve_rate_bp,
          normalized.withholding_mode,
          normalized.withholding_rate_bp,
          normalized.withholding_income_type,
          normalized.refund_platform_fee_policy,
          normalized.refund_offset_policy,
          normalized.provider_fee_refund_policy,
          normalized.offset_target_amount_minor,
          normalized.continue_platform_fee_after_offset ? 1 : 0,
          normalized.settlement_day,
          normalized.legal_review_status,
          normalized.accounting_review_status,
          normalized.effective_from,
          normalized.effective_to,
          normalized.calculation_version,
        )
        .run();
      await audit(
        db,
        adminSession,
        "merchant_settlement_profile_updated",
        "merchant_settlement_profile",
        profileId,
        {
          merchant_id: merchantId,
          enabled: normalized.enabled,
          payment_plan: normalized.payment_plan,
        },
      );
      return json(
        { ok: true, profile: await profile(db, merchantId) },
        200,
        cors,
      );
    } catch (error) {
      return json({ error: error.message || "規則設定格式錯誤。" }, 400, cors);
    }
  }

  if (
    url.pathname === "/api/finance/settlements/preview" &&
    request.method === "POST"
  ) {
    const input = await readJson(request);
    try {
      if (!(await merchant(db, input.merchant_id)))
        return json({ error: "找不到商家。" }, 404, cors);
      const range = period(input.period_start, input.period_end);
      const computed = await computation(db, input.merchant_id, range, input);
      return json(
        {
          preview: computed.result,
          transaction_count: computed.sources.length,
          source_items: computed.items,
          anomalies: [],
          writes_data: false,
          timezone: "Asia/Taipei",
        },
        200,
        cors,
      );
    } catch (error) {
      return json(
        {
          error: error.message || "無法產生預覽。",
          anomalies: error.anomalies || [],
        },
        error.status || 400,
        cors,
      );
    }
  }

  if (
    url.pathname === "/api/finance/settlements" &&
    request.method === "POST"
  ) {
    const input = await readJson(request);
    try {
      const range = period(input.period_start, input.period_end);
      const computed = await computation(db, input.merchant_id, range, input);
      const statementId = uid("stmt");
      const statementNo = statementNumber(range.start);
      const sql = `INSERT INTO merchant_settlements
        (id,statement_no,merchant_id,profile_id,period_start,period_end,period_start_utc,period_end_exclusive_utc,status,currency,total_order_amount_minor,expected_deposit_amount_minor,actual_deposit_collected_minor,deposit_variance_minor,processing_fee_minor,actual_fee_total_minor,estimated_fee_total_minor,missing_actual_fee_count,platform_service_fee_minor,tax_reserve_minor,withholding_minor,adjustments_minor,merchant_payable_minor,prior_offset_amount_minor,current_offset_amount_minor,cumulative_offset_amount_minor,remaining_offset_amount_minor,ongoing_platform_fee_minor,calculation_version,rules_snapshot_json)
        VALUES (${Array(30).fill("?").join(",")})`;
      const batch = [
        db
          .prepare(sql)
          .bind(
            ...statementValues(
              statementId,
              statementNo,
              input.merchant_id,
              computed.profile.id,
              range,
              computed.result,
            ),
          ),
      ];
      for (const source of computed.sources)
        batch.push(
          db
            .prepare(
              "UPDATE merchant_settlement_sources SET reserved_statement_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND reserved_statement_id IS NULL",
            )
            .bind(statementId, source.id),
        );
      for (const item of computed.items)
        batch.push(itemStatement(db, statementId, input.merchant_id, item));
      await db.batch(batch);
      await event(
        db,
        adminSession,
        statementId,
        input.merchant_id,
        "created",
        null,
        "draft",
        {
          statement_no: statementNo,
          period_start: range.start,
          period_end: range.end,
        },
      );
      return json({ id: statementId, statement_no: statementNo }, 201, cors);
    } catch (error) {
      return json(
        {
          error: error.message || "建立草稿失敗。",
          anomalies: error.anomalies || [],
        },
        error.status || (/UNIQUE/.test(String(error.message)) ? 409 : 400),
        cors,
      );
    }
  }

  if (
    url.pathname === "/api/finance/settlements/audit" &&
    request.method === "GET"
  ) {
    const rows = await db
      .prepare(
        "SELECT e.*,s.statement_no,m.name merchant_name FROM merchant_settlement_events e LEFT JOIN merchant_settlements s ON s.id=e.settlement_id JOIN merchants m ON m.id=e.merchant_id ORDER BY e.created_at DESC LIMIT 500",
      )
      .all();
    return json({ items: rows.results }, 200, cors);
  }
  if (url.pathname === "/api/finance/settlements" && request.method === "GET") {
    const where = [];
    const args = [];
    for (const [key, column] of [
      ["merchant_id", "s.merchant_id"],
      ["status", "s.status"],
    ])
      if (url.searchParams.get(key)) {
        where.push(`${column}=?`);
        args.push(url.searchParams.get(key));
      }
    if (url.searchParams.get("month")) {
      where.push("substr(s.period_start,1,7)=?");
      args.push(url.searchParams.get("month"));
    }
    if (url.searchParams.get("q")) {
      where.push("(s.statement_no LIKE ? OR m.name LIKE ?)");
      args.push(
        `%${url.searchParams.get("q")}%`,
        `%${url.searchParams.get("q")}%`,
      );
    }
    const requestedLimit = Number(url.searchParams.get("limit") || 100);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(200, Math.max(1, requestedLimit))
      : 100;
    const rows = await db
      .prepare(
        `SELECT s.*,m.name merchant_name,p.payment_plan,p.offset_target_amount_minor,p.continue_platform_fee_after_offset
      FROM merchant_settlements s JOIN merchants m ON m.id=s.merchant_id JOIN merchant_settlement_profiles p ON p.id=s.profile_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY s.period_start DESC,s.created_at DESC LIMIT ${limit}`,
      )
      .bind(...args)
      .all();
    return json({ items: rows.results, limit }, 200, cors);
  }

  const match = url.pathname.match(
    /^\/api\/finance\/settlements\/([^/]+)(?:\/(submit-review|return-draft|lock|mark-paid|void|pdf|csv|adjustments))?$/,
  );
  if (!match) return null;
  const statementId = decodeURIComponent(match[1]);
  const action = match[2];
  const statement = await getStatement(db, statementId);
  if (!statement) return json({ error: "找不到對帳單。" }, 404, cors);

  if (!action && request.method === "GET") {
    const items = await db
      .prepare(
        "SELECT * FROM merchant_settlement_items WHERE settlement_id=? ORDER BY occurred_at,id",
      )
      .bind(statementId)
      .all();
    const adjustments = await db
      .prepare(
        "SELECT * FROM merchant_settlement_adjustments WHERE source_settlement_id=? OR applied_settlement_id=? ORDER BY created_at",
      )
      .bind(statementId, statementId)
      .all();
    const events = await db
      .prepare(
        "SELECT * FROM merchant_settlement_events WHERE settlement_id=? ORDER BY created_at",
      )
      .bind(statementId)
      .all();
    const documents = await db
      .prepare(
        "SELECT pdf_version,pdf_status,pdf_hash,created_at,supersedes_pdf_version FROM settlement_document_versions WHERE settlement_id=? ORDER BY pdf_version DESC",
      )
      .bind(statementId)
      .all();
    return json(
      {
        ...statement,
        items: items.results,
        adjustments: adjustments.results,
        events: events.results,
        documents: documents.results,
      },
      200,
      cors,
    );
  }

  if (
    ["submit-review", "return-draft", "void"].includes(action) &&
    request.method === "POST"
  ) {
    const input = await readJson(request);
    const key = operationKey(request, input);
    const op = await beginOperation(db, adminSession, statement, action, key);
    if (op.replay || op.error) return op.replay || op.error;
    try {
      let nextStatus;
      if (action === "submit-review" && statement.status === "draft")
        nextStatus = "review";
      if (action === "return-draft" && statement.status === "review")
        nextStatus = "draft";
      if (action === "void" && ["draft", "review"].includes(statement.status))
        nextStatus = "void";
      if (!nextStatus)
        throw Object.assign(new Error("目前狀態不允許此操作。"), {
          status: 409,
        });
      const reason = action === "void" ? safeText(input.reason, 500) : null;
      if (action === "void" && !reason)
        throw Object.assign(new Error("請填寫作廢原因。"), { status: 400 });
      const timestamp = now();
      const batch = [
        db
          .prepare(
            "UPDATE merchant_settlements SET status=?,voided_at=?,void_reason=?,updated_at=? WHERE id=? AND status=?",
          )
          .bind(
            nextStatus,
            nextStatus === "void" ? timestamp : null,
            reason,
            timestamp,
            statementId,
            statement.status,
          ),
      ];
      if (nextStatus === "void")
        batch.push(
          db
            .prepare(
              "UPDATE merchant_settlement_sources SET reserved_statement_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE reserved_statement_id=?",
            )
            .bind(statementId),
        );
      await db.batch(batch);
      const payload = { ok: true, status: nextStatus };
      await event(
        db,
        adminSession,
        statementId,
        statement.merchant_id,
        action.replace("-", "_"),
        statement.status,
        nextStatus,
        { reason },
        key,
      );
      await completeOperation(db, action, key, payload);
      return json(payload, 200, cors);
    } catch (error) {
      await abandonOperation(db, action, key);
      return json(
        { error: error.message || "狀態操作失敗。" },
        error.status || 409,
        cors,
      );
    }
  }

  if (action === "lock" && request.method === "POST") {
    const input = await readJson(request);
    const key = operationKey(request, input);
    const op = await beginOperation(db, adminSession, statement, "lock", key);
    if (op.replay || op.error) return op.replay || op.error;
    let r2Key = null;
    let dbCommitted = false;
    try {
      if (statement.status !== "review")
        throw Object.assign(new Error("只有待審核對帳單可以鎖定。"), {
          status: 409,
        });
      const range = period(statement.period_start, statement.period_end);
      const computed = await computation(
        db,
        statement.merchant_id,
        range,
        {
          manual_tax_reserve_minor: statement.tax_reserve_minor,
          manual_withholding_minor: statement.withholding_minor,
        },
        statement.id,
      );
      const varianceReason = safeText(input.deposit_variance_reason, 500);
      if (
        computed.result.deposit_variance_minor !== 0 &&
        (!varianceReason || input.confirm_variance_review !== true)
      )
        throw Object.assign(
          new Error(
            "預期與實際訂金有差異，須填寫原因並由管理員覆核後才能鎖定。",
          ),
          { status: 422 },
        );
      if (
        computed.result.missing_actual_fee_count > 0 &&
        computed.profile.processing_fee_mode === "actual_only"
      )
        throw Object.assign(new Error("尚有付款缺少 Provider 實際手續費。"), {
          status: 422,
        });
      if (!env.CONTRACTS_BUCKET)
        throw Object.assign(
          new Error("私人檔案儲存空間尚未設定，對帳單未鎖定。"),
          { status: 503 },
        );
      const settings = await db
        .prepare("SELECT * FROM platform_finance_settings WHERE id='default'")
        .first();
      if (!settings?.legal_entity_name || !settings?.tax_id)
        throw Object.assign(new Error("尚未設定正式公司法律主體與統編。"), {
          status: 409,
        });
      const statementHash = await sha256(
        JSON.stringify({
          statement_no: statement.statement_no,
          merchant_id: statement.merchant_id,
          range,
          result: computed.result,
        }),
      );
      const pdf = await createSettlementPdf({
        ...statement,
        ...computed.result,
        status: "locked",
        platform_legal_name: settings.legal_entity_name,
        platform_tax_id: settings.tax_id,
        statement_hash: statementHash,
        generated_at: now(),
        timezone: "Asia/Taipei",
      });
      const version =
        Number(
          (
            await db
              .prepare(
                "SELECT COALESCE(MAX(pdf_version),0) version FROM settlement_document_versions WHERE settlement_id=?",
              )
              .bind(statementId)
              .first()
          )?.version || 0,
        ) + 1;
      r2Key = `settlements/${statement.merchant_id}/${statement.statement_no}/locked-${pdf.pdfHash}.pdf`;
      await env.CONTRACTS_BUCKET.put(r2Key, pdf.bytes, {
        httpMetadata: { contentType: "application/pdf" },
        customMetadata: {
          statement_id: statementId,
          pdf_hash: pdf.pdfHash,
          pdf_version: String(version),
          pdf_status: "locked",
        },
      });
      const timestamp = now();
      const updates = [
        db
          .prepare(
            "DELETE FROM merchant_settlement_items WHERE settlement_id=?",
          )
          .bind(statementId),
        ...computed.items.map((item) =>
          itemStatement(db, statementId, statement.merchant_id, item),
        ),
        db
          .prepare(
            `UPDATE merchant_settlements SET total_order_amount_minor=?,expected_deposit_amount_minor=?,actual_deposit_collected_minor=?,deposit_variance_minor=?,deposit_variance_reason=?,deposit_variance_reviewed_by=?,deposit_variance_reviewed_at=?,processing_fee_minor=?,actual_fee_total_minor=?,estimated_fee_total_minor=?,missing_actual_fee_count=?,platform_service_fee_minor=?,tax_reserve_minor=?,withholding_minor=?,adjustments_minor=?,merchant_payable_minor=?,prior_offset_amount_minor=?,current_offset_amount_minor=?,cumulative_offset_amount_minor=?,remaining_offset_amount_minor=?,ongoing_platform_fee_minor=?,calculation_version=?,rules_snapshot_json=?,statement_hash=?,current_pdf_version=?,pdf_object_key=?,pdf_hash=?,status='locked',locked_at=?,updated_at=? WHERE id=? AND status='review'`,
          )
          .bind(
            computed.result.total_order_amount_minor,
            computed.result.expected_deposit_amount_minor,
            computed.result.actual_deposit_collected_minor,
            computed.result.deposit_variance_minor,
            varianceReason || null,
            varianceReason ? actor(adminSession) : null,
            varianceReason ? timestamp : null,
            computed.result.processing_fee_minor,
            computed.result.actual_fee_total_minor,
            computed.result.estimated_fee_total_minor,
            computed.result.missing_actual_fee_count,
            computed.result.platform_service_fee_minor,
            computed.result.tax_reserve_minor,
            computed.result.withholding_minor,
            computed.result.adjustments_minor,
            computed.result.merchant_payable_minor,
            computed.result.prior_offset_amount_minor,
            computed.result.current_offset_amount_minor,
            computed.result.cumulative_offset_amount_minor,
            computed.result.remaining_offset_amount_minor,
            computed.result.ongoing_platform_fee_minor,
            computed.result.calculation_version,
            settlementSnapshot(computed.result),
            statementHash,
            version,
            r2Key,
            pdf.pdfHash,
            timestamp,
            timestamp,
            statementId,
          ),
        db
          .prepare(
            "INSERT INTO settlement_document_versions(id,settlement_id,merchant_id,pdf_version,pdf_status,pdf_object_key,pdf_hash,supersedes_pdf_version,created_by) VALUES (?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            uid("stdoc"),
            statementId,
            statement.merchant_id,
            version,
            "locked",
            r2Key,
            pdf.pdfHash,
            version > 1 ? version - 1 : null,
            actor(adminSession),
          ),
        ...computed.adjustmentRows.map((row) =>
          db
            .prepare(
              "UPDATE merchant_settlement_adjustments SET status='applied',applied_settlement_id=?,approved_by=?,applied_at=? WHERE id=? AND status='pending'",
            )
            .bind(statementId, actor(adminSession), timestamp, row.id),
        ),
      ];
      await db.batch(updates);
      dbCommitted = true;
      const payload = {
        ok: true,
        status: "locked",
        statement_hash: statementHash,
        pdf_hash: pdf.pdfHash,
        pdf_version: version,
      };
      await event(
        db,
        adminSession,
        statementId,
        statement.merchant_id,
        "locked",
        "review",
        "locked",
        {
          statement_hash: statementHash,
          pdf_hash: pdf.pdfHash,
          pdf_version: version,
        },
        key,
      );
      await completeOperation(db, "lock", key, payload);
      return json(payload, 200, cors);
    } catch (error) {
      if (
        !dbCommitted &&
        r2Key &&
        typeof env.CONTRACTS_BUCKET?.delete === "function"
      )
        await env.CONTRACTS_BUCKET.delete(r2Key);
      await abandonOperation(db, "lock", key);
      return json(
        { error: error.message || "鎖定失敗。" },
        error.status || 409,
        cors,
      );
    }
  }

  if (action === "mark-paid" && request.method === "POST") {
    const input = await readJson(request);
    const key = operationKey(request, input);
    const op = await beginOperation(
      db,
      adminSession,
      statement,
      "mark-paid",
      key,
    );
    if (op.replay || op.error) return op.replay || op.error;
    let r2Key = null;
    let dbCommitted = false;
    try {
      if (statement.status !== "locked")
        throw Object.assign(new Error("只有已鎖定對帳單可標記匯款。"), {
          status: 409,
        });
      const amount = Number(input.transfer_amount_minor);
      const transferDate = isDate(input.transfer_date)
        ? input.transfer_date
        : null;
      const reference = safeText(input.transfer_reference, 120);
      if (
        !Number.isSafeInteger(amount) ||
        amount !== Number(statement.merchant_payable_minor) ||
        !transferDate ||
        !reference
      )
        throw Object.assign(
          new Error("匯款金額必須等於應撥金額，並填寫台灣日期與 reference。"),
          { status: 400 },
        );
      if (!env.CONTRACTS_BUCKET)
        throw Object.assign(new Error("私人檔案儲存空間尚未設定。"), {
          status: 503,
        });
      const settings = await db
        .prepare("SELECT * FROM platform_finance_settings WHERE id='default'")
        .first();
      const pdf = await createSettlementPdf({
        ...statement,
        status: "paid",
        transfer_amount_minor: amount,
        transfer_date: transferDate,
        transfer_reference: reference,
        platform_legal_name: settings?.legal_entity_name,
        platform_tax_id: settings?.tax_id,
        generated_at: now(),
        timezone: "Asia/Taipei",
      });
      const version = Number(statement.current_pdf_version || 0) + 1;
      r2Key = `settlements/${statement.merchant_id}/${statement.statement_no}/paid-${pdf.pdfHash}.pdf`;
      await env.CONTRACTS_BUCKET.put(r2Key, pdf.bytes, {
        httpMetadata: { contentType: "application/pdf" },
        customMetadata: {
          statement_id: statementId,
          pdf_hash: pdf.pdfHash,
          pdf_version: String(version),
          pdf_status: "paid",
        },
      });
      const timestamp = now();
      await db.batch([
        db
          .prepare(
            "UPDATE merchant_settlements SET status='paid',transfer_amount_minor=?,transfer_date=?,transfer_reference=?,platform_invoice_no=?,platform_invoice_status=?,current_pdf_version=?,pdf_object_key=?,pdf_hash=?,paid_at=?,updated_at=? WHERE id=? AND status='locked'",
          )
          .bind(
            amount,
            transferDate,
            reference,
            safeText(input.platform_invoice_no, 80) || null,
            input.platform_invoice_no
              ? input.platform_invoice_status === "issued"
                ? "issued"
                : "pending"
              : null,
            version,
            r2Key,
            pdf.pdfHash,
            timestamp,
            timestamp,
            statementId,
          ),
        db
          .prepare(
            "INSERT INTO settlement_document_versions(id,settlement_id,merchant_id,pdf_version,pdf_status,pdf_object_key,pdf_hash,supersedes_pdf_version,created_by) VALUES (?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            uid("stdoc"),
            statementId,
            statement.merchant_id,
            version,
            "paid",
            r2Key,
            pdf.pdfHash,
            Number(statement.current_pdf_version || 0) || null,
            actor(adminSession),
          ),
      ]);
      dbCommitted = true;
      const payload = { ok: true, status: "paid", pdf_version: version };
      await event(
        db,
        adminSession,
        statementId,
        statement.merchant_id,
        "paid",
        "locked",
        "paid",
        {
          transfer_amount_minor: amount,
          transfer_date: transferDate,
          transfer_reference: reference,
          pdf_version: version,
        },
        key,
      );
      await completeOperation(db, "mark-paid", key, payload);
      return json(payload, 200, cors);
    } catch (error) {
      if (
        !dbCommitted &&
        r2Key &&
        typeof env.CONTRACTS_BUCKET?.delete === "function"
      )
        await env.CONTRACTS_BUCKET.delete(r2Key);
      await abandonOperation(db, "mark-paid", key);
      return json(
        { error: error.message || "標記匯款失敗。" },
        error.status || 409,
        cors,
      );
    }
  }

  if (action === "adjustments" && request.method === "POST") {
    const input = await readJson(request);
    const key = operationKey(request, input);
    const op = await beginOperation(
      db,
      adminSession,
      statement,
      "adjustment",
      key,
    );
    if (op.replay || op.error) return op.replay || op.error;
    try {
      if (!["locked", "paid"].includes(statement.status))
        throw Object.assign(
          new Error("只有鎖定或已付款對帳單可建立下一期調整。"),
          { status: 409 },
        );
      const amount = Number(input.amount_minor);
      const type = adjustmentTypes.has(input.adjustment_type)
        ? input.adjustment_type
        : null;
      const reason = safeText(input.reason, 500);
      if (!Number.isSafeInteger(amount) || amount === 0 || !type || !reason)
        throw Object.assign(new Error("調整資料格式錯誤。"), { status: 400 });
      const adjustmentId = uid("stad");
      await db
        .prepare(
          `INSERT INTO merchant_settlement_adjustments
        (id,merchant_id,source_settlement_id,adjustment_type,deposit_reversal_minor,platform_fee_reversal_minor,offset_reversal_minor,provider_fee_retained_minor,amount_minor,reason,source_reference,idempotency_key,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          adjustmentId,
          statement.merchant_id,
          statementId,
          type,
          Number(input.deposit_reversal_minor || 0),
          Number(input.platform_fee_reversal_minor || 0),
          Number(input.offset_reversal_minor || 0),
          Number(input.provider_fee_retained_minor || 0),
          amount,
          reason,
          safeText(input.source_reference, 150) || null,
          key,
          actor(adminSession),
        )
        .run();
      const payload = {
        id: adjustmentId,
        status: "pending",
        applies_to: "next_settlement",
      };
      await event(
        db,
        adminSession,
        statementId,
        statement.merchant_id,
        "adjustment_created",
        statement.status,
        statement.status,
        { adjustment_id: adjustmentId, amount_minor: amount, type },
        key,
      );
      await completeOperation(db, "adjustment", key, payload, 201);
      return json(payload, 201, cors);
    } catch (error) {
      await abandonOperation(db, "adjustment", key);
      return json(
        { error: error.message || "建立調整失敗。" },
        error.status || 400,
        cors,
      );
    }
  }

  if (action === "pdf" && request.method === "GET") {
    const requested = Number(
      url.searchParams.get("version") || statement.current_pdf_version || 0,
    );
    const document = await db
      .prepare(
        "SELECT * FROM settlement_document_versions WHERE settlement_id=? AND pdf_version=?",
      )
      .bind(statementId, requested)
      .first();
    if (!document || !env.CONTRACTS_BUCKET)
      return json({ error: "對帳單 PDF 尚未產生。" }, 404, cors);
    const object = await env.CONTRACTS_BUCKET.get(document.pdf_object_key);
    if (!object) return json({ error: "找不到私人 PDF。" }, 404, cors);
    return new Response(object.body, {
      headers: {
        ...cors,
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${statement.statement_no}-v${requested}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  }
  if (action === "csv" && request.method === "GET") {
    const items = await db
      .prepare(
        "SELECT * FROM merchant_settlement_items WHERE settlement_id=? ORDER BY occurred_at,id",
      )
      .bind(statementId)
      .all();
    const adjustments = await db
      .prepare(
        "SELECT * FROM merchant_settlement_adjustments WHERE source_settlement_id=? OR applied_settlement_id=? ORDER BY created_at",
      )
      .bind(statementId, statementId)
      .all();
    return new Response(
      settlementCsv(statement, items.results, adjustments.results),
      {
        headers: {
          ...cors,
          "content-type": "text/csv; charset=UTF-8",
          "content-disposition": `attachment; filename="${statement.statement_no}.csv"`,
          "cache-control": "private, no-store",
        },
      },
    );
  }
  return json({ error: "Method not allowed" }, 405, cors);
}
