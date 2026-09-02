import { authorizeMerchant, createPasswordlessMerchantOwner, issueMerchantSession, merchantSessionCookie } from "./merchant-auth.js";
import {
  ContractError,
  STANDARD_ASSURANCE,
  assertContractSignable,
  beginContractOperation,
  buildSignedAgreement,
  completeContractOperation,
  hashCanonical,
  parseAndValidateSignature,
  publicVerificationRecord,
  sessionEvidenceHash,
  storePrivateAgreementArtifacts,
  validateExplicitConsents,
} from "./contract-engine.js";
import { sha256 } from "./contract-pdf.js";
import { ensurePlatformMember, finalizePlatformMembershipBatch, normalizeTaiwanMobile, preparePlatformMembershipBatch } from "./platform-membership.js";
import { isStandardCommercialTerms } from "./merchant-standard-terms.js";
import { MERCHANT_SERVICE_V11_ID, MERCHANT_SERVICE_V11_TITLE, merchantServiceV11AttachmentA } from "./merchant-contract-v11.js";
import { COMMERCE_AI_CONTRACT_ID, COMMERCE_AI_PLAN_ID, buildCommerceAiAssignment, commerceAiAttachmentA } from "./commerce-ai-contract.js";
import { findMerchantPlan } from "./merchant-plan-catalog.js";
import {
  SOFTPOS_CONTRACT_VERSION_ID,
  declineSoftposRenewal,
  ensureSoftposCommercialTerms,
  getSoftposRenewal,
  isSoftposCommercialTerms,
  prepareSoftposRenewal,
  softposAttachmentA,
  softposPlanSummary,
  softposTrialStatement,
} from "./merchant-softpos-plan.js";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const makeId = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const ip = (request) => request.headers.get("CF-Connecting-IP") || null;
const body = (request) => request.json().catch(() => ({}));
const tokenHash = (value) => sha256(`merchant-contract-invite-v1:${value}`);
const merchantConsentVersion = (contractId) => contractId === SOFTPOS_CONTRACT_VERSION_ID
  ? "merchant-softpos-consent-v1.0"
  : contractId === COMMERCE_AI_CONTRACT_ID
    ? "merchant-commerce-ai-consent-v1.0"
    : "merchant-standard-addons-consent-v1.2";
const requiresConfiguredLegalEntity = (contractId) => [MERCHANT_SERVICE_V11_ID, "merchant_service_v1_2_18000_addons", COMMERCE_AI_CONTRACT_ID, SOFTPOS_CONTRACT_VERSION_ID].includes(contractId);

function errorResponse(error, cors) {
  if (error instanceof ContractError) return json({ error: error.message, code: error.code, details: error.details }, error.status, cors);
  console.error(JSON.stringify({ service: "merchant_contract", error: error instanceof Error ? error.message : "unknown" }));
  return json({ error: "契約系統暫時無法完成此操作。", code: "CONTRACT_SERVICE_ERROR" }, 503, cors);
}

async function contractEvent(db, request, { merchantId, signatureId = null, inviteId = null, actorType, actorId, action, metadata = {} }) {
  await db.prepare("INSERT INTO merchant_contract_events(id,merchant_id,signature_id,invite_id,actor_type,actor_id,action,metadata_json,ip_address) VALUES(?,?,?,?,?,?,?,?,?)")
    .bind(makeId("mce"), merchantId, signatureId, inviteId, actorType, actorId, action, JSON.stringify(metadata), ip(request)).run();
}

