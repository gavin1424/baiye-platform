import { ContractError, hashCanonical, stableStringify } from "./contract-engine.js";
import { sha256 } from "./contract-pdf.js";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers },
});
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const ip = (request) => request.headers.get("cf-connecting-ip") || null;

function assertMinor(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new ContractError("COMMERCIAL_TERMS_PAYMENT_DUE_REQUIRED", `商業條件缺少有效的 ${field}。`, 409);
  return number;
}

export function validatePaymentAuthority(terms) {
  const total = assertMinor(terms?.contract_total_amount_minor, "契約總額");
  const signatureDue = assertMinor(terms?.payment_due_at_signature_minor, "簽約應付款");
  const remaining = assertMinor(terms?.remaining_amount_minor, "剩餘款項");
  const postTrial = assertMinor(terms?.post_trial_payment_minor, "試用期後尾款");
  const trialMonths = assertMinor(terms?.trial_period_months, "試用月數");
  const scheduleType = String(terms?.payment_schedule_type || "");
  if (!["SIGNATURE_FULL", "SIGNATURE_AND_AFTER_TRIAL"].includes(scheduleType)) {
    throw new ContractError("COMMERCIAL_TERMS_PAYMENT_DUE_REQUIRED", "商業條件缺少明確付款排程。", 409);
  }
  if (signatureDue + remaining !== total || (scheduleType === "SIGNATURE_FULL" && (remaining !== 0 || postTrial !== 0 || trialMonths !== 0))) {
    throw new ContractError("PAYMENT_SCHEDULE_TOTAL_MISMATCH", "付款排程與契約總額不一致。", 409);
  }
  if (scheduleType === "SIGNATURE_AND_AFTER_TRIAL" && (postTrial !== remaining || trialMonths < 1)) {
    throw new ContractError("PAYMENT_SCHEDULE_TOTAL_MISMATCH", "試用期付款排程與契約總額不一致。", 409);
  }
  return { total, signatureDue, remaining, postTrial, trialMonths, scheduleType, currency: String(terms.currency || "TWD") };
}

function taipeiReferenceDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(now).replaceAll("-", "");
}

function addMonthsIso(iso, months) {
  const date = new Date(iso);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString();
}

