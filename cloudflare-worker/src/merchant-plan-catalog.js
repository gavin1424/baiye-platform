import { ContractError, hashCanonical } from "./contract-engine.js";
import { COMMERCE_AI_PLAN_ID, commerceAiTermsSnapshot } from "./commerce-ai-contract.js";
import { SOFTPOS_PLAN_ID, softposCommercialTermsSnapshot } from "./merchant-softpos-plan.js";
import { STANDARD_MERCHANT_PLAN_CODE, standardCommercialTermsSnapshot } from "./merchant-standard-terms.js";

export const PUBLIC_PLAN_IDS = Object.freeze([
  STANDARD_MERCHANT_PLAN_CODE,
  COMMERCE_AI_PLAN_ID,
  SOFTPOS_PLAN_ID,
]);

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers },
});
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;

function publicPlan(row) {
  return {
    plan_id: row.plan_id,
    name: row.name,
    tagline: row.tagline,
    price_minor: Number(row.price_minor),
    currency: row.currency,
    term_months: Number(row.term_months),
    trial_months: Number(row.trial_months),
    activation_fee_minor: Number(row.activation_fee_minor),
    deposit_minor: Number(row.deposit_minor),
    cycle_fee_minor: Number(row.cycle_fee_minor),
    first_cycle_credit_minor: Number(row.first_cycle_credit_minor),
    first_cycle_balance_minor: Number(row.first_cycle_balance_minor),
    renewal_fee_minor: Number(row.renewal_fee_minor),
    contract_version: row.contract_version_id,
    features: JSON.parse(row.features_json || "{}"),
    installment_plan_requested: Number(row.installment_plan_available) === 1 ? 24 : null,
    payment_provider_ready: Number(row.payment_provider_ready) === 1,
  };
}

export async function listMerchantPlans(db) {
  const rows = await db.prepare("SELECT * FROM merchant_plan_catalog WHERE is_public=1 AND is_selectable=1 ORDER BY display_order").all();
  return (rows.results || []).map(publicPlan);
}

export async function findMerchantPlan(db, planId) {
  const row = await db.prepare("SELECT * FROM merchant_plan_catalog WHERE plan_id=? AND is_public=1 AND is_selectable=1").bind(String(planId || "")).first();
  return row ? publicPlan(row) : null;
}

export async function saveMerchantPlanIntent(db, merchantId, planId, source = "join") {
  if (!planId) return null;
  const plan = await findMerchantPlan(db, planId);
  if (!plan) throw new ContractError("PLAN_NOT_SELECTABLE", "所選方案不存在或目前不可選擇。", 422);
  await db.prepare(`INSERT INTO merchant_plan_intents(merchant_id,intended_plan_id,source)
    VALUES(?,?,?) ON CONFLICT(merchant_id) DO UPDATE SET intended_plan_id=excluded.intended_plan_id,source=excluded.source,updated_at=CURRENT_TIMESTAMP`)
    .bind(merchantId, plan.plan_id, String(source || "join").slice(0, 40)).run();
  return plan;
}

function snapshotFor(planId, now = new Date()) {
  if (planId === STANDARD_MERCHANT_PLAN_CODE) return standardCommercialTermsSnapshot(now);
  if (planId === COMMERCE_AI_PLAN_ID) return commerceAiTermsSnapshot(now);
  if (planId === SOFTPOS_PLAN_ID) return softposCommercialTermsSnapshot(now);
  throw new ContractError("PLAN_NOT_SELECTABLE", "所選方案不存在或目前不可選擇。", 422);
}

async function createTermsStatement(db, merchantId, plan, actorId, installmentPlanRequested) {
  const snapshot = { ...snapshotFor(plan.plan_id), installment_plan_requested: installmentPlanRequested };
  const termsHash = await hashCanonical(snapshot);
  const termsId = uid("mcterms_catalog");
  const servicePlanVersion = plan.plan_id === SOFTPOS_PLAN_ID ? SOFTPOS_PLAN_ID : null;
  const statement = db.prepare(`INSERT INTO merchant_contract_commercial_terms(
    id,merchant_id,plan_code,plan_name,list_price_minor,discount_price_minor,currency,
    contract_term_months,payment_plan,upfront_amount_minor,offset_target_amount_minor,
    tax_reserve_enabled,withholding_enabled,included_services_json,excluded_services_json,
    attachments_json,start_date,service_period_end,renewal_terms,custom_quote_reference,
    status,created_by,approved_by,approved_at,terms_hash,source_preset_id,service_plan_version_id,
    installment_plan_requested
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'approved',?,?,CURRENT_TIMESTAMP,?,?,?,?)`)
    .bind(
      termsId, merchantId, snapshot.plan_code, snapshot.plan_name, snapshot.list_price_minor,
      snapshot.discount_price_minor, snapshot.currency, snapshot.contract_term_months,
      snapshot.payment_plan, snapshot.upfront_amount_minor, snapshot.offset_target_amount_minor,
      snapshot.tax_reserve_enabled, snapshot.withholding_enabled,
      JSON.stringify(snapshot.included_services), JSON.stringify(snapshot.excluded_services),
      JSON.stringify(snapshot.attachments), snapshot.start_date, snapshot.service_period_end,
      snapshot.renewal_terms, snapshot.custom_quote_reference, actorId, actorId, termsHash,
      plan.plan_id, servicePlanVersion, installmentPlanRequested,
    );
  return { statement, termsId, termsHash, snapshot };
}