async function audit(db, request, actorType, actorId, action, entityType, entityId, metadata = {}) {
  await db.prepare("INSERT INTO audit_logs(id,actor_type,actor_id,action,entity_type,entity_id,metadata,ip_address) VALUES(?,?,?,?,?,?,?,?)")
    .bind(makeId("audit"), actorType, actorId, action, entityType, entityId, JSON.stringify(metadata), ip(request)).run();
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function validateCommercialTerms(input) {
  const plan = String(input.payment_plan || "");
  if (!['upfront_18000','sales_offset_18000'].includes(plan)) throw new ContractError("PAYMENT_PLAN_INVALID", "付款方案不正確。", 422);
  const integer = (value, name) => {
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result < 0) throw new ContractError("AMOUNT_INVALID", `${name}金額格式不正確。`, 422);
    return result;
  };
  const result = {
    plan_code: String(input.plan_code || "AI_DIGITAL_PROMOTION_2026").slice(0, 80),
    plan_name: String(input.plan_name || "創百業智慧鏈｜AI 行銷推廣及數位服務方案").slice(0, 160),
    list_price_minor: integer(input.list_price_minor ?? 3000000, "方案定價"),
    discount_price_minor: integer(input.discount_price_minor ?? 1800000, "優惠價"),
    currency: "TWD",
    contract_term_months: Number(input.contract_term_months || 24),
    payment_plan: plan,
    upfront_amount_minor: plan === "upfront_18000" ? integer(input.upfront_amount_minor ?? input.discount_price_minor ?? 1800000, "一次付款") : 0,
    offset_target_amount_minor: plan === "sales_offset_18000" ? integer(input.offset_target_amount_minor ?? input.discount_price_minor ?? 1800000, "抵付目標") : 0,
    tax_reserve_enabled: input.tax_reserve_enabled === true ? 1 : 0,
    withholding_enabled: input.withholding_enabled === true ? 1 : 0,
    included_services: Array.isArray(input.included_services) ? input.included_services.map(String) : [],
    excluded_services: Array.isArray(input.excluded_services) ? input.excluded_services.map(String) : [],
    attachments: input.attachments && typeof input.attachments === "object" ? input.attachments : {},
    start_date: String(input.start_date || ""),
    service_period_end: String(input.service_period_end || ""),
    renewal_terms: String(input.renewal_terms || "").slice(0, 2000),
    custom_quote_reference: input.custom_quote_reference ? String(input.custom_quote_reference).slice(0, 120) : null,
  };
  if (!Number.isInteger(result.contract_term_months) || result.contract_term_months < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(result.start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(result.service_period_end)) {
    throw new ContractError("COMMERCIAL_TERMS_INVALID", "請完整設定服務期間與契約月數。", 422);
  }
  if (result.tax_reserve_enabled || result.withholding_enabled) throw new ContractError("ACCOUNTING_REVIEW_REQUIRED", "稅務預留或扣繳須另經會計專業覆核，本契約 V1 預設不得啟用。", 409);
  return result;
}

function commercialAttachments(terms, contract, plan = null) {
  if (contract?.id === SOFTPOS_CONTRACT_VERSION_ID) return softposAttachmentA(terms, plan);
  if (contract?.id === COMMERCE_AI_CONTRACT_ID) return commerceAiAttachmentA(terms);
  if (contract?.id === MERCHANT_SERVICE_V11_ID) return merchantServiceV11AttachmentA(terms);
  const included = JSON.parse(terms.included_services_json || "[]");
  const excluded = JSON.parse(terms.excluded_services_json || "[]");
  const configured = JSON.parse(terms.attachments_json || "{}");
  const money = (minor) => `NT$${Math.round(Number(minor || 0) / 100).toLocaleString("en-US")}`;
  if (contract?.id === "merchant_service_v1_2_18000_addons") {
    return [
      { title: "附件 A｜標準方案商業條件", content: `方案：${terms.plan_name}\n固定價格：${money(1800000)}\n服務期間：24 個月\n基礎商品／服務：20 項\n網站主要內容、商品主要建檔與版型由百工協助修改\nmerchant_content_editable：false\n服務期間：${terms.start_date} 至 ${terms.service_period_end}` },
      { title: "加購說明", content: "本次主契約沒有加購時，不產生附件 B。日後加購須另經百工報價、商家接受及補充協議簽署。" },
    ];
  }
  return [
    { title: "附件 A｜商業條件", content: `方案：${terms.plan_name}\n定價：${money(terms.list_price_minor)}\n本契約價：${money(terms.discount_price_minor)}\n付款方式：${terms.payment_plan === "upfront_18000" ? "一次付清方案" : "銷售抵付方案"}\n服務期間：${terms.start_date} 至 ${terms.service_period_end}\n續約：${terms.renewal_terms}` },
    { title: "附件 B｜正式交付項目", content: included.join("\n") || "依核准服務清單" },
    { title: "附件 C｜不包含／需另報價項目", content: excluded.join("\n") || "超出標準規格之客製需求另行報價" },
    { title: "附件 D｜驗收標準", content: String(configured.acceptance || "依雙方核准之交付清單逐項驗收") },
    { title: "附件 E｜第三方服務與費用", content: String(configured.third_party || "實際啟用、費率、審核與服務條件依第三方業者及個別契約為準") },
  ];
}

function missingLegalEntityFields(entity) {
  const labels = { legal_name: "甲方公司／商號正式名稱", tax_id: "統一編號", responsible_person: "負責人", registered_address: "登記地址", support_contact: "客服資訊" };
  return Object.keys(labels).filter((key) => !String(entity?.[key] || "").trim()).map((key) => ({ key, label: labels[key] }));
}

async function platformLegalEntity(db) {
  const entity = await db.prepare("SELECT legal_name,tax_id,responsible_person,registered_address,support_contact,updated_at FROM platform_contract_legal_entity_configs WHERE id='default'").first();
  const missing = missingLegalEntityFields(entity);
  return { entity: entity || null, configured: missing.length === 0, missing_fields: missing };
}

function assertLegalEntityConfigured(legalEntity) {
  if (!legalEntity?.configured) throw new ContractError("PLATFORM_LEGAL_ENTITY_CONFIGURATION_REQUIRED", "平台法律主體設定尚未完成，暫時無法建立正式簽署文件。", 409, { missing_fields: legalEntity?.missing_fields || [] });
  return legalEntity.entity;
}

function merchantPartySnapshot(merchant, legalEntity, input) {
  return {
    platform: {
      legal_name: legalEntity.legal_name,
      tax_id: legalEntity.tax_id,
      responsible_person: legalEntity.responsible_person,
      registered_address: legalEntity.registered_address,
      support_contact: legalEntity.support_contact,
    },
    merchant: {
      name: merchant.name,
      tax_id: String(input.tax_id || "").trim() || null,
      legal_representative_name: String(input.legal_representative_name || input.signatory_legal_name || "").trim(),
      signatory_legal_name: String(input.signatory_legal_name || "").trim(),
      signatory_role: input.signatory_role,
    },
  };
}

function merchantPartyLabel(snapshot) {
  return `甲方：${snapshot.platform.legal_name}（統一編號：${snapshot.platform.tax_id}；負責人：${snapshot.platform.responsible_person}；地址：${snapshot.platform.registered_address}；客服：${snapshot.platform.support_contact}）\n乙方：${snapshot.merchant.name}${snapshot.merchant.tax_id ? `（統一編號：${snapshot.merchant.tax_id}）` : ""}`;
}

function commercialTermsSnapshot(terms) {
  const snapshot = {
    plan_code: terms.plan_code,
    plan_name: terms.plan_name,
    list_price_minor: Number(terms.list_price_minor),
    discount_price_minor: Number(terms.discount_price_minor),
    currency: terms.currency,
    contract_term_months: Number(terms.contract_term_months),
    payment_plan: terms.payment_plan,
    upfront_amount_minor: Number(terms.upfront_amount_minor),
    offset_target_amount_minor: Number(terms.offset_target_amount_minor),
    tax_reserve_enabled: Number(terms.tax_reserve_enabled),
    withholding_enabled: Number(terms.withholding_enabled),
    included_services: Array.isArray(terms.included_services) ? terms.included_services : JSON.parse(terms.included_services_json || "[]"),
    excluded_services: Array.isArray(terms.excluded_services) ? terms.excluded_services : JSON.parse(terms.excluded_services_json || "[]"),
    attachments: terms.attachments && typeof terms.attachments === "object" ? terms.attachments : JSON.parse(terms.attachments_json || "{}"),
    start_date: terms.start_date,
    service_period_end: terms.service_period_end,
    renewal_terms: terms.renewal_terms,
    custom_quote_reference: terms.custom_quote_reference || null,
  };
  if (terms.installment_plan_requested != null) snapshot.installment_plan_requested = Number(terms.installment_plan_requested);
  return snapshot;
}

async function currentMerchantContract(db, env, planCode = null) {
  const contractIds = {
    AI_DIGITAL_PROMOTION_2026: "merchant_service_v1_0",
    baiye_standard_18000: MERCHANT_SERVICE_V11_ID,
    baiye_standard_18000_addons: "merchant_service_v1_2_18000_addons",
    [COMMERCE_AI_PLAN_ID]: COMMERCE_AI_CONTRACT_ID,
    baiye_softpos_24000: SOFTPOS_CONTRACT_VERSION_ID,
  };
  const contractId = contractIds[planCode];
  if (env.CONTRACT_SIGNING_MODE === "staging") {
    if (contractId) return db.prepare("SELECT * FROM merchant_contract_versions WHERE id=? AND (is_active=1 OR staging_signing_enabled=1)").bind(contractId).first();
    return db.prepare("SELECT * FROM merchant_contract_versions WHERE is_active=1 OR staging_signing_enabled=1 ORDER BY staging_signing_enabled DESC,effective_date DESC,created_at DESC LIMIT 1").first();
  }
  return contractId
    ? db.prepare("SELECT * FROM merchant_contract_versions WHERE id=? AND is_active=1 AND legal_review_status='approved'").bind(contractId).first()
    : db.prepare("SELECT * FROM merchant_contract_versions WHERE is_active=1 AND legal_review_status='approved' ORDER BY effective_date DESC,created_at DESC LIMIT 1").first();
}

async function currentTerms(db, merchantId) {
  const assigned = await db.prepare(`SELECT t.* FROM merchant_onboarding_states o JOIN merchant_contract_commercial_terms t
    ON t.id=o.commercial_terms_id AND t.merchant_id=o.merchant_id
    WHERE o.merchant_id=? AND t.status='approved' LIMIT 1`).bind(merchantId).first();
  if (assigned) return assigned;
  const onboarding = await db.prepare("SELECT commercial_terms_id FROM merchant_onboarding_states WHERE merchant_id=?").bind(merchantId).first();
  if (onboarding) return null;
  return db.prepare("SELECT * FROM merchant_contract_commercial_terms WHERE merchant_id=? AND status='approved' ORDER BY approved_at DESC,created_at DESC LIMIT 1").bind(merchantId).first();
}

async function merchantContractContext(db, session, env) {
  if (!String(session.roles || "").split(",").includes("owner")) throw new ContractError("MERCHANT_OWNER_REQUIRED", "僅商家管理者帳號可進行契約簽署。", 403);
  const onboarding = await db.prepare("SELECT registration_mode,commercial_terms_approval_required FROM merchant_onboarding_states WHERE merchant_id=?").bind(session.merchant_id).first();
  let terms = await currentTerms(db, session.merchant_id);
  if (!terms) {
    if (Number(onboarding?.commercial_terms_approval_required) === 1) throw new ContractError("ADMIN_COMMERCIAL_TERMS_APPROVAL", "商業條件尚未經管理員核准。", 409);
    throw new ContractError("PLAN_SELECTION_REQUIRED", "請先選擇並確認商家服務方案。", 409);
  }
  const contract = await currentMerchantContract(db, env, terms.plan_code);
  if (!contract) {
    const latest = await db.prepare("SELECT * FROM merchant_contract_versions WHERE id IN ('merchant_service_v1_2_18000_addons','merchant_commerce_ai_v1_0_45000','merchant_softpos_v1_0_24000') ORDER BY effective_date DESC,created_at DESC LIMIT 1").first();
    if (latest?.legal_review_status !== "approved" && env.CONTRACT_SIGNING_MODE !== "staging") throw new ContractError("LEGAL_REVIEW_REQUIRED", "此契約版本尚未完成正式法律審閱，目前不可簽署。", 423);
    throw new ContractError("CONTRACT_NOT_ACTIVE", "目前沒有可簽署的商家服務契約。", 409);
  }
  assertContractSignable(contract, env);
  const softpos = contract.id === SOFTPOS_CONTRACT_VERSION_ID;
  if (softpos && !isSoftposCommercialTerms(terms)) throw new ContractError("SOFTPOS_TERMS_MISMATCH", "SoftPOS 方案商業條件不一致，已停止簽署。", 409);
  if (terms.plan_code === "baiye_standard_18000_addons" && !isStandardCommercialTerms(terms)) throw new ContractError("STANDARD_TERMS_MISMATCH", "標準方案商業條件不一致，已停止簽署。", 409);
  if (terms.plan_code === COMMERCE_AI_PLAN_ID && (Number(terms.discount_price_minor) !== 4500000 || Number(terms.list_price_minor) !== 4500000)) throw new ContractError("COMMERCE_TERMS_MISMATCH", "AI 智慧商城方案商業條件不一致，已停止簽署。", 409);
  const catalogPlan = await findMerchantPlan(db, terms.plan_code);
  if (["baiye_standard_18000_addons", COMMERCE_AI_PLAN_ID, "baiye_softpos_24000"].includes(terms.plan_code) && (!catalogPlan || catalogPlan.contract_version !== contract.id)) throw new ContractError("PLAN_CONTRACT_MISMATCH", "方案與契約版本不一致，已停止簽署。", 409);
  const merchant = await db.prepare("SELECT id,name,merchant_code,contact_name,phone,email,status FROM merchants WHERE id=?").bind(session.merchant_id).first();
  let invite = await db.prepare("SELECT * FROM merchant_contract_invites WHERE merchant_id=? AND commercial_terms_id=? AND used_at IS NOT NULL AND revoked_at IS NULL ORDER BY used_at DESC LIMIT 1")
    .bind(session.merchant_id, terms.id).first();
  if (!invite && softpos) invite = await db.prepare("SELECT * FROM merchant_contract_invites WHERE merchant_id=? AND used_at IS NOT NULL AND revoked_at IS NULL ORDER BY used_at DESC LIMIT 1").bind(session.merchant_id).first();
  if (!merchant || !invite) throw new ContractError("MERCHANT_INVITE_REQUIRED", "找不到已完成的商家啟用邀請。", 403);
  return { contract, terms, merchant, invite, legal_entity: await platformLegalEntity(db), catalog_plan: catalogPlan, plan: softpos ? await softposPlanSummary(db) : null };
}

export async function handleMerchantContractPublic(request, env, url, cors = {}) {
  const db = env.FINANCE_DB;
  try {
    if (url.pathname === "/api/merchant/contracts/invite/validate" && request.method === "POST") {
      const input = await body(request); const hashed = await tokenHash(String(input.token || ""));
      const invite = await db.prepare("SELECT i.id,i.merchant_id,i.email,i.expires_at,m.name merchant_name,t.plan_name,t.discount_price_minor,t.currency FROM merchant_contract_invites i JOIN merchants m ON m.id=i.merchant_id JOIN merchant_contract_commercial_terms t ON t.id=i.commercial_terms_id AND t.merchant_id=i.merchant_id WHERE i.token_hash=? AND i.used_at IS NULL AND i.revoked_at IS NULL AND datetime(i.expires_at)>datetime('now') AND t.status='approved'").bind(hashed).first();
      if (!invite) throw new ContractError("INVITE_INVALID", "商家啟用連結無效、已使用或已過期。", 401);
      return json(invite, 200, cors);
    }
    if (url.pathname === "/api/merchant/contracts/accept-invite" && request.method === "POST") {
      const input = await body(request); const hashed = await tokenHash(String(input.token || ""));
      const phone = normalizeTaiwanMobile(input.phone);
      if (!phone) throw new ContractError("INVALID_PHONE", "請輸入正確的台灣手機號碼。", 422);
      if (input.privacy_consent !== true || !String(input.consent_version || "").trim()) throw new ContractError("PRIVACY_CONSENT_REQUIRED", "請閱讀並同意會員服務、隱私權說明及商家平台相關條款。", 422);
      const invite = await db.prepare("SELECT i.*,t.custom_quote_reference FROM merchant_contract_invites i JOIN merchant_contract_commercial_terms t ON t.id=i.commercial_terms_id AND t.merchant_id=i.merchant_id WHERE i.token_hash=? AND i.revoked_at IS NULL AND datetime(i.expires_at)>datetime('now')").bind(hashed).first();
      if (!invite) throw new ContractError("INVITE_INVALID", "商家啟用連結無效、已使用或已過期。", 401);
      const operation = await beginContractOperation(db, { partyType: "merchant", partyId: invite.merchant_id, operationType: "invite_accept", idempotencyKey: request.headers.get("idempotency-key") || "" });
      if (operation.replay) return json(operation.result, 200, cors);
      if (invite.used_at) throw new ContractError("INVITE_ALREADY_USED", "此啟用連結已使用，請直接登入商家後台。", 409);
      const membership = await ensurePlatformMember(db, { phone, source: "phone", privacyConsentVersion: String(input.consent_version), originVerified: true, deviceId: request.headers.get("x-device-id") || "merchant-invite", issueSession: true });
      const owner = await createPasswordlessMerchantOwner(db, { request, merchantId: invite.merchant_id, platformMember: membership.member, phone, email: invite.email });
      if (!owner.created) throw new ContractError("MERCHANT_ALREADY_REGISTERED", "此商家管理者已完成註冊，請直接登入。", 409);
      const merchantSession = await issueMerchantSession(db, { merchantId: invite.merchant_id, userId: owner.userId, platformMemberId: membership.member.id, assuranceLevel: "activation_invite", issuedVia: "merchant_contract_invite" });
      await db.batch([
        db.prepare("UPDATE merchant_contract_invites SET used_at=CURRENT_TIMESTAMP WHERE id=? AND used_at IS NULL").bind(invite.id),
        db.prepare("UPDATE merchants SET phone=COALESCE(phone,?),status='contract_required',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(phone, invite.merchant_id),
        db.prepare("INSERT INTO merchant_onboarding_states(merchant_id,registration_mode,state,operation_locked,commercial_terms_approval_required,commercial_terms_id) VALUES(?,CASE WHEN ? IS NULL THEN 'standard_self_service' ELSE 'custom_quote' END,'contract_required',1,CASE WHEN ? IS NULL THEN 0 ELSE 1 END,?) ON CONFLICT(merchant_id) DO UPDATE SET state='contract_required',operation_locked=1,commercial_terms_id=excluded.commercial_terms_id,updated_at=CURRENT_TIMESTAMP")
          .bind(invite.merchant_id, invite.custom_quote_reference || null, invite.custom_quote_reference || null, invite.commercial_terms_id),
      ]);
      await contractEvent(db, request, { merchantId: invite.merchant_id, inviteId: invite.id, actorType: "merchant", actorId: owner.userId, action: "merchant.activation_invite_used", metadata: { member_id: membership.member.id } });
      const result = { ok: true, merchant_id: invite.merchant_id, membership: { member_id: membership.member.id, member_no: membership.member.member_no, created: membership.created }, member_session: membership.session, welcome: membership.welcome, coupon: membership.coupon, csrf_token: merchantSession.csrf, next_url: "/merchant/contract" }; await completeContractOperation(db, operation.operation.id, result); return json(result, 201, { ...cors, "set-cookie": merchantSessionCookie(merchantSession.raw) });
    }
    return null;
  } catch (error) { return errorResponse(error, cors); }
}

export async function handleMerchantContractRequest(request, env, url, cors = {}, authorization = null) {
  const db = env.FINANCE_DB;
  try {
    const auth = authorization || await authorizeMerchant(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status, cors);
    const session = auth.session;
    if (url.pathname === "/api/merchant/contracts/current" && request.method === "GET") {
      const context = await merchantContractContext(db, session, env);
      const signature = await db.prepare("SELECT id,public_id,signed_at,status,pdf_hash FROM merchant_contract_signatures WHERE merchant_id=? AND contract_version_id=? AND status='VALID'").bind(session.merchant_id, context.contract.id).first();
      const renewal = context.plan ? await getSoftposRenewal(db, session.merchant_id) : null;
      return json({ contract: context.contract, terms: context.terms, merchant: context.merchant, legal_entity: context.legal_entity, catalog_plan: context.catalog_plan, plan: context.plan, renewal, attachments: commercialAttachments(context.terms, context.contract, context.plan), staging: env.CONTRACT_SIGNING_MODE === "staging", signed: Boolean(signature), signature }, 200, cors);
    }
    if (url.pathname === "/api/merchant/contracts/renewal" && request.method === "GET") {
      const renewal = await getSoftposRenewal(db, session.merchant_id);
      if (!renewal) throw new ContractError("SOFTPOS_SUBSCRIPTION_MISSING", "找不到 SoftPOS 試用與續約狀態。", 404);
      return json({ ...renewal, plan: await softposPlanSummary(db) }, 200, cors);
    }
    if (url.pathname === "/api/merchant/contracts/renewal/prepare" && request.method === "POST") {
      const cycle = await prepareSoftposRenewal(db, session.merchant_id);
      const plan = await softposPlanSummary(db);
      await contractEvent(db, request, { merchantId: session.merchant_id, actorType: "merchant", actorId: session.user_id, action: "merchant_softpos_renewal_prepared", metadata: { cycle_id: cycle.id, cycle_number: cycle.cycle_number, balance_due_minor: cycle.balance_due_minor, payment_transaction_created: false } });
      return json({ cycle, plan, payment_provider: plan.payment_provider }, 201, cors);
    }
    if (url.pathname === "/api/merchant/contracts/renewal/decline" && request.method === "POST") {
      const result = await declineSoftposRenewal(db, session.merchant_id);
      await contractEvent(db, request, { merchantId: session.merchant_id, actorType: "merchant", actorId: session.user_id, action: "merchant_softpos_renewal_declined", metadata: { operation_locked: true, evidence_preserved: true } });
      return json(result, 200, cors);
    }
    if (url.pathname === "/api/merchant/contracts" && request.method === "GET") {
      const rows = await db.prepare("SELECT s.id,s.public_id,s.signed_at,s.status,s.pdf_hash,v.version,v.title FROM merchant_contract_signatures s JOIN merchant_contract_versions v ON v.id=s.contract_version_id WHERE s.merchant_id=? ORDER BY s.signed_at DESC").bind(session.merchant_id).all();
      return json({ items: rows.results }, 200, cors);
    }
    if (url.pathname === "/api/merchant/contracts/sign-preview" && request.method === "POST") {
      const input = await body(request); const context = await merchantContractContext(db, session, env);
      if (!normalizeTaiwanMobile(context.merchant.phone)) throw new ContractError("MERCHANT_CONTACT_PHONE_REQUIRED", "商家聯絡手機資料不完整，請先聯絡平台更新後再簽署。", 422);
      const termsHash = await hashCanonical(commercialTermsSnapshot(context.terms));
      if (termsHash !== context.terms.terms_hash) throw new ContractError("COMMERCIAL_TERMS_HASH_MISMATCH", "商業條件雜湊不一致，已停止簽署。", 409);
      const legalEntity = requiresConfiguredLegalEntity(context.contract.id) ? assertLegalEntityConfigured(context.legal_entity) : null;
      if (!String(input.signatory_legal_name || "").trim()) throw new ContractError("SIGNATORY_REQUIRED", "請填寫簽署人法定姓名。", 422);
      if (!['legal_representative','authorized_representative'].includes(input.signatory_role)) throw new ContractError("SIGNATORY_ROLE_INVALID", "請確認簽署人身份。", 422);
      if (input.signatory_role === "authorized_representative" && input.authorization_confirmed !== true) throw new ContractError("AUTHORIZATION_REQUIRED", "受授權代表須確認已取得合法簽約授權。", 422);
      const consents = { read: input.read, electronic: input.electronic, commercial_terms: input.commercial_terms, authority: input.authority, signature_evidence: input.signature_evidence };
      validateExplicitConsents(consents, "merchant", merchantConsentVersion(context.contract.id));
      parseAndValidateSignature(input.signature, { minimumStrokes: 2, minimumPoints: 12 });
      // Preview validates the exact signing payload but never creates an artifact.
      return json({ version: context.contract.version, company_name: context.merchant.name, signatory: String(input.signatory_legal_name || session.display_name), signatory_role: input.signatory_role, legal_representative_name: input.legal_representative_name, plan_name: context.terms.plan_name, total_minor: context.plan?.first_cycle_balance ?? context.terms.discount_price_minor, payment_plan: context.terms.payment_plan, term_months: Number(context.terms.contract_term_months), period: { start: context.terms.start_date, end: context.terms.service_period_end }, plan: context.plan, legal_entity: legalEntity ? { legal_name: legalEntity.legal_name, tax_id: legalEntity.tax_id } : null, attachments: commercialAttachments(context.terms, context.contract, context.plan) }, 200, cors);
    }
    if (url.pathname === "/api/merchant/contracts/sign" && request.method === "POST") {
      const input = await body(request); const context = await merchantContractContext(db, session, env);
      if (!normalizeTaiwanMobile(context.merchant.phone)) throw new ContractError("MERCHANT_CONTACT_PHONE_REQUIRED", "商家聯絡手機資料不完整，請先聯絡平台更新後再簽署。", 422);
      const operation = await beginContractOperation(db, { partyType: "merchant", partyId: session.merchant_id, operationType: "sign", idempotencyKey: request.headers.get("idempotency-key") || "" });
      if (operation.replay) return json({ ...operation.result, member_session: null, welcome: { show: false }, replay: true }, 200, cors);
      const existing = await db.prepare("SELECT id,public_id,document_hash FROM merchant_contract_signatures WHERE merchant_id=? AND contract_version_id=?").bind(session.merchant_id, context.contract.id).first();
      if (existing) {
        const membership = await ensurePlatformMember(db, { phone: context.merchant.phone, source: "merchant_contract", originVerified: true, deviceId: session.session_id, issueSession: true });
        const replay = { ok: true, signature_id: existing.id, public_id: existing.public_id, document_hash: existing.document_hash, membership: { member_id: membership.member.id, member_no: membership.member.member_no, created: membership.created }, member_session: membership.session, welcome: membership.welcome, replay: true };
        await completeContractOperation(db, operation.operation.id, replay); return json(replay, 200, cors);
      }
      const legalEntity = requiresConfiguredLegalEntity(context.contract.id) ? assertLegalEntityConfigured(context.legal_entity) : null;
      if (!String(input.signatory_legal_name || "").trim()) throw new ContractError("SIGNATORY_REQUIRED", "請填寫簽署人法定姓名。", 422);
      if (!['legal_representative','authorized_representative'].includes(input.signatory_role)) throw new ContractError("SIGNATORY_ROLE_INVALID", "請確認簽署人身份。", 422);
      if (input.signatory_role === "authorized_representative" && input.authorization_confirmed !== true) throw new ContractError("AUTHORIZATION_REQUIRED", "受授權代表須確認已取得合法簽約授權。", 422);
      const termsHash = await hashCanonical(commercialTermsSnapshot(context.terms));
      if (termsHash !== context.terms.terms_hash) throw new ContractError("COMMERCIAL_TERMS_HASH_MISMATCH", "商業條件雜湊不一致，已停止簽署。", 409);
      const signatureId = makeId("mcsig"), publicId = `BYMC-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
      const staging = assertContractSignable(context.contract, env).staging;
      const sessionHash = await sessionEvidenceHash(session.session_id);
      const partySnapshot = legalEntity ? merchantPartySnapshot(context.merchant, legalEntity, input) : null;
      const agreement = await buildSignedAgreement({
        title: context.contract.title, documentId: signatureId, publicId,
        verificationUrl: `https://baiyeconnect.com/#/verify-contract/${publicId}`,
        contract: context.contract, partyType: "merchant", partyId: session.merchant_id,
        partyLabel: partySnapshot ? merchantPartyLabel(partySnapshot) : `平台方：契約正式設定法律主體　商家：${context.merchant.name}`,
        signatory: String(input.signatory_legal_name).trim(), signatoryRole: input.signatory_role,
        signature: input.signature, consents: { read: input.read, electronic: input.electronic, commercial_terms: input.commercial_terms, authority: input.authority, signature_evidence: input.signature_evidence },
        signatureValidation: { minimumStrokes: 2, minimumPoints: 12 }, consentVersion: merchantConsentVersion(context.contract.id), commercialTermsHash: termsHash,
        attachments: commercialAttachments(context.terms, context.contract, context.plan), identityHash: partySnapshot ? await hashCanonical(partySnapshot) : null, contractPeriod: { period_start: context.terms.start_date, period_end: context.terms.service_period_end, term_months: context.terms.contract_term_months }, ip: ip(request), userAgent: request.headers.get("user-agent"),
        sessionEvidence: sessionHash, inviteEvidence: await sha256(context.invite.id), staging,
        contractAssetsBucket: env.CONTRACTS_BUCKET,
        fontAssets: env.CONTRACT_FONT_ASSETS_FOR_TESTS,
      });
      const prefix = `contracts/merchants/${session.merchant_id}/${context.contract.version}/${signatureId}`;
      const stored = await storePrivateAgreementArtifacts(env.CONTRACTS_BUCKET, prefix, agreement);
      const membershipBatch = await preparePlatformMembershipBatch(db, { phone: context.merchant.phone, source: "merchant_contract", originVerified: true, deviceId: session.session_id });
      try {
        await db.batch([
          db.prepare("INSERT INTO merchant_contract_signatures(id,public_id,merchant_id,merchant_user_id,contract_version_id,commercial_terms_id,signatory_legal_name,signatory_role,legal_representative_name,company_name,tax_id,authorization_declaration_version,signed_at,ip_address,user_agent,contract_content_hash,commercial_terms_hash,signature_hash,signature_data,document_hash,pdf_hash,consent_version,signature_assurance_level,invite_id,session_id_hash,r2_key,evidence_object_key,party_snapshot_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(signatureId, publicId, session.merchant_id, session.user_id, context.contract.id, context.terms.id, String(input.signatory_legal_name).trim(), input.signatory_role, String(input.legal_representative_name || input.signatory_legal_name).trim(), context.merchant.name, input.tax_id || null, input.signatory_role === "authorized_representative" ? "merchant-authorization-v1" : null, agreement.signedAt, ip(request), request.headers.get("user-agent"), context.contract.content_hash, termsHash, agreement.signatureHash, agreement.signatureData, agreement.documentHash, agreement.pdfHash, merchantConsentVersion(context.contract.id), STANDARD_ASSURANCE, context.invite.id, sessionHash, stored.pdfKey, stored.evidenceKey, JSON.stringify(partySnapshot || {})),
          db.prepare("INSERT INTO merchant_contract_artifacts(id,merchant_id,signature_id,artifact_type,object_key,sha256,content_type) VALUES(?,?,?,?,?,?,?)").bind(makeId("mcart"), session.merchant_id, signatureId, "signed_pdf", stored.pdfKey, agreement.pdfHash, "application/pdf"),
          db.prepare("INSERT INTO merchant_contract_artifacts(id,merchant_id,signature_id,artifact_type,object_key,sha256,content_type) VALUES(?,?,?,?,?,?,?)").bind(makeId("mcart"), session.merchant_id, signatureId, "evidence_json", stored.evidenceKey, stored.evidenceHash, "application/json"),
          db.prepare("UPDATE merchants SET status='active',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(session.merchant_id),
          db.prepare("UPDATE merchant_applications SET status='activated',updated_at=CURRENT_TIMESTAMP WHERE merchant_id=?").bind(session.merchant_id),
          db.prepare("INSERT INTO merchant_onboarding_states(merchant_id,registration_mode,state,operation_locked,commercial_terms_approval_required,commercial_terms_id,contract_signed_at) VALUES(?,'custom_quote','active',0,1,?,?) ON CONFLICT(merchant_id) DO UPDATE SET state='active',operation_locked=0,commercial_terms_id=excluded.commercial_terms_id,contract_signed_at=excluded.contract_signed_at,updated_at=CURRENT_TIMESTAMP")
            .bind(session.merchant_id, context.terms.id, agreement.signedAt),
          ...(context.contract.id === SOFTPOS_CONTRACT_VERSION_ID ? [softposTrialStatement(db, { merchantId: session.merchant_id, signatureId, signedAt: agreement.signedAt })] : []),
          ...membershipBatch.statements,
        ]);
      } catch (error) { await stored.cleanup(); throw error; }
      await contractEvent(db, request, { merchantId: session.merchant_id, signatureId, inviteId: context.invite.id, actorType: "merchant", actorId: session.user_id, action: "merchant_contract_signed", metadata: { version: context.contract.version, document_hash: agreement.documentHash, assurance: STANDARD_ASSURANCE } });
      await audit(db, request, "merchant", session.user_id, "merchant_contract_signed", "merchant_contract_signature", signatureId, { merchant_id: session.merchant_id, version: context.contract.version, document_hash: agreement.documentHash });
      await db.prepare("INSERT INTO merchant_admin_audit_logs(id,actor_member_id,merchant_id,role,action,resource_type,resource_id,before_json,after_json) VALUES(?,?,?,?,?,?,?,?,?)")
        .bind(makeId("maudit"), session.platform_member_id || null, session.merchant_id, "merchant_owner", "merchant.activation.completed", "merchant_onboarding", session.merchant_id, JSON.stringify({ state: "contract_required", operation_locked: true }), JSON.stringify({ state: "active", operation_locked: false, signature_id: signatureId })).run();
      const membership = await finalizePlatformMembershipBatch(db, membershipBatch);
      const result = { ok: true, signature_id: signatureId, public_id: publicId, signed_at: agreement.signedAt, document_hash: agreement.documentHash, pdf_hash: agreement.pdfHash, membership: { member_id: membership.member.id, member_no: membership.member.member_no, created: membership.created }, member_session: membership.session, welcome: membership.welcome, coupon: membership.coupon };
      await completeContractOperation(db, operation.operation.id, result);
      return json(result, 201, cors);
    }
    const pdfMatch = url.pathname.match(/^\/api\/merchant\/contracts\/([^/]+)\/pdf$/);
    if (pdfMatch && request.method === "GET") {
      const signature = await db.prepare("SELECT * FROM merchant_contract_signatures WHERE id=? AND merchant_id=?").bind(pdfMatch[1], session.merchant_id).first();
      if (!signature) throw new ContractError("CONTRACT_NOT_FOUND", "找不到契約文件。", 404);
      const object = await env.CONTRACTS_BUCKET.get(signature.r2_key);
      if (!object) throw new ContractError("CONTRACT_ARTIFACT_NOT_FOUND", "契約 PDF 暫時無法取得。", 404);
      return new Response(object.body, { headers: { ...cors, "content-type": "application/pdf", "content-disposition": `attachment; filename=merchant-contract-${signature.public_id}.pdf`, "x-pdf-sha256": signature.pdf_hash, "cache-control": "private, no-store" } });
    }
    const verifyMatch = url.pathname.match(/^\/api\/merchant\/contracts\/([^/]+)\/verification$/);
    if (verifyMatch && request.method === "GET") {
      const row = await db.prepare("SELECT s.*,v.version FROM merchant_contract_signatures s JOIN merchant_contract_versions v ON v.id=s.contract_version_id WHERE s.id=? AND s.merchant_id=?").bind(verifyMatch[1], session.merchant_id).first();
      if (!row) throw new ContractError("CONTRACT_NOT_FOUND", "找不到契約文件。", 404);
      return json(publicVerificationRecord(row, "MERCHANT_PLATFORM_SERVICE", row.version), 200, cors);
    }
    return null;
  } catch (error) { return errorResponse(error, cors); }
}

export async function handleMerchantContractAdmin(request, env, url, cors = {}, adminSession) {
  const db = env.FINANCE_DB;
  try {
    if (url.pathname === "/api/admin/merchant-contracts" && request.method === "GET") {
      const rows = await db.prepare("SELECT s.id,s.public_id,s.merchant_id,m.name merchant_name,s.signatory_legal_name,s.signed_at,s.status,s.document_hash,v.version FROM merchant_contract_signatures s JOIN merchants m ON m.id=s.merchant_id JOIN merchant_contract_versions v ON v.id=s.contract_version_id ORDER BY s.signed_at DESC LIMIT 100").all();
      return json({ items: rows.results }, 200, cors);
    }
    if (url.pathname === "/api/admin/merchant-contracts/invites" && request.method === "POST") {
      const input = await body(request); const merchant = await db.prepare("SELECT * FROM merchants WHERE id=?").bind(input.merchant_id || "").first();
      const terms = await db.prepare("SELECT * FROM merchant_contract_commercial_terms WHERE id=? AND merchant_id=? AND status='approved'").bind(input.commercial_terms_id || "", input.merchant_id || "").first();
      if (!merchant || !terms) throw new ContractError("APPROVED_TERMS_REQUIRED", "找不到商家或已核准商業條件。", 422);
      const operation = await beginContractOperation(db, { partyType: "merchant", partyId: merchant.id, operationType: "invite_create", idempotencyKey: request.headers.get("idempotency-key") || "" });
      if (operation.replay) return json(operation.result, 200, cors);
      const raw = randomToken(), inviteId = makeId("mcinvite"), expiresAt = new Date(Date.now() + 72 * 3600000).toISOString();
      await db.prepare("INSERT INTO merchant_contract_invites(id,merchant_id,commercial_terms_id,email,token_hash,expires_at,created_by) VALUES(?,?,?,?,?,?,?)")
        .bind(inviteId, merchant.id, terms.id, String(input.email || merchant.email || "").trim().toLowerCase(), await tokenHash(raw), expiresAt, adminSession.admin_user_id).run();
      await contractEvent(db, request, { merchantId: merchant.id, inviteId, actorType: "admin", actorId: adminSession.admin_user_id, action: "merchant_contract_invite_created", metadata: { expires_at: expiresAt } });
      const result = { invite_url: `https://baiyeconnect.com/#/merchant/activate?token=${encodeURIComponent(raw)}`, expires_at: expiresAt };
      await completeContractOperation(db, operation.operation.id, result);
      return json(result, 201, cors);
    }
    if (url.pathname === "/api/admin/merchant-contract-versions" && request.method === "GET") {
      const rows = await db.prepare("SELECT id,version,title,content_hash,effective_date,legal_review_status,legal_review_required,reviewed_by,reviewed_at,legal_counsel_reference,approved_content_hash,is_active,requires_resign,created_at FROM merchant_contract_versions ORDER BY created_at DESC").all();
      return json({ items: rows.results }, 200, cors);
    }
    if (url.pathname === "/api/admin/merchant-contract-versions" && request.method === "POST") {
      const input = await body(request); if (!input.version || !input.title || !input.content_html) throw new ContractError("CONTRACT_VERSION_INVALID", "請完整填寫契約版本、標題與內容。", 422);
      const operation = await beginContractOperation(db, { partyType: "merchant", partyId: String(input.version), operationType: "version_create", idempotencyKey: request.headers.get("idempotency-key") || "" });
      if (operation.replay) return json(operation.result, 200, cors);
      const contentHash = await sha256(String(input.content_html)); const id = makeId("mcversion");
      await db.prepare("INSERT INTO merchant_contract_versions(id,version,title,content_html,content_hash,effective_date,legal_review_status,legal_review_required,is_active,requires_resign) VALUES(?,?,?,?,?,?,'draft',1,0,?)")
        .bind(id, String(input.version), String(input.title), String(input.content_html), contentHash, String(input.effective_date), input.requires_resign ? 1 : 0).run();
      await audit(db, request, "admin", adminSession.admin_user_id, "merchant_contract_version_created", "merchant_contract_version", id, { content_hash: contentHash });
      const result = { id, content_hash: contentHash }; await completeContractOperation(db, operation.operation.id, result); return json(result, 201, cors);
    }
    const versionMatch = url.pathname.match(/^\/api\/admin\/merchant-contract-versions\/([^/]+)(?:\/(legal-review))?$/);
    if (versionMatch && !versionMatch[2] && request.method === "PATCH") {
      const input = await body(request); const current = await db.prepare("SELECT * FROM merchant_contract_versions WHERE id=?").bind(versionMatch[1]).first();
      if (!current || current.legal_review_status === "approved") throw new ContractError("CONTRACT_VERSION_IMMUTABLE", "已核准版本不可修改。", 409);
      const operation = await beginContractOperation(db, { partyType: "merchant", partyId: current.id, operationType: "version_update", idempotencyKey: request.headers.get("idempotency-key") || "" });
      if (operation.replay) return json(operation.result, 200, cors);
      const html = String(input.content_html ?? current.content_html), contentHash = await sha256(html);
      await db.prepare("UPDATE merchant_contract_versions SET title=?,content_html=?,content_hash=?,effective_date=?,requires_resign=?,legal_review_status='pending_review' WHERE id=?")
        .bind(String(input.title ?? current.title), html, contentHash, String(input.effective_date ?? current.effective_date), (input.requires_resign ?? current.requires_resign) ? 1 : 0, current.id).run();
      const result = { ok: true, content_hash: contentHash }; await completeContractOperation(db, operation.operation.id, result); return json(result, 200, cors);
    }
    if (versionMatch?.[2] === "legal-review" && request.method === "POST") {
      const input = await body(request); if (input.confirm_legal_review !== true || !input.legal_counsel_reference) throw new ContractError("LEGAL_REVIEW_CONFIRMATION_REQUIRED", "請確認已完成正式法律審閱並填寫律師審閱參考。", 422);
      const current = await db.prepare("SELECT * FROM merchant_contract_versions WHERE id=?").bind(versionMatch[1]).first();
      if (!current) throw new ContractError("CONTRACT_NOT_FOUND", "找不到契約版本。", 404);
      const operation = await beginContractOperation(db, { partyType: "merchant", partyId: current.id, operationType: "legal_review", idempotencyKey: request.headers.get("idempotency-key") || "" });
      if (operation.replay) return json(operation.result, 200, cors);
      const activate = input.activate === true;
      const statements = [];
      if (activate) statements.push(db.prepare("UPDATE merchant_contract_versions SET is_active=0 WHERE is_active=1"));
      statements.push(db.prepare("UPDATE merchant_contract_versions SET legal_review_status='approved',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,legal_counsel_reference=?,approved_content_hash=content_hash,is_active=? WHERE id=?")
        .bind(adminSession.admin_user_id, String(input.legal_counsel_reference).slice(0, 240), activate ? 1 : 0, current.id));
      await db.batch(statements);
      await audit(db, request, "admin", adminSession.admin_user_id, "merchant_contract_legal_review_approved", "merchant_contract_version", current.id, { approved_content_hash: current.content_hash, activate });
      const result = { ok: true, legal_review_status: "approved", approved_content_hash: current.content_hash, is_active: activate }; await completeContractOperation(db, operation.operation.id, result); return json(result, 200, cors);
    }
    const commercePlanMatch = url.pathname.match(/^\/api\/admin\/merchants\/([^/]+)\/commerce-ai-45000-plan$/);
    if (commercePlanMatch && request.method === "POST") {
      const input = await body(request);
      if (input.plan_id !== COMMERCE_AI_PLAN_ID || input.confirm_fixed_price !== true) throw new ContractError("COMMERCE_AI_PLAN_CONFIRMATION_REQUIRED", "請確認指派 AI 智慧商城完整版固定總價 NT$45,000。", 422);
      const operation = await beginContractOperation(db, { partyType: "merchant", partyId: commercePlanMatch[1], operationType: "commercial_terms", idempotencyKey: request.headers.get("idempotency-key") || "" });
      if (operation.replay) return json(operation.result, 200, cors);
      const assignment = await buildCommerceAiAssignment(db, commercePlanMatch[1], adminSession.admin_user_id);
      if (!assignment) throw new ContractError("MERCHANT_NOT_FOUND", "找不到商家。", 404);
      const result = { plan_id: COMMERCE_AI_PLAN_ID, contract_version: COMMERCE_AI_CONTRACT_ID, fixed_price_minor: assignment.snapshot.discount_price_minor, currency: assignment.snapshot.currency, assignment_id: assignment.assignment_id, commercial_terms_id: assignment.commercial_terms_id, terms_hash: assignment.terms_hash, entitlements: { commerce_full: true, cart: true, merchant_product_edit: true, merchant_content_editable: true, merchant_product_editable: true }, payment_enabled: false };
      await audit(db, request, "admin", adminSession.admin_user_id, "merchant_commerce_ai_45000_assigned", "merchant_plan_assignment", assignment.assignment_id, { merchant_id: commercePlanMatch[1], plan_id: COMMERCE_AI_PLAN_ID, fixed_price_minor: 4500000 });
      await completeContractOperation(db, operation.operation.id, result);
      return json(result, 201, cors);
    }
    const termsMatch = url.pathname.match(/^\/api\/admin\/merchants\/([^/]+)\/commercial-terms$/);
    if (termsMatch && request.method === "POST") {
      const input = await body(request); if (input.confirm_approved !== true) throw new ContractError("COMMERCIAL_TERMS_APPROVAL_REQUIRED", "請二次確認商業條件已核准。", 422);
      const merchant = await db.prepare("SELECT id FROM merchants WHERE id=?").bind(termsMatch[1]).first(); if (!merchant) throw new ContractError("MERCHANT_NOT_FOUND", "找不到商家。", 404);
      const terms = validateCommercialTerms(input); const id = makeId("mcterms");
      const operation = await beginContractOperation(db, { partyType: "merchant", partyId: merchant.id, operationType: "commercial_terms", idempotencyKey: request.headers.get("idempotency-key") || "" });
      if (operation.replay) return json(operation.result, 200, cors);
      const termsHash = await hashCanonical(commercialTermsSnapshot(terms));
      await db.batch([
        db.prepare("UPDATE merchant_contract_commercial_terms SET status='superseded' WHERE merchant_id=? AND status='draft'").bind(merchant.id),
        db.prepare("INSERT INTO merchant_contract_commercial_terms(id,merchant_id,plan_code,plan_name,list_price_minor,discount_price_minor,currency,contract_term_months,payment_plan,upfront_amount_minor,offset_target_amount_minor,tax_reserve_enabled,withholding_enabled,included_services_json,excluded_services_json,attachments_json,start_date,service_period_end,renewal_terms,custom_quote_reference,status,created_by,approved_by,approved_at,terms_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'approved',?,?,CURRENT_TIMESTAMP,?)")
          .bind(id, merchant.id, terms.plan_code, terms.plan_name, terms.list_price_minor, terms.discount_price_minor, terms.currency, terms.contract_term_months, terms.payment_plan, terms.upfront_amount_minor, terms.offset_target_amount_minor, terms.tax_reserve_enabled, terms.withholding_enabled, JSON.stringify(terms.included_services), JSON.stringify(terms.excluded_services), JSON.stringify(terms.attachments), terms.start_date, terms.service_period_end, terms.renewal_terms, terms.custom_quote_reference, adminSession.admin_user_id, adminSession.admin_user_id, termsHash),
      ]);
      await audit(db, request, "admin", adminSession.admin_user_id, "merchant_commercial_terms_approved", "merchant_contract_terms", id, { merchant_id: merchant.id, terms_hash: termsHash, payment_plan: terms.payment_plan });
      const result = { id, terms_hash: termsHash }; await completeContractOperation(db, operation.operation.id, result); return json(result, 201, cors);
    }
    return null;
  } catch (error) { return errorResponse(error, cors); }
}

export async function handlePublicContractVerification(env, publicId, cors = {}) {
  const db = env.FINANCE_DB;
  const addendum = await db.prepare("SELECT public_id,signed_at,status,document_hash,addendum_version version FROM merchant_contract_addenda WHERE public_id=? AND status='SIGNED'").bind(publicId).first().catch(() => null);
  if (addendum) return json(publicVerificationRecord(addendum, "MERCHANT_CONTRACT_ADDENDUM", addendum.version), 200, cors);
  const merchant = await db.prepare("SELECT s.public_id,s.signed_at,s.status,s.document_hash,v.version FROM merchant_contract_signatures s JOIN merchant_contract_versions v ON v.id=s.contract_version_id WHERE s.public_id=?").bind(publicId).first();
  if (merchant) return json(publicVerificationRecord(merchant, "MERCHANT_PLATFORM_SERVICE", merchant.version), 200, cors);
  const partner = await db.prepare("SELECT s.public_id,s.signed_at,s.status,s.document_hash,v.version FROM contract_signatures s JOIN contract_versions v ON v.id=s.contract_version_id WHERE s.public_id=?").bind(publicId).first();
  if (partner) return json(publicVerificationRecord(partner, "CONTRACTOR_PARTNER", partner.version), 200, cors);
  return json({ error: "查無此契約驗證碼。", code: "CONTRACT_NOT_FOUND" }, 404, cors);
}