export async function prepareSignaturePayment(db, { merchantId, signatureId, contractVersion, planId, terms, signedAt }) {
  const authority = validatePaymentAuthority(terms);
  const scheduleId = uid("mcps");
  const requestId = uid("mcpay");
  const paymentReference = `BY-${taipeiReferenceDate(new Date(signedAt))}-${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
  const expiresAt = addMonthsIso(signedAt, 1);
  const statements = [
    db.prepare(`INSERT INTO merchant_contract_payment_schedules(
      id,merchant_id,contract_signature_id,contract_version,plan_id,phase,sequence_number,
      currency,amount_due_minor,trial_period_months,status
    ) VALUES(?,?,?,?,?,'SIGNATURE',1,?,?,?,'pending')`)
      .bind(scheduleId, merchantId, signatureId, contractVersion, planId, authority.currency, authority.signatureDue, authority.trialMonths),
    db.prepare(`INSERT INTO merchant_contract_payment_requests(
      id,merchant_id,contract_signature_id,payment_schedule_id,contract_version,plan_id,
      currency,amount_due_minor,payment_method,provider,status,payment_reference,expires_at
    ) VALUES(?,?,?,?,?,?,?,?,'jkopay_manual_qr','jkopay_manual_qr','pending',?,?)`)
      .bind(requestId, merchantId, signatureId, scheduleId, contractVersion, planId, authority.currency, authority.signatureDue, paymentReference, expiresAt),
  ];
  if (authority.remaining > 0) {
    statements.push(db.prepare(`INSERT INTO merchant_contract_payment_schedules(
      id,merchant_id,contract_signature_id,contract_version,plan_id,phase,sequence_number,
      currency,amount_due_minor,trial_period_months,status
    ) VALUES(?,?,?,?,?,'AFTER_TRIAL',2,?,?,?,'pending')`)
      .bind(uid("mcps"), merchantId, signatureId, contractVersion, planId, authority.currency, authority.postTrial, authority.trialMonths));
  }
  return {
    statements,
    request: { id: requestId, payment_reference: paymentReference, amount_due_minor: authority.signatureDue, status: "pending" },
    next_url: `/merchant/payment/${requestId}`,
    authority,
  };
}

async function paymentRecord(db, paymentRequestId, merchantId = null) {
  const row = await db.prepare(`SELECT p.*,m.name merchant_name,s.public_id contract_public_id,s.signed_at,
      COALESCE(ls.lifecycle_status,s.lifecycle_status) lifecycle_status,c.name plan_name,c.contract_total_amount_minor,c.payment_due_at_signature_minor,
      c.remaining_amount_minor,c.trial_period_months,c.post_trial_payment_minor,
      cfg.display_name provider_display_name,cfg.recipient_display_name,cfg.qr_asset_key,cfg.payment_deep_link,cfg.enabled provider_enabled
    FROM merchant_contract_payment_requests p
    JOIN merchants m ON m.id=p.merchant_id
    JOIN merchant_contract_signatures s ON s.id=p.contract_signature_id AND s.merchant_id=p.merchant_id
    LEFT JOIN merchant_contract_lifecycle_states ls ON ls.contract_signature_id=s.id
    LEFT JOIN merchant_plan_catalog c ON c.plan_id=p.plan_id
    LEFT JOIN platform_payment_configurations cfg ON cfg.provider=p.provider
    WHERE p.id=? ${merchantId ? "AND p.merchant_id=?" : ""}`)
    .bind(...(merchantId ? [paymentRequestId, merchantId] : [paymentRequestId])).first();
  return row || null;
}

async function expirePendingPayment(db, row) {
  if (row?.status !== "pending" || !row.expires_at || Date.parse(row.expires_at) > Date.now()) return row;
  await db.batch([
    db.prepare("UPDATE merchant_contract_payment_requests SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(row.id),
    db.prepare("UPDATE merchant_contract_payment_schedules SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(row.payment_schedule_id),
  ]);
  return { ...row, status: "expired" };
}

function customerPayment(row) {
  return {
    id: row.id,
    merchant_name: row.merchant_name,
    plan_id: row.plan_id,
    plan_name: row.plan_name,
    contract_version: row.contract_version,
    contract_number: row.contract_public_id,
    payment_reference: row.payment_reference,
    currency: row.currency,
    amount_due_minor: Number(row.amount_due_minor),
    contract_total_amount_minor: Number(row.contract_total_amount_minor),
    payment_due_at_signature_minor: Number(row.payment_due_at_signature_minor),
    remaining_amount_minor: Number(row.remaining_amount_minor),
    trial_period_months: Number(row.trial_period_months),
    post_trial_payment_minor: Number(row.post_trial_payment_minor),
    payment_method: row.payment_method,
    payment_method_name: row.provider_display_name || "街口支付",
    recipient_display_name: row.recipient_display_name || "百工百業",
    payment_deep_link: row.payment_deep_link || null,
    qr_available: Number(row.provider_enabled) === 1 && Boolean(row.qr_asset_key),
    status: row.status,
    submitted_at: row.submitted_at,
    confirmed_at: row.confirmed_at,
    next_url: `/merchant/payment/${row.id}`,
  };
}

function validateEvidenceFile(file) {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) return null;
  if (file.size > 5 * 1024 * 1024) throw new ContractError("PAYMENT_EVIDENCE_TOO_LARGE", "付款證明圖片不得超過 5MB。", 413);
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) throw new ContractError("PAYMENT_EVIDENCE_TYPE_INVALID", "付款證明僅支援 JPEG、PNG 或 WebP。", 422);
  return file;
}

function magicMatches(bytes, type) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

async function audit(db, request, actorType, actorId, action, entityType, entityId, metadata) {
  await db.prepare("INSERT INTO audit_logs(id,actor_type,actor_id,action,entity_type,entity_id,metadata,ip_address) VALUES(?,?,?,?,?,?,?,?)")
    .bind(uid("audit"), actorType, actorId, action, entityType, entityId, JSON.stringify(metadata || {}), ip(request)).run();
}

export async function handleMerchantContractPayments(request, env, url, cors, authorization) {
  const db = env.FINANCE_DB;
  const match = url.pathname.match(/^\/api\/merchant\/contract-payments\/([^/]+)(?:\/(qr|submit))?$/);
  if (!match) return null;
  const paymentRequestId = decodeURIComponent(match[1]);
  const action = match[2] || "";
  let row = await paymentRecord(db, paymentRequestId, authorization.session.merchant_id);
  if (!row) {
    const exists = await db.prepare("SELECT id FROM merchant_contract_payment_requests WHERE id=?").bind(paymentRequestId).first();
    throw new ContractError(exists ? "PAYMENT_FORBIDDEN" : "PAYMENT_NOT_FOUND", exists ? "您沒有權限查看這筆付款。" : "找不到付款資料。", exists ? 403 : 404);
  }
  row = await expirePendingPayment(db, row);
  if (!action && request.method === "GET") return json({ payment: customerPayment(row) }, 200, cors);
  if (action === "qr" && request.method === "GET") {
    if (Number(row.provider_enabled) !== 1 || !row.qr_asset_key) throw new ContractError("PAYMENT_CONFIGURATION_REQUIRED", "付款 QR Code 尚未完成設定，請聯絡客服。", 503);
    const object = await env.CONTRACTS_BUCKET.get(row.qr_asset_key);
    if (!object) throw new ContractError("PAYMENT_QR_NOT_FOUND", "付款 QR Code 暫時無法取得。", 503);
    return new Response(object.body, { headers: { ...cors, "content-type": object.httpMetadata?.contentType || "image/png", "cache-control": "private, no-store" } });
  }
  if (action === "submit" && request.method === "POST") {
    if (!["pending", "rejected"].includes(row.status)) {
      if (["submitted", "confirmed"].includes(row.status)) return json({ payment: customerPayment(row), replay: true }, 200, cors);
      throw new ContractError("PAYMENT_NOT_SUBMITTABLE", "這筆付款目前不能回報。", 409);
    }
    const contentType = request.headers.get("content-type") || "";
    const form = contentType.includes("multipart/form-data") ? await request.formData() : null;
    const input = form ? Object.fromEntries(form.entries()) : await request.json().catch(() => ({}));
    const file = form ? validateEvidenceFile(form.get("evidence")) : null;
    let evidence = null;
    if (file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!magicMatches(bytes, file.type)) throw new ContractError("PAYMENT_EVIDENCE_MAGIC_INVALID", "付款證明圖片格式不正確。", 422);
      const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const key = `merchant-contract-payment-evidence/${row.merchant_id}/${row.id}/${uid("evidence")}.${extension}`;
      await env.CONTRACTS_BUCKET.put(key, bytes, { httpMetadata: { contentType: file.type, contentDisposition: "attachment" } });
      evidence = { key, contentType: file.type, sha256: await sha256(bytes) };
    }
    const payerPaymentAt = String(input.payment_at || "").trim() || null;
    const transactionReference = String(input.transaction_reference || "").trim().slice(0, 120) || null;
    const note = String(input.note || "").trim().slice(0, 1000) || null;
    try {
      await db.batch([
        db.prepare(`UPDATE merchant_contract_payment_requests SET status='submitted',submitted_at=CURRENT_TIMESTAMP,
        payer_payment_at=?,payer_transaction_reference=?,payer_note=?,evidence_object_key=?,evidence_content_type=?,evidence_sha256=?,updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND merchant_id=? AND status IN ('pending','rejected')`)
          .bind(payerPaymentAt, transactionReference, note, evidence?.key || null, evidence?.contentType || null, evidence?.sha256 || null, row.id, row.merchant_id),
        db.prepare("UPDATE merchant_contract_payment_schedules SET status='submitted',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.payment_schedule_id),
        db.prepare("UPDATE merchant_contract_lifecycle_states SET lifecycle_status='PAYMENT_SUBMITTED',updated_at=CURRENT_TIMESTAMP WHERE contract_signature_id=? AND merchant_id=?").bind(row.contract_signature_id, row.merchant_id),
      ]);
    } catch (error) {
      if (evidence?.key && env.CONTRACTS_BUCKET?.delete) await env.CONTRACTS_BUCKET.delete(evidence.key).catch(() => {});
      throw error;
    }
    await audit(db, request, "merchant", authorization.session.user_id, "PAYMENT_EVIDENCE_SUBMITTED", "merchant_contract_payment_request", row.id, { merchant_id: row.merchant_id, contract_signature_id: row.contract_signature_id, payment_reference: row.payment_reference, evidence_sha256: evidence?.sha256 || null });
    return json({ payment: customerPayment(await paymentRecord(db, row.id, row.merchant_id)), message: "付款資料已送出，待平台確認入帳。" }, 200, cors);
  }
  return null;
}

async function storeActivationEvidence(env, row, adminId, confirmedAt) {
  const record = {
    contract_signature_id: row.contract_signature_id,
    payment_request_id: row.id,
    payment_reference: row.payment_reference,
    amount_minor: Number(row.amount_due_minor),
    provider: row.provider,
    confirmed_at: confirmedAt,
    confirmed_by: adminId,
  };
  const activationEventHash = await hashCanonical(record);
  const bytes = new TextEncoder().encode(stableStringify({ ...record, activation_event_hash: activationEventHash }));
  const key = `contracts/merchants/${row.merchant_id}/${row.contract_version}/${row.contract_signature_id}/activation-${activationEventHash}.json`;
  await env.CONTRACTS_BUCKET.put(key, bytes, { httpMetadata: { contentType: "application/json", contentDisposition: "attachment" } });
  return { record, activationEventHash, key };
}

export async function handleMerchantContractPaymentsAdmin(request, env, url, cors, adminSession) {
  const db = env.FINANCE_DB;
  if (url.pathname === "/api/admin/merchant-payments/config/jkopay_manual_qr") {
    if (request.method === "GET") {
      const config = await db.prepare("SELECT provider,display_name,recipient_display_name,payment_deep_link,enabled,configured_at,updated_at,qr_asset_key IS NOT NULL qr_configured FROM platform_payment_configurations WHERE provider='jkopay_manual_qr'").first();
      return json({ config }, 200, cors);
    }
    if (request.method === "POST") {
      const form = await request.formData();
      const file = validateEvidenceFile(form.get("qr_asset"));
      const current = await db.prepare("SELECT qr_asset_key FROM platform_payment_configurations WHERE provider='jkopay_manual_qr'").first();
      let key = current?.qr_asset_key || null;
      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!magicMatches(bytes, file.type)) throw new ContractError("PAYMENT_QR_MAGIC_INVALID", "付款 QR Code 圖片格式不正確。", 422);
        const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
        key = `platform-payment-assets/jkopay_manual_qr/official-${await sha256(bytes)}.${extension}`;
        await env.CONTRACTS_BUCKET.put(key, bytes, { httpMetadata: { contentType: file.type, contentDisposition: "inline" } });
      }
      if (!key) throw new ContractError("PAYMENT_QR_REQUIRED", "請上傳正式街口支付 QR Code。", 422);
      const deepLink = String(form.get("payment_deep_link") || "").trim() || null;
      if (deepLink && !/^https:\/\//i.test(deepLink)) throw new ContractError("PAYMENT_DEEP_LINK_INVALID", "付款連結必須是正式 HTTPS 網址。", 422);
      await db.prepare(`UPDATE platform_payment_configurations SET qr_asset_key=?,payment_deep_link=?,enabled=1,
        configured_by=?,configured_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE provider='jkopay_manual_qr'`)
        .bind(key, deepLink, adminSession.admin_user_id).run();
      await audit(db, request, "admin", adminSession.admin_user_id, "PAYMENT_PROVIDER_CONFIGURED", "platform_payment_configuration", "jkopay_manual_qr", { qr_asset_key: key, deep_link_configured: Boolean(deepLink) });
      return json({ ok: true, provider: "jkopay_manual_qr", qr_configured: true, deep_link_configured: Boolean(deepLink) }, 200, cors);
    }
  }
  if (url.pathname === "/api/admin/merchant-payments" && request.method === "GET") {
    const rows = await db.prepare(`SELECT p.*,m.name merchant_name,s.public_id contract_public_id,s.signed_at
      FROM merchant_contract_payment_requests p JOIN merchants m ON m.id=p.merchant_id
      JOIN merchant_contract_signatures s ON s.id=p.contract_signature_id ORDER BY p.created_at DESC LIMIT 200`).all();
    return json({ items: rows.results || [] }, 200, cors);
  }
  const match = url.pathname.match(/^\/api\/admin\/merchant-payments\/([^/]+)\/(confirm|reject|evidence)$/);
  if (!match) return null;
  const row = await paymentRecord(db, decodeURIComponent(match[1]));
  if (!row) throw new ContractError("PAYMENT_NOT_FOUND", "找不到付款資料。", 404);
  if (match[2] === "evidence" && request.method === "GET") {
    if (!row.evidence_object_key) throw new ContractError("PAYMENT_EVIDENCE_NOT_FOUND", "這筆付款沒有上傳證明。", 404);
    const object = await env.CONTRACTS_BUCKET.get(row.evidence_object_key);
    if (!object) throw new ContractError("PAYMENT_EVIDENCE_NOT_FOUND", "付款證明暫時無法取得。", 404);
    return new Response(object.body, { headers: { ...cors, "content-type": row.evidence_content_type || "application/octet-stream", "cache-control": "private, no-store" } });
  }
  if (match[2] === "confirm" && request.method === "POST") {
    if (row.status === "confirmed") return json({ payment: row, replay: true }, 200, cors);
    if (row.status !== "submitted") throw new ContractError("PAYMENT_NOT_CONFIRMABLE", "付款資料尚未送出或目前不能確認。", 409);
    const signature = await db.prepare("SELECT * FROM merchant_contract_signatures WHERE id=? AND merchant_id=? AND status='VALID'").bind(row.contract_signature_id, row.merchant_id).first();
    const terms = signature ? await db.prepare("SELECT * FROM merchant_contract_commercial_terms WHERE id=? AND merchant_id=?").bind(signature.commercial_terms_id, row.merchant_id).first() : null;
    if (!signature || !terms || row.lifecycle_status === "VOID") throw new ContractError("CONTRACT_NOT_CONFIRMABLE", "契約無效或已作廢。", 409);
    const authority = validatePaymentAuthority(terms);
    if (Number(row.amount_due_minor) !== authority.signatureDue) throw new ContractError("PAYMENT_AMOUNT_MISMATCH", "付款金額與契約快照不一致，禁止確認。", 409);
    const confirmedAt = new Date().toISOString();
    const activation = await storeActivationEvidence(env, row, adminSession.admin_user_id, confirmedAt);
    const statements = [
      db.prepare("UPDATE merchant_contract_payment_requests SET status='confirmed',confirmed_at=?,confirmed_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted'").bind(confirmedAt, adminSession.admin_user_id, row.id),
      db.prepare("UPDATE merchant_contract_payment_schedules SET status='confirmed',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.payment_schedule_id),
      db.prepare("UPDATE merchant_contract_lifecycle_states SET lifecycle_status='EFFECTIVE',effective_at=?,updated_at=CURRENT_TIMESTAMP WHERE contract_signature_id=? AND merchant_id=?").bind(confirmedAt, row.contract_signature_id, row.merchant_id),
      db.prepare("UPDATE merchant_onboarding_states SET state='active',operation_locked=0,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=?").bind(row.merchant_id),
      db.prepare("UPDATE merchants SET status='active',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.merchant_id),
      db.prepare(`INSERT INTO merchant_contract_activation_evidence(
        id,merchant_id,contract_signature_id,payment_request_id,payment_reference,amount_minor,provider,
        confirmed_at,confirmed_by,activation_event_hash,evidence_object_key
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(uid("mcae"), row.merchant_id, row.contract_signature_id, row.id, row.payment_reference, row.amount_due_minor, row.provider, confirmedAt, adminSession.admin_user_id, activation.activationEventHash, activation.key),
    ];
    if (authority.remaining > 0) statements.push(db.prepare("UPDATE merchant_contract_payment_schedules SET due_at=?,updated_at=CURRENT_TIMESTAMP WHERE contract_signature_id=? AND phase='AFTER_TRIAL'").bind(addMonthsIso(confirmedAt, authority.trialMonths), row.contract_signature_id));
    try {
      await db.batch(statements);
    } catch (error) {
      if (env.CONTRACTS_BUCKET?.delete) await env.CONTRACTS_BUCKET.delete(activation.key).catch(() => {});
      throw error;
    }
    for (const action of ["PAYMENT_CONFIRMED", "CONTRACT_EFFECTIVE", "MERCHANT_ACTIVATED"]) {
      await audit(db, request, "admin", adminSession.admin_user_id, action, "merchant_contract_payment_request", row.id, { merchant_id: row.merchant_id, contract_signature_id: row.contract_signature_id, payment_reference: row.payment_reference, activation_event_hash: activation.activationEventHash });
    }
    return json({ payment: await paymentRecord(db, row.id), effective_at: confirmedAt, activation_event_hash: activation.activationEventHash }, 200, cors);
  }
  if (match[2] === "reject" && request.method === "POST") {
    if (row.status === "rejected") return json({ payment: row, replay: true }, 200, cors);
    if (row.status !== "submitted") throw new ContractError("PAYMENT_NOT_REJECTABLE", "付款資料尚未送出或目前不能退回。", 409);
    const input = await request.json().catch(() => ({}));
    const reason = String(input.reason || "").trim().slice(0, 500);
    if (!reason) throw new ContractError("REJECTION_REASON_REQUIRED", "請填寫退回原因。", 422);
    await db.batch([
      db.prepare("UPDATE merchant_contract_payment_requests SET status='rejected',rejected_at=CURRENT_TIMESTAMP,rejection_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted'").bind(reason, row.id),
      db.prepare("UPDATE merchant_contract_payment_schedules SET status='rejected',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.payment_schedule_id),
      db.prepare("UPDATE merchant_contract_lifecycle_states SET lifecycle_status='PAYMENT_REJECTED',updated_at=CURRENT_TIMESTAMP WHERE contract_signature_id=? AND merchant_id=?").bind(row.contract_signature_id, row.merchant_id),
    ]);
    await audit(db, request, "admin", adminSession.admin_user_id, "PAYMENT_REJECTED", "merchant_contract_payment_request", row.id, { merchant_id: row.merchant_id, contract_signature_id: row.contract_signature_id, reason });
    return json({ payment: await paymentRecord(db, row.id) }, 200, cors);
  }
  return null;
}

export async function paymentRequiredForMerchant(db, merchantId) {
  const row = await db.prepare(`SELECT p.id,p.status,COALESCE(ls.lifecycle_status,s.lifecycle_status) lifecycle_status FROM merchant_contract_payment_requests p
    JOIN merchant_contract_signatures s ON s.id=p.contract_signature_id
    LEFT JOIN merchant_contract_lifecycle_states ls ON ls.contract_signature_id=s.id
    WHERE p.merchant_id=? AND s.status='VALID' ORDER BY p.created_at DESC LIMIT 1`).bind(merchantId).first();
  if (!row || row.lifecycle_status === "EFFECTIVE") return null;
  return { code: "MERCHANT_PAYMENT_REQUIRED", status: row.status, payment_next_url: `/merchant/payment/${row.id}` };
}