export async function merchantPlanState(db, merchantId) {
  const [selection, intent, signed] = await Promise.all([
    db.prepare(`SELECT s.*,c.name,c.tagline,c.price_minor,c.currency,c.term_months,c.trial_months,c.activation_fee_minor,
      c.deposit_minor,c.cycle_fee_minor,c.first_cycle_credit_minor,c.first_cycle_balance_minor,c.renewal_fee_minor,
      c.contract_version_id,c.features_json,c.installment_plan_available,c.payment_provider_ready
      FROM merchant_plan_selections s JOIN merchant_plan_catalog c ON c.plan_id=s.plan_id
      WHERE s.merchant_id=? AND s.status='assigned' ORDER BY s.assigned_at DESC LIMIT 1`).bind(merchantId).first(),
    db.prepare("SELECT intended_plan_id,source,confirmed_at FROM merchant_plan_intents WHERE merchant_id=?").bind(merchantId).first(),
    db.prepare(`SELECT s.id,s.public_id,s.signed_at,s.contract_version_id,t.plan_code
      FROM merchant_contract_signatures s JOIN merchant_contract_commercial_terms t ON t.id=s.commercial_terms_id AND t.merchant_id=s.merchant_id
      WHERE s.merchant_id=? AND s.status='VALID' ORDER BY s.signed_at DESC LIMIT 1`).bind(merchantId).first(),
  ]);
  return {
    selected_plan: selection ? publicPlan(selection) : null,
    intended_plan_id: intent?.intended_plan_id || null,
    signed_contract: signed || null,
  };
}

export async function merchantPlanEntitlements(db, merchantId) {
  let row = await db.prepare(`SELECT c.plan_id,c.features_json FROM merchant_plan_selections s
    JOIN merchant_plan_catalog c ON c.plan_id=s.plan_id WHERE s.merchant_id=? AND s.status='assigned'
    ORDER BY s.assigned_at DESC LIMIT 1`).bind(merchantId).first();
  if (!row) {
    const legacy = await db.prepare(`SELECT e.plan_id,e.commerce_full,e.cart,e.merchant_product_edit,e.merchant_content_editable,e.merchant_product_editable
      FROM merchant_plan_entitlements e JOIN merchant_plan_assignments a ON a.id=e.assignment_id
      WHERE e.merchant_id=? AND a.status='assigned' ORDER BY a.assigned_at DESC LIMIT 1`).bind(merchantId).first();
    if (legacy) row = { plan_id: legacy.plan_id, features_json: JSON.stringify({ commerce_full: Number(legacy.commerce_full) === 1, cart_enabled: Number(legacy.cart) === 1, merchant_product_editable: Number(legacy.merchant_product_editable) === 1 || Number(legacy.merchant_product_edit) === 1, merchant_content_editable: Number(legacy.merchant_content_editable) === 1, ordering_enabled: true }) };
  }
  const features = row ? JSON.parse(row.features_json || "{}") : {};
  return {
    plan_id: row?.plan_id || null,
    merchant_content_editable: features.merchant_content_editable === true,
    merchant_product_editable: features.merchant_product_editable === true,
    merchant_product_edit: features.merchant_product_editable === true,
    commerce_full: features.commerce_full === true,
    cart: features.cart_enabled === true,
    cart_enabled: features.cart_enabled === true,
    softpos_enabled: features.softpos_enabled === true,
    ordering_enabled: features.ordering_enabled === true,
    kds_enabled: features.kds_enabled === true,
    base_product_limit: Number(features.base_product_limit || 0),
  };
}

