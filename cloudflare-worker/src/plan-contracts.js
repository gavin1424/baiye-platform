import {
  ContractError,
  STANDARD_ASSURANCE,
  assertContractSignable,
  beginContractOperation,
  buildSignedAgreement,
  completeContractOperation,
  parseAndValidateSignature,
  sessionEvidenceHash,
  storePrivateAgreementArtifacts,
  validateExplicitConsents,
  validateLegalName,
} from "./contract-engine.js";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const clientIp = (request) => request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || null;
const inputBody = (request) => request.json().catch(() => ({}));

function errorResponse(error, cors) {
  if (error instanceof ContractError) return json({ error: error.message, code: error.code, details: error.details }, error.status, cors);
  console.error(JSON.stringify({ service: "service_plan_contract", error: error instanceof Error ? error.message : "unknown" }));
  return json({ error: "方案契約服務暫時無法完成此操作。", code: "PLAN_CONTRACT_SERVICE_ERROR" }, 503, cors);
}

function deviceMetadata(request) {
  const ua = request.headers.get("user-agent") || "";
  return {
    platform: /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : /Windows/i.test(ua) ? "Windows" : /Macintosh/i.test(ua) ? "macOS" : "Other",
    browser: /Line\//i.test(ua) ? "LINE" : /CriOS|Chrome/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : /Firefox/i.test(ua) ? "Firefox" : "Other",
    mobile: /Mobile|Android|iPhone|iPad|Line\//i.test(ua),
    cf_ray: request.headers.get("cf-ray") || null,
  };
}

function parseSnapshot(template) {
  try { return JSON.parse(template.plan_details_snapshot); }
  catch { throw new ContractError("PLAN_SNAPSHOT_INVALID", "方案契約 Snapshot 格式不正確，已停止簽署。", 409); }
}

async function templateBySlug(db, slug) {
  return db.prepare("SELECT * FROM service_plan_contract_templates WHERE plan_slug=? AND is_active=1 ORDER BY effective_at DESC,created_at DESC LIMIT 1").bind(slug).first();
}

function publicTemplate(template) {
  const plan = parseSnapshot(template);
  const productionSigningEnabled = template.status === "approved" && template.approved_content_hash === template.contract_content_hash;
  return {
    contract_template_id: template.id,
    contract_type: template.contract_type,
    plan_id: template.plan_id,
    plan_slug: template.plan_slug,
    contract_name: template.contract_name,
    contract_version: template.contract_version,
    contract_snapshot: template.contract_snapshot,
    contract_content_hash: template.contract_content_hash,
    plan,
    effective_at: template.effective_at,
    status: template.status,
    legal_review_required: Boolean(template.legal_review_required),
    legal_review_approved: template.status === "approved",
    production_signing_enabled: productionSigningEnabled,
  };
}

async function contractEvent(db, request, template, { signatureId = null, merchantId = null, actorType = "visitor", actorId = null, action, metadata = {} }) {
  return db.prepare("INSERT INTO service_plan_contract_events(id,contract_template_id,signature_id,merchant_id,actor_type,actor_id,action,metadata_json,ip_address) VALUES(?,?,?,?,?,?,?,?,?)")
    .bind(makeId("spce"), template.id, signatureId, merchantId, actorType, actorId, action, JSON.stringify(metadata), clientIp(request)).run();
}

function assertOwner(session) {
  if (!String(session.roles || "").split(",").includes("owner")) throw new ContractError("MERCHANT_OWNER_REQUIRED", "僅商家擁有者可簽署方案契約。", 403);
}

function validateSelection(input, template) {
  if ((input.plan_id && input.plan_id !== template.plan_id) || (input.plan_slug && input.plan_slug !== template.plan_slug) || (input.contract_template_id && input.contract_template_id !== template.id)) {
    throw new ContractError("PLAN_CONTRACT_MISMATCH", "所選方案與契約版本不一致，請返回方案頁重新選擇。", 409);
  }
}

function validateSigningInput(input) {
  const legalName = validateLegalName(input.legal_name);
  const consents = validateExplicitConsents(input, "service_plan");
  const signature = parseAndValidateSignature(input.signature);
  return { legalName, consents, signature };
}

export async function handlePlanContractPublic(request, env, url, cors = {}) {
  const match = url.pathname.match(/^\/api\/public\/plan-contracts\/([^/]+)$/);
  if (!match || request.method !== "GET") return null;
  try {
    const template = await templateBySlug(env.FINANCE_DB, decodeURIComponent(match[1]));
    if (!template) throw new ContractError("PLAN_CONTRACT_NOT_FOUND", "找不到此方案契約。", 404);
    return json(publicTemplate(template), 200, cors);
  } catch (error) { return errorResponse(error, cors); }
}

