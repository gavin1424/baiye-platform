import { ContractError, STANDARD_ASSURANCE, buildSignedAgreement, hashCanonical, storePrivateAgreementArtifacts } from "./contract-engine.js";

export const STANDARD_ADDON_PLAN = Object.freeze({ code: "baiye_standard_18000_addons", baseAmountMinor: 1800000, months: 24, baseProducts: 20, merchantContentEditable: false });
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const clientIp = (request) => request.headers.get("CF-Connecting-IP") || null;
const clean = (value, max = 2000) => String(value ?? "").trim().slice(0, max);
const ADDON_FONT_KEYS = Object.freeze({
  regular: "contract-assets/fonts/NotoSansTC-Regular-AddonV2.ttf",
  bold: "contract-assets/fonts/NotoSansTC-Bold-AddonV2.ttf",
  mono: "contract-assets/fonts/NotoSansMono-Regular.ttf",
});
const ADDON_FONT_HASHES = Object.freeze({
  regular: "862584925bb6ff916a1efa76d88b293182d6893c74b57f7f69424a570b4e9172",
  bold: "1dcb7de1dbfffc0f85a0ba16f5567a9f8cf36a1f3afa0ab2ba0e70fd136e12af",
  mono: "b4563af6f013732c8f40d206a05ff2ffc4eaeac0020d39393e59d0cf8a3ffeed",
});

async function addonFontAssets(bucket) {
  const bytes = async (key) => {
    const object = await bucket?.get(key);
    if (!object) throw new Error(`ADDON_FONT_MISSING:${key}`);
    if (typeof object.arrayBuffer === "function") return new Uint8Array(await object.arrayBuffer());
    if (object.body instanceof Uint8Array) return object.body;
    return new Uint8Array(await new Response(object.body).arrayBuffer());
  };
  const [regularBytes, boldBytes, monoBytes] = await Promise.all([
    bytes(ADDON_FONT_KEYS.regular),
    bytes(ADDON_FONT_KEYS.bold),
    bytes(ADDON_FONT_KEYS.mono),
  ]);
  const digest = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",value)),(part)=>part.toString(16).padStart(2,"0")).join("");
  const [regularSha256, boldSha256, monoSha256] = await Promise.all([digest(regularBytes), digest(boldBytes), digest(monoBytes)]);
  if (regularSha256 !== ADDON_FONT_HASHES.regular || boldSha256 !== ADDON_FONT_HASHES.bold || monoSha256 !== ADDON_FONT_HASHES.mono) throw new Error("ADDON_FONT_INTEGRITY_MISMATCH");
  return { regularBytes, boldBytes, monoBytes, regularSha256, boldSha256, monoSha256, subsetSafe: true };
}

export function priceAddon(config, quantity, adminQuotedAmountMinor) {
  const qty = Number(quantity ?? 1);
  if (!Number.isSafeInteger(qty) || qty < 1) throw new ContractError("ADDON_QUANTITY_INVALID", "加購數量不正確。", 422);
  if (config.pricing_model === "fixed") return { amountMinor: Number(config.amount_minor), unitAmountMinor: Number(config.amount_minor), adminQuoted: false };
  if (config.pricing_model === "per_block") {
    const excess = Math.max(0, qty - Number(config.included_units || 0));
    return { amountMinor: Math.ceil(excess / Number(config.unit_size)) * Number(config.amount_minor), unitAmountMinor: Number(config.amount_minor), adminQuoted: false };
  }
  if (config.pricing_model === "tiered_minimum") {
    const perUnit = Number(config.per_unit_minor), included = Number(config.included_units || 0), minimum = Number(config.minimum_minor || 0);
    const calculated = included > 0 ? minimum + Math.max(0, qty - included) * perUnit : qty * perUnit;
    return { amountMinor: Math.max(minimum, calculated), unitAmountMinor: perUnit, adminQuoted: false };
  }
  const quote = Number(adminQuotedAmountMinor);
  if (!Number.isSafeInteger(quote) || quote < Number(config.minimum_minor || 0)) throw new ContractError("ADMIN_QUOTE_REQUIRED", `${config.label}須由百工 Admin 確認最終報價。`, 422);
  return { amountMinor: quote, unitAmountMinor: null, adminQuoted: true };
}