export async function assignMerchantPlan(db, merchantId, actorId, planId, installmentRequested = 24) {
  const plan = await findMerchantPlan(db, planId);
  if (!plan) throw new ContractError("PLAN_NOT_SELECTABLE", "所選方案不存在或目前不可選擇。", 422);
  if (installmentRequested !== 24) throw new ContractError("INSTALLMENT_PLAN_INVALID", "目前只可提出信用卡 24 期零利率申請。", 422);
  const state = await merchantPlanState(db, merchantId);
  if (state.signed_contract) {
    if (state.signed_contract.plan_code !== plan.plan_id) {
      throw new ContractError("ACTIVE_PLAN_EXISTS", "您目前已有有效方案。方案升級或變更須走 Plan Change／Upgrade／Addendum，不會覆寫舊契約。", 409, { current_plan_id: state.signed_contract.plan_code });
    }
    return { code: "PLAN_ALREADY_SIGNED", plan, signed_contract: state.signed_contract, next_url: "/merchant/contracts" };
  }
  if (state.selected_plan?.plan_id === plan.plan_id) {
    return { code: "PLAN_ALREADY_ASSIGNED", plan: state.selected_plan, next_url: "/merchant/contract" };
  }

  const { statement, termsId, termsHash } = await createTermsStatement(db, merchantId, plan, actorId, installmentRequested);
  const selectionId = uid("mplan_selection");
  const inviteId = uid("mcinvite_catalog");
  const inviteHash = await hashCanonical({ inviteId, merchantId, termsId, nonce: crypto.randomUUID() });
  const statements = [
    statement,
    db.prepare("UPDATE merchant_plan_selections SET status='superseded',superseded_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND status='assigned'").bind(merchantId),
    db.prepare("INSERT INTO merchant_plan_selections(id,merchant_id,plan_id,commercial_terms_id,status,assigned_by,installment_plan_requested) VALUES(?,?,?,?,'assigned',?,?)")
      .bind(selectionId, merchantId, plan.plan_id, termsId, actorId, installmentRequested),
    db.prepare("INSERT INTO merchant_contract_invites(id,merchant_id,commercial_terms_id,email,token_hash,expires_at,used_at,created_by) VALUES(?,?,?,'',?,'2099-12-31T23:59:59.000Z',CURRENT_TIMESTAMP,'system_plan_catalog')")
      .bind(inviteId, merchantId, termsId, inviteHash),
    db.prepare("UPDATE merchant_plan_intents SET intended_plan_id=?,confirmed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=?").bind(plan.plan_id, merchantId),
    db.prepare("UPDATE merchant_onboarding_states SET state='contract_required',operation_locked=1,commercial_terms_approval_required=0,commercial_terms_id=?,contract_signed_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=?")
      .bind(termsId, merchantId),
    db.prepare("UPDATE merchants SET status='contract_required',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(merchantId),
  ];

  if (plan.plan_id === COMMERCE_AI_PLAN_ID) {
    const legacyAssignmentId = uid("mplan");
    statements.push(
      db.prepare("UPDATE merchant_plan_assignments SET status='superseded',superseded_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND status='assigned'").bind(merchantId),
      db.prepare("INSERT INTO merchant_plan_assignments(id,merchant_id,plan_id,commercial_terms_id,status,assigned_by) VALUES(?,?,?,?,'assigned',?)")
        .bind(legacyAssignmentId, merchantId, plan.plan_id, termsId, actorId),
      db.prepare(`INSERT INTO merchant_plan_entitlements(assignment_id,merchant_id,plan_id,commerce_full,cart,merchant_product_edit,merchant_content_editable,merchant_product_editable)
        VALUES(?,?,?,1,1,1,1,1)`).bind(legacyAssignmentId, merchantId, plan.plan_id),
    );
  }

  await db.batch(statements);
  return {
    code: "PLAN_ASSIGNED",
    plan,
    commercial_terms_id: termsId,
    terms_hash: termsHash,
    installment_plan_requested: installmentRequested,
    payment_provider_ready: plan.payment_provider_ready,
    payment_transaction_created: false,
    next_url: "/merchant/contract",
  };
}

function errorResponse(error, cors) {
  if (error instanceof ContractError) return json({ error: error.message, code: error.code, details: error.details }, error.status, cors);
  console.error(JSON.stringify({ service: "merchant_plan_catalog", error: error instanceof Error ? error.message : "unknown" }));
  return json({ error: "商家方案服務暫時無法使用。", code: "PLAN_SERVICE_ERROR" }, 503, cors);
}

export async function handleMerchantPlansPublic(request, env, url, cors = {}) {
  if (url.pathname !== "/api/public/merchant-plans" || request.method !== "GET") return null;
  try { return json({ plans: await listMerchantPlans(env.FINANCE_DB) }, 200, cors); }
  catch (error) { return errorResponse(error, cors); }
}

export async function handleMerchantPlans(request, env, url, cors, authorization) {
  try {
    if (url.pathname === "/api/merchant/plans" && request.method === "GET") {
      const [plans, state] = await Promise.all([listMerchantPlans(env.FINANCE_DB), merchantPlanState(env.FINANCE_DB, authorization.session.merchant_id)]);
      return json({ plans, ...state }, 200, cors);
    }
    if (url.pathname === "/api/merchant/plans/select" && request.method === "POST") {
      const input = await request.json().catch(() => ({}));
      const result = await assignMerchantPlan(env.FINANCE_DB, authorization.session.merchant_id, authorization.session.user_id, input.plan_id, Number(input.installment_plan_requested ?? 24));
      return json(result, result.code === "PLAN_ASSIGNED" ? 201 : 200, cors);
    }
    return null;
  } catch (error) { return errorResponse(error, cors); }
}