export async function handlePlanContractRequest(request, env, url, cors = {}, authorization) {
  const db = env.FINANCE_DB;
  const session = authorization.session;
  try {
    assertOwner(session);
    if (url.pathname === "/api/merchant/plan-contracts" && request.method === "GET") {
      const rows = await db.prepare("SELECT id,public_id,contract_template_id,plan_id,plan_slug,plan_name,contract_version,signed_at,status,pdf_hash FROM service_plan_contract_signatures WHERE merchant_id=? ORDER BY signed_at DESC").bind(session.merchant_id).all();
      return json({ items: rows.results || [] }, 200, cors);
    }
    const pdfMatch = url.pathname.match(/^\/api\/merchant\/plan-contracts\/signatures\/([^/]+)\/pdf$/);
    if (pdfMatch && request.method === "GET") {
      const signature = await db.prepare("SELECT * FROM service_plan_contract_signatures WHERE id=? AND merchant_id=?").bind(decodeURIComponent(pdfMatch[1]), session.merchant_id).first();
      if (!signature) throw new ContractError("PLAN_CONTRACT_NOT_FOUND", "找不到此方案契約。", 404);
      const object = await env.CONTRACTS_BUCKET.get(signature.pdf_object_key);
      if (!object) throw new ContractError("PLAN_CONTRACT_PDF_NOT_FOUND", "正式方案契約 PDF 尚未建立。", 404);
      const inline = url.searchParams.get("view") === "1";
      return new Response(object.body, { headers: { ...cors, "content-type": "application/pdf", "content-disposition": `${inline ? "inline" : "attachment"}; filename=service-plan-contract-${signature.public_id}.pdf`, "x-pdf-sha256": signature.pdf_hash, "cache-control": "private, no-store" } });
    }
    const match = url.pathname.match(/^\/api\/merchant\/plan-contracts\/([^/]+)(?:\/(sign-preview|sign))?$/);
    if (!match) return null;
    const template = await templateBySlug(db, decodeURIComponent(match[1]));
    if (!template) throw new ContractError("PLAN_CONTRACT_NOT_FOUND", "找不到此方案契約。", 404);
    const plan = parseSnapshot(template);
    const signature = await db.prepare("SELECT id,public_id,signed_at,status,pdf_hash FROM service_plan_contract_signatures WHERE merchant_id=? AND contract_template_id=?").bind(session.merchant_id, template.id).first();
    if (!match[2] && request.method === "GET") {
      await contractEvent(db, request, template, { merchantId: session.merchant_id, actorType: "merchant", actorId: session.user_id, action: "plan.contract.opened", metadata: { plan_id: template.plan_id, authenticated: true } });
      return json({ ...publicTemplate(template), signed: Boolean(signature), signature }, 200, cors);
    }
    const input = await inputBody(request);
    validateSelection(input, template);
    const validated = validateSigningInput(input);
    assertContractSignable({ ...template, legal_review_status: template.status, content_hash: template.contract_content_hash, approved_content_hash: template.approved_content_hash }, env);
    if (match[2] === "sign-preview" && request.method === "POST") {
      await db.batch([
        db.prepare("INSERT INTO service_plan_contract_events(id,contract_template_id,merchant_id,actor_type,actor_id,action,metadata_json,ip_address) VALUES(?,?,?,?,?,?,?,?)").bind(makeId("spce"), template.id, session.merchant_id, "merchant", session.user_id, "plan.contract.consent_accepted", JSON.stringify({ legal_name: validated.legalName, consents: validated.consents }), clientIp(request)),
        db.prepare("INSERT INTO service_plan_contract_events(id,contract_template_id,merchant_id,actor_type,actor_id,action,metadata_json,ip_address) VALUES(?,?,?,?,?,?,?,?)").bind(makeId("spce"), template.id, session.merchant_id, "merchant", session.user_id, "plan.contract.signature_completed", JSON.stringify({ legal_name: validated.legalName, point_count: validated.signature.pointCount, movement_distance: validated.signature.distance }), clientIp(request)),
        db.prepare("INSERT INTO service_plan_contract_events(id,contract_template_id,merchant_id,actor_type,actor_id,action,metadata_json,ip_address) VALUES(?,?,?,?,?,?,?,?)").bind(makeId("spce"), template.id, session.merchant_id, "merchant", session.user_id, "plan.contract.final_confirmation", JSON.stringify({ legal_name: validated.legalName, plan_id: template.plan_id }), clientIp(request)),
      ]);
      return json({ plan_name: plan.plan_name, plan_price: plan.plan_price_display, contract_version: template.contract_version, legal_name: validated.legalName, contract_template_id: template.id }, 200, cors);
    }
    if (match[2] === "sign" && request.method === "POST") {
      if (input.final_confirmed !== true) throw new ContractError("FINAL_CONFIRMATION_REQUIRED", "請完成最終確認後再正式簽署。", 422);
      const operation = await beginContractOperation(db, { partyType: "merchant", partyId: `${session.merchant_id}:${template.id}`, operationType: "sign", idempotencyKey: request.headers.get("idempotency-key") });
      if (operation.replay) return json(operation.result, 200, cors);
      const existing = await db.prepare("SELECT id,public_id,signed_at,document_hash,pdf_hash FROM service_plan_contract_signatures WHERE merchant_id=? AND contract_template_id=?").bind(session.merchant_id, template.id).first();
      if (existing) { const result = { ...existing, replay: true, plan_id: template.plan_id, continue_url: `/merchant/select-plan?plan=${encodeURIComponent(template.plan_id)}` }; await completeContractOperation(db, operation.operation.id, result); return json(result, 200, cors); }
      const merchant = await db.prepare("SELECT id,name FROM merchants WHERE id=?").bind(session.merchant_id).first();
      if (!merchant) throw new ContractError("MERCHANT_NOT_FOUND", "找不到商家資料。", 404);
      const signatureId = makeId("spcs");
      const publicId = `SPC-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
      const submittedAt = new Date().toISOString();
      const metadata = deviceMetadata(request);
      const contract = { title: template.contract_name, version: template.contract_version, content_html: template.contract_snapshot, content_hash: template.contract_content_hash };
      const agreement = await buildSignedAgreement({
        title: template.contract_name, documentId: signatureId, publicId,
        verificationUrl: `https://baiyeconnect.com/#/verify-contract/${publicId}`,
        contract, partyType: "service_plan", partyId: session.merchant_id,
        partyLabel: `甲方：陳靈有限公司　乙方：${merchant.name}`,
        signatory: validated.legalName, signatoryRole: "商家法定代表人／授權代表",
        signature: input.signature, consents: validated.consents,
        consentVersion: "service-plan-contract-consent-v1.0",
        ip: clientIp(request), userAgent: request.headers.get("user-agent"), deviceMetadata: metadata,
        timezone: "Asia/Taipei", finalConfirmedAt: submittedAt, submittedAt,
        sessionEvidence: await sessionEvidenceHash(session.session_id), staging: env.CONTRACT_SIGNING_MODE === "staging",
        documentContext: { contract_type: template.contract_type, contract_template_id: template.id, plan },
      });
      const stored = await storePrivateAgreementArtifacts(env.CONTRACTS_BUCKET, `contracts/service-plans/${session.merchant_id}/${template.plan_slug}/${template.contract_version}/${signatureId}`, agreement);
      const priceSnapshot = JSON.stringify({ amount_minor: plan.plan_price_minor, display: plan.plan_price_display, currency: plan.currency });
      const result = { contract_id: publicId, signature_id: signatureId, contract_template_id: template.id, contract_version: template.contract_version, plan_id: template.plan_id, plan_slug: template.plan_slug, plan_name: plan.plan_name, signed_at: agreement.signedAt, document_hash: agreement.documentHash, pdf_hash: agreement.pdfHash, continue_url: `/merchant/select-plan?plan=${encodeURIComponent(template.plan_id)}` };
      try {
        await db.batch([
          db.prepare("INSERT INTO service_plan_contract_signatures(id,public_id,contract_template_id,contract_type,merchant_id,signer_user_id,signer_platform_member_id,legal_name,plan_id,plan_slug,plan_name,plan_price_snapshot,plan_details_snapshot,contract_version,contract_snapshot,contract_content_hash,consent_states_json,consent_version,electronic_signature,signature_hash,signed_at,timezone,ip_address,user_agent,request_metadata_json,document_hash,pdf_object_key,pdf_hash,evidence_object_key,signature_assurance_level,final_confirmed_at,submitted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(signatureId, publicId, template.id, template.contract_type, session.merchant_id, session.user_id, session.platform_member_id || null, validated.legalName, template.plan_id, template.plan_slug, plan.plan_name, priceSnapshot, template.plan_details_snapshot, template.contract_version, template.contract_snapshot, template.contract_content_hash, JSON.stringify(agreement.consents), "service-plan-contract-consent-v1.0", agreement.signatureData, agreement.signatureHash, agreement.signedAt, "Asia/Taipei", clientIp(request), request.headers.get("user-agent"), JSON.stringify(metadata), agreement.documentHash, stored.pdfKey, agreement.pdfHash, stored.evidenceKey, STANDARD_ASSURANCE, submittedAt, submittedAt),
          db.prepare("INSERT INTO service_plan_contract_artifacts(id,signature_id,merchant_id,artifact_type,object_key,sha256,content_type) VALUES(?,?,?,?,?,?,?)").bind(makeId("spca"), signatureId, session.merchant_id, "signed_pdf", stored.pdfKey, agreement.pdfHash, "application/pdf"),
          db.prepare("INSERT INTO service_plan_contract_artifacts(id,signature_id,merchant_id,artifact_type,object_key,sha256,content_type) VALUES(?,?,?,?,?,?,?)").bind(makeId("spca"), signatureId, session.merchant_id, "evidence_json", stored.evidenceKey, stored.evidenceHash, "application/json"),
          ...["submit_requested","signed","pdf_generated"].map((action) => db.prepare("INSERT INTO service_plan_contract_events(id,contract_template_id,signature_id,merchant_id,actor_type,actor_id,action,metadata_json,ip_address) VALUES(?,?,?,?,?,?,?,?,?)").bind(makeId("spce"), template.id, signatureId, session.merchant_id, "merchant", session.user_id, `plan.contract.${action}`, JSON.stringify({ legal_name: validated.legalName, plan_id: template.plan_id, document_hash: agreement.documentHash, pdf_hash: agreement.pdfHash }), clientIp(request))),
        ]);
      } catch (error) { await stored.cleanup(); throw error; }
      await completeContractOperation(db, operation.operation.id, result);
      return json(result, 201, cors);
    }
    return null;
  } catch (error) { return errorResponse(error, cors); }
}