async function audit(db, request, merchantId, actorType, actorId, action, entityType, entityId, metadata = {}) {
  await db.prepare("INSERT INTO merchant_addon_audit_logs(id,merchant_id,actor_type,actor_id,action,entity_type,entity_id,metadata_json,ip_address,user_agent) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .bind(uid("addaudit"), merchantId, actorType, actorId || null, action, entityType, entityId, JSON.stringify(metadata), clientIp(request), request.headers.get("user-agent")).run();
}

async function quoteView(db, id, merchantId = null) {
  const quote = await db.prepare(`SELECT q.*,a.id addendum_id,a.public_id addendum_public_id,a.status addendum_status,a.payment_status
    FROM merchant_addon_quotes q LEFT JOIN merchant_contract_addenda a ON a.quote_id=q.id WHERE q.id=? ${merchantId ? "AND q.merchant_id=?" : ""}`)
    .bind(...(merchantId ? [id, merchantId] : [id])).first();
  if (!quote) return null;
  const items = await db.prepare("SELECT pricing_code,label,quantity,unit_amount_minor,amount_minor,admin_quoted,description FROM merchant_addon_quote_items WHERE quote_id=? ORDER BY sort_order,id").bind(id).all();
  return { ...quote, items: items.results || [], annex_b: (items.results || []).length ? { title: "附件 B｜加購服務", items: items.results } : null };
}

export async function handleMerchantStandardAddons(request, env, url, cors, authorization) {
  const db = env.FINANCE_DB, merchantId = authorization.session.merchant_id, actorId = authorization.session.user_id;
  try {
    if (url.pathname === "/api/merchant-admin/addons/pricing" && request.method === "GET") {
      const rows = await db.prepare("SELECT code,label,pricing_model,amount_minor,unit_size,included_units,per_unit_minor,minimum_minor,minimum_label,currency FROM platform_addon_pricing_config WHERE enabled=1 ORDER BY rowid").all();
      return json({ plan: STANDARD_ADDON_PLAN, items: rows.results || [] }, 200, cors);
    }
    if (url.pathname === "/api/merchant-admin/content-change-requests" && request.method === "GET") {
      const rows = await db.prepare("SELECT * FROM merchant_content_change_requests WHERE merchant_id=? ORDER BY datetime(created_at) DESC").bind(merchantId).all();
      return json({ items: rows.results || [] }, 200, cors);
    }
    if (url.pathname === "/api/merchant-admin/content-change-requests" && request.method === "POST") {
      const input = await request.json().catch(() => ({}));
      if (!clean(input.items, 4000)) throw new ContractError("CHANGE_REQUEST_REQUIRED", "請填寫修改項目與需求。", 422);
      const id = uid("mccr"), images = Array.isArray(input.images) ? input.images.map((value) => clean(value, 500)).filter(Boolean).slice(0, 20) : [];
      await db.prepare("INSERT INTO merchant_content_change_requests(id,merchant_id,request_type,items_text,requested_copy,image_refs_json,created_by) VALUES(?,?,?,?,?,?,?)")
        .bind(id, merchantId, clean(input.request_type, 80) || "content_change", clean(input.items, 4000), clean(input.text, 8000), JSON.stringify(images), actorId).run();
      await audit(db, request, merchantId, "merchant", actorId, "content_change_request.submitted", "content_change_request", id, { image_count: images.length });
      return json({ ok: true, id, status: "SUBMITTED" }, 201, cors);
    }
    if (url.pathname === "/api/merchant-admin/addon-quotes" && request.method === "GET") {
      const rows = await db.prepare("SELECT id FROM merchant_addon_quotes WHERE merchant_id=? ORDER BY datetime(created_at) DESC").bind(merchantId).all();
      return json({ items: await Promise.all((rows.results || []).map((row) => quoteView(db, row.id, merchantId))) }, 200, cors);
    }
    const accept = url.pathname.match(/^\/api\/merchant-admin\/addon-quotes\/([^/]+)\/accept$/);
    if (accept && request.method === "POST") {
      const quote = await quoteView(db, accept[1], merchantId); if (!quote || quote.status !== "ISSUED") throw new ContractError("QUOTE_NOT_ACCEPTABLE", "此報價目前無法接受。", 409);
      const parent = await db.prepare("SELECT id FROM merchant_contract_signatures WHERE merchant_id=? AND status='VALID' ORDER BY signed_at DESC LIMIT 1").bind(merchantId).first();
      if (!parent) throw new ContractError("SIGNED_MAIN_CONTRACT_REQUIRED", "須先完成 NT$18,000 主契約簽署。", 409);
      const addendumId = uid("mcadd"), publicId = `BYADD-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
      const annex = { title: "附件 B｜加購服務", quote_no: quote.quote_no, items: quote.items, base_amount_minor: STANDARD_ADDON_PLAN.baseAmountMinor, addon_amount_minor: quote.addon_amount_minor, contract_total_minor: quote.contract_total_minor, currency: "TWD" };
      const contentHash = await hashCanonical(annex);
      await db.batch([
        db.prepare("UPDATE merchant_addon_quotes SET status='ACCEPTED',accepted_by=?,accepted_at=CURRENT_TIMESTAMP,acceptance_ip=?,acceptance_user_agent=? WHERE id=? AND status='ISSUED'").bind(actorId, clientIp(request), request.headers.get("user-agent"), quote.id),
        db.prepare("INSERT INTO merchant_contract_addenda(id,public_id,merchant_id,quote_id,parent_signature_id,annex_b_json,base_amount_minor,addon_amount_minor,contract_total_minor,content_hash) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(addendumId, publicId, merchantId, quote.id, parent.id, JSON.stringify(annex), STANDARD_ADDON_PLAN.baseAmountMinor, quote.addon_amount_minor, quote.contract_total_minor, contentHash),
        ...(quote.change_request_id ? [db.prepare("UPDATE merchant_content_change_requests SET status='APPROVED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?").bind(quote.change_request_id, merchantId)] : []),
      ]);
      await audit(db, request, merchantId, "merchant", actorId, "addon_quote.accepted", "addon_quote", quote.id, { addendum_id: addendumId, contract_total_minor: quote.contract_total_minor });
      return json({ ok: true, quote_id: quote.id, addendum_id: addendumId, contract_total_minor: quote.contract_total_minor }, 201, cors);
    }
    const sign = url.pathname.match(/^\/api\/merchant-admin\/addenda\/([^/]+)\/sign$/);
    if (sign && request.method === "POST") {
      const input = await request.json().catch(() => ({}));
      const row = await db.prepare("SELECT a.*,q.quote_no,m.name merchant_name FROM merchant_contract_addenda a JOIN merchant_addon_quotes q ON q.id=a.quote_id JOIN merchants m ON m.id=a.merchant_id WHERE a.id=? AND a.merchant_id=?").bind(sign[1], merchantId).first();
      if (!row || row.status !== "AWAITING_SIGNATURE") throw new ContractError("ADDENDUM_NOT_SIGNABLE", "找不到可簽署的補充協議。", 409);
      const annex = JSON.parse(row.annex_b_json);
      const contract = { version: row.addendum_version, content_hash: row.content_hash, content_html: `<h1>創百業智慧鏈｜加購服務補充協議</h1><p>本補充協議不修改原已簽署 PDF，並與原主契約共同構成契約文件。</p><h2>附件 B｜加購服務</h2><p>主方案 NT$18,000；加購 NT$${Math.round(row.addon_amount_minor / 100).toLocaleString("en-US")}；契約總額 NT$${Math.round(row.contract_total_minor / 100).toLocaleString("en-US")}。</p>` };
      const signatory = clean(input.signatory_legal_name, 160); if (!signatory) throw new ContractError("SIGNATORY_REQUIRED", "請填寫簽署人法定姓名。", 422);
      const annexLines = annex.items.map((item) => `${item.label}｜NT$${Math.round(item.amount_minor / 100).toLocaleString("en-US")}`).join("\n");
      const agreement = await buildSignedAgreement({ title: "創百業智慧鏈｜加購服務補充協議", documentId: row.id, publicId: row.public_id, verificationUrl: `https://baiyeconnect.com/#/verify-contract/${row.public_id}`, contract, partyType: "merchant", partyId: merchantId, partyLabel: `商家：${row.merchant_name}`, signatory, signatoryRole: input.signatory_role || "legal_representative", signature: input.signature, consents: { read: input.read, electronic: input.electronic, commercial_terms: input.commercial_terms, authority: input.authority, signature_evidence: input.signature_evidence }, consentVersion: "merchant-addendum-consent-v1", commercialTermsHash: row.content_hash, attachments: [{ title: "附件 B｜加購服務", content: `${annexLines}\n主方案：NT$18,000\n加購：NT$${Math.round(row.addon_amount_minor / 100).toLocaleString("en-US")}\n契約總金額：NT$${Math.round(row.contract_total_minor / 100).toLocaleString("en-US")}` }], ip: clientIp(request), userAgent: request.headers.get("user-agent"), staging: env.CONTRACT_SIGNING_MODE === "staging", contractAssetsBucket: env.CONTRACTS_BUCKET, fontAssets: env.CONTRACT_FONT_ASSETS_FOR_TESTS || await addonFontAssets(env.CONTRACTS_BUCKET) });
      const stored = await storePrivateAgreementArtifacts(env.CONTRACTS_BUCKET, `contracts/merchants/${merchantId}/addenda/${row.id}`, agreement);
      await db.prepare("UPDATE merchant_contract_addenda SET status='SIGNED',signed_at=?,signatory_legal_name=?,signature_hash=?,signature_data=?,document_hash=?,pdf_hash=?,r2_key=?,evidence_object_key=? WHERE id=? AND status='AWAITING_SIGNATURE'")
        .bind(agreement.signedAt, signatory, agreement.signatureHash, agreement.signatureData, agreement.documentHash, agreement.pdfHash, stored.pdfKey, stored.evidenceKey, row.id).run();
      await audit(db, request, merchantId, "merchant", actorId, "contract_addendum.signed", "contract_addendum", row.id, { document_hash: agreement.documentHash, pdf_hash: agreement.pdfHash, assurance: STANDARD_ASSURANCE });
      return json({ ok: true, addendum_id: row.id, public_id: row.public_id, document_hash: agreement.documentHash, pdf_hash: agreement.pdfHash }, 201, cors);
    }
    const pdf = url.pathname.match(/^\/api\/merchant-admin\/addenda\/([^/]+)\/pdf$/);
    if (pdf && request.method === "GET") {
      const row = await db.prepare("SELECT public_id,r2_key,pdf_hash FROM merchant_contract_addenda WHERE id=? AND merchant_id=? AND status='SIGNED'").bind(pdf[1], merchantId).first();
      if (!row) throw new ContractError("ADDENDUM_NOT_FOUND", "找不到補充協議 PDF。", 404);
      const object = await env.CONTRACTS_BUCKET.get(row.r2_key); if (!object) throw new ContractError("ADDENDUM_PDF_NOT_FOUND", "補充協議 PDF 暫時無法取得。", 404);
      return new Response(object.body, { headers: { ...cors, "content-type": "application/pdf", "content-disposition": `attachment; filename=contract-addendum-${row.public_id}.pdf`, "x-pdf-sha256": row.pdf_hash, "cache-control": "private, no-store" } });
    }
    return null;
  } catch (error) {
    if (error instanceof ContractError) return json({ code: error.code, error: error.message }, error.status, cors);
    console.error(JSON.stringify({ service: "merchant_standard_addons", error: error instanceof Error ? error.message : "unknown" }));
    return json({ code: "ADDON_SERVICE_ERROR", error: "加購服務暫時無法完成操作。" }, 503, cors);
  }
}

export async function handleMerchantStandardAddonsAdmin(request, env, url, cors, adminSession) {
  const db = env.FINANCE_DB, actorId = adminSession.admin_user_id;
  try {
    if (url.pathname === "/api/admin/addon-pricing" && request.method === "GET") {
      const rows = await db.prepare("SELECT * FROM platform_addon_pricing_config ORDER BY rowid").all(); return json({ items: rows.results || [] }, 200, cors);
    }
    if (url.pathname === "/api/admin/content-change-requests" && request.method === "GET") {
      const rows = await db.prepare("SELECT r.*,m.name merchant_name FROM merchant_content_change_requests r JOIN merchants m ON m.id=r.merchant_id ORDER BY datetime(r.created_at) DESC").all(); return json({ items: rows.results || [] }, 200, cors);
    }
    const requestUpdate = url.pathname.match(/^\/api\/admin\/content-change-requests\/([^/]+)$/);
    if (requestUpdate && request.method === "PATCH") {
      const input = await request.json().catch(() => ({})), allowed = ["REVIEWING","APPROVED","IN_PROGRESS","COMPLETED","CANCELLED"];
      if (!allowed.includes(input.status)) throw new ContractError("CHANGE_STATUS_INVALID", "修改申請狀態不正確。", 422);
      const current = await db.prepare("SELECT * FROM merchant_content_change_requests WHERE id=?").bind(requestUpdate[1]).first(); if (!current) throw new ContractError("CHANGE_REQUEST_NOT_FOUND", "找不到修改申請。", 404);
      await db.prepare("UPDATE merchant_content_change_requests SET status=?,warranty_covered=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(input.status, input.warranty_covered ? 1 : 0, current.id).run();
      await audit(db, request, current.merchant_id, "admin", actorId, "content_change_request.updated", "content_change_request", current.id, { status: input.status, amount_minor: input.warranty_covered ? 0 : null });
      return json({ ok: true }, 200, cors);
    }
    if (url.pathname === "/api/admin/addon-quotes" && request.method === "POST") {
      const input = await request.json().catch(() => ({})), merchantId = clean(input.merchant_id, 160);
      if (!merchantId || !Array.isArray(input.items) || !input.items.length) throw new ContractError("QUOTE_ITEMS_REQUIRED", "請選擇商家與至少一項加購。", 422);
      const configs = await db.prepare("SELECT * FROM platform_addon_pricing_config WHERE enabled=1").all();
      const configMap = new Map((configs.results || []).map((item) => [item.code, item]));
      const items = input.items.map((item, index) => { const config = configMap.get(item.code); if (!config) throw new ContractError("ADDON_UNKNOWN", "加購項目不存在或未啟用。", 422); return { ...priceAddon(config, item.quantity, item.quoted_amount_minor), code: config.code, label: config.label, quantity: Number(item.quantity || 1), description: clean(item.description, 1000), sortOrder: index }; });
      const addonAmount = items.reduce((sum, item) => sum + item.amountMinor, 0), total = STANDARD_ADDON_PLAN.baseAmountMinor + addonAmount;
      const pricingHash = await hashCanonical({ plan: STANDARD_ADDON_PLAN.code, base_amount_minor: STANDARD_ADDON_PLAN.baseAmountMinor, items: items.map(({ sortOrder, ...item }) => item), addon_amount_minor: addonAmount, contract_total_minor: total });
      const id = uid("maq"), quoteNo = `BYQ-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
      await db.batch([
        db.prepare("INSERT INTO merchant_addon_quotes(id,merchant_id,change_request_id,quote_no,base_amount_minor,addon_amount_minor,contract_total_minor,status,expires_at,issued_by,issued_at,pricing_snapshot_hash) VALUES(?,?,?,?,?,?,?,'ISSUED',?,?,CURRENT_TIMESTAMP,?)").bind(id, merchantId, input.change_request_id || null, quoteNo, STANDARD_ADDON_PLAN.baseAmountMinor, addonAmount, total, input.expires_at || null, actorId, pricingHash),
        ...items.map((item) => db.prepare("INSERT INTO merchant_addon_quote_items(id,quote_id,pricing_code,label,quantity,unit_amount_minor,amount_minor,admin_quoted,description,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(uid("maqi"), id, item.code, item.label, item.quantity, item.unitAmountMinor, item.amountMinor, item.adminQuoted ? 1 : 0, item.description, item.sortOrder)),
        ...(input.change_request_id ? [db.prepare("UPDATE merchant_content_change_requests SET status='QUOTED',quote_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?").bind(id, input.change_request_id, merchantId)] : []),
      ]);
      await audit(db, request, merchantId, "admin", actorId, "addon_quote.issued", "addon_quote", id, { quote_no: quoteNo, addon_amount_minor: addonAmount, contract_total_minor: total, pricing_snapshot_hash: pricingHash });
      return json({ ok: true, id, quote_no: quoteNo, base_amount_minor: STANDARD_ADDON_PLAN.baseAmountMinor, addon_amount_minor: addonAmount, contract_total_minor: total }, 201, cors);
    }
    const payment = url.pathname.match(/^\/api\/admin\/addenda\/([^/]+)\/payment$/);
    if (payment && request.method === "PATCH") {
      const input = await request.json().catch(() => ({})), allowed = ["UNPAID","PENDING","PAID","REFUNDED","VOID"];
      if (!allowed.includes(input.payment_status)) throw new ContractError("PAYMENT_STATUS_INVALID", "付款狀態不正確。", 422);
      const row = await db.prepare("SELECT id,merchant_id,payment_status FROM merchant_contract_addenda WHERE id=?").bind(payment[1]).first(); if (!row) throw new ContractError("ADDENDUM_NOT_FOUND", "找不到補充協議。", 404);
      await db.prepare("UPDATE merchant_contract_addenda SET payment_status=? WHERE id=?").bind(input.payment_status, row.id).run();
      await audit(db, request, row.merchant_id, "admin", actorId, "addendum.payment_status.updated", "contract_addendum", row.id, { before: row.payment_status, after: input.payment_status }); return json({ ok: true }, 200, cors);
    }
    return null;
  } catch (error) {
    if (error instanceof ContractError) return json({ code: error.code, error: error.message }, error.status, cors);
    console.error(JSON.stringify({ service: "merchant_standard_addons_admin", error: error instanceof Error ? error.message : "unknown" }));
    return json({ code: "ADDON_ADMIN_SERVICE_ERROR", error: "加購管理服務暫時無法完成操作。" }, 503, cors);
  }
}