export async function handlePlanContractAdmin(request, env, url, cors = {}) {
  const db = env.FINANCE_DB;
  try {
    if (url.pathname === "/api/admin/plan-contracts" && request.method === "GET") {
      const templates = await db.prepare("SELECT id,contract_type,plan_id,plan_slug,contract_name,contract_version,contract_content_hash,effective_at,status,legal_review_required,reviewed_at,legal_counsel_reference,approved_content_hash,is_active,created_at FROM service_plan_contract_templates ORDER BY plan_id,created_at DESC").all();
      const signatures = await db.prepare("SELECT s.id,s.public_id,s.merchant_id,m.name merchant_name,s.legal_name,s.plan_id,s.plan_slug,s.plan_name,s.contract_version,s.signed_at,s.status,s.pdf_hash FROM service_plan_contract_signatures s JOIN merchants m ON m.id=s.merchant_id ORDER BY s.signed_at DESC LIMIT 100").all();
      return json({ templates: templates.results || [], signatures: signatures.results || [] }, 200, cors);
    }
    const eventsMatch = url.pathname.match(/^\/api\/admin\/plan-contracts\/([^/]+)\/events$/);
    if (eventsMatch && request.method === "GET") {
      const rows = await db.prepare("SELECT id,contract_template_id,signature_id,merchant_id,actor_type,actor_id,action,metadata_json,created_at FROM service_plan_contract_events WHERE signature_id=? OR contract_template_id=? ORDER BY created_at DESC LIMIT 200").bind(eventsMatch[1], eventsMatch[1]).all();
      return json({ items: rows.results || [] }, 200, cors);
    }
    const pdfMatch = url.pathname.match(/^\/api\/admin\/plan-contracts\/([^/]+)\/pdf$/);
    if (pdfMatch && request.method === "GET") {
      const signature = await db.prepare("SELECT * FROM service_plan_contract_signatures WHERE id=?").bind(pdfMatch[1]).first();
      if (!signature) throw new ContractError("PLAN_CONTRACT_NOT_FOUND", "找不到此方案契約。", 404);
      const object = await env.CONTRACTS_BUCKET.get(signature.pdf_object_key);
      if (!object) throw new ContractError("PLAN_CONTRACT_PDF_NOT_FOUND", "正式方案契約 PDF 尚未建立。", 404);
      return new Response(object.body, { headers: { ...cors, "content-type": "application/pdf", "content-disposition": `attachment; filename=service-plan-contract-${signature.public_id}.pdf`, "x-pdf-sha256": signature.pdf_hash, "cache-control": "private, no-store" } });
    }
    return null;
  } catch (error) { return errorResponse(error, cors); }
}
