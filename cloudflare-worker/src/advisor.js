import { authenticatePlatformMember, findPlatformMemberByPhone, maskMemberPhone, normalizeTaiwanMobile } from "./platform-membership.js";
import { deriveMerchantPassword } from "./merchant-auth.js";
import { buildSignedAgreement, ContractError, sessionEvidenceHash, storePrivateAgreementArtifacts } from "./contract-engine.js";
import { sha256 } from "./contract-pdf.js";
import {
  ADVISOR_COMMISSION_MODE, ADVISOR_COMMISSION_POLICY_VERSION, ADVISOR_PROVIDER_FEE_POLICY,
  ADVISOR_SETTLEMENT_POLICY_VERSION, advisorCommissionSnapshot, advisorRefundReversalSnapshot,
  advisorMatchCopy, advisorPaymentReadiness, advisorStarLevel, assertAdvisorBookingTransition,
  classifyAdvisorNeed, moderateAdvisorContent,
} from "./advisor-core.js";

const E = new TextEncoder();
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const clean = (value, max = 300) => String(value ?? "").trim().slice(0, max);
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const random = (size = 32) => b64(crypto.getRandomValues(new Uint8Array(size)));
const hash = (value) => sha256(String(value));
const cookieValue = (request, name) => String(request.headers.get("cookie") || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || "";
const advisorCookie = (token, age = 28800) => `baiye_advisor_session=${token}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${age}`;
const safeJson = (value, fallback = {}) => { try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; } };
const clientIp = (request) => request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";

async function audit(db, request, action, resourceType, resourceId, { advisorId = null, actorType = "system", actorId = null, metadata = {} } = {}) {
  await db.prepare(`INSERT INTO advisor_audit_logs(id,advisor_id,actor_type,actor_id,action,resource_type,resource_id,ip_hash,user_agent_hash,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .bind(uid("advaudit"), advisorId, actorType, actorId, action, resourceType, resourceId || null, await hash(`ip:${clientIp(request)}`), await hash(`ua:${request.headers.get("user-agent") || "unknown"}`), JSON.stringify(metadata)).run();
}

function publicAdvisor(row) {
  const categories = safeJson(row.categories_json, []);
  return {
    id: row.advisor_id, slug: row.slug, display_name: row.display_name, tagline: row.tagline,
    biography: row.biography, specialties: safeJson(row.specialties_json, []), photo_url: row.photo_url || "",
    rating: Number(row.average_rating_bp || 0) / 100, completed_services: Number(row.completed_services_count || 0),
    star_level: advisorStarLevel(row.completed_services_count), profile_completeness: Number(row.profile_completeness || 0),
    categories, service_start_minor: Number(row.service_start_minor || 0), next_available_at: row.next_available_at || null,
  };
}

async function advisorBySlug(db, slug) {
  return db.prepare(`SELECT p.*,a.completed_services_count,
    (SELECT MIN(price_minor) FROM advisor_services s WHERE s.advisor_id=a.id AND s.active=1 AND s.moderation_status='approved') service_start_minor,
    (SELECT json_group_array(json_object('slug',c.slug,'name',c.display_name,'icon',c.icon_name)) FROM advisor_profile_categories pc JOIN advisor_categories c ON c.id=pc.category_id WHERE pc.advisor_id=a.id AND c.active=1) categories_json
    FROM advisor_profiles p JOIN advisors a ON a.id=p.advisor_id
    WHERE p.slug=? AND p.published=1 AND p.moderation_status='approved' AND a.status='ACTIVE' LIMIT 1`).bind(slug).first();
}

async function advisorAuth(request, env) {
  const raw = cookieValue(request, "baiye_advisor_session");
  if (!raw) return null;
  const row = await env.FINANCE_DB.prepare(`SELECT s.id session_id,s.advisor_id,s.platform_member_id,s.csrf_hash,s.expires_at,a.status,p.display_name,p.slug
    FROM advisor_sessions s JOIN advisors a ON a.id=s.advisor_id LEFT JOIN advisor_profiles p ON p.advisor_id=a.id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') AND a.status NOT IN('SUSPENDED','TERMINATED') LIMIT 1`).bind(await hash(raw)).first();
  if (row) await env.FINANCE_DB.prepare("UPDATE advisor_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.session_id).run();
  return row || null;
}

async function requireAdvisorMutation(request, env, session) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const supplied = clean(request.headers.get("x-csrf-token"), 200);
  if (!supplied || await hash(supplied) !== session.csrf_hash) throw Object.assign(new Error("CSRF_REQUIRED"), { status: 403, code: "CSRF_REQUIRED" });
  return true;
}

async function encryptionKeys(env) {
  if (!env.ADVISOR_PII_ENCRYPTION_KEY || !env.ADVISOR_PII_HMAC_KEY) throw Object.assign(new Error("Sensitive application storage is not configured"), { status: 503, code: "ADVISOR_PII_KEYS_REQUIRED" });
  const aesBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", E.encode(env.ADVISOR_PII_ENCRYPTION_KEY)));
  return {
    aes: await crypto.subtle.importKey("raw", aesBytes, "AES-GCM", false, ["encrypt"]),
    hmac: await crypto.subtle.importKey("raw", E.encode(env.ADVISOR_PII_HMAC_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
  };
}

async function protect(value, keys) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, keys.aes, E.encode(String(value)));
  return { ciphertext: b64(new Uint8Array(encrypted)), iv: b64(iv), hmac: b64(new Uint8Array(await crypto.subtle.sign("HMAC", keys.hmac, E.encode(String(value).trim().toLowerCase())))) };
}

async function rateLimitLogin(db, scope, rawKey, limit) {
  const key = await hash(`${scope}:${rawKey}`), bucket = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();
  const current = await db.prepare("SELECT attempt_count,locked_until FROM advisor_auth_rate_limits WHERE scope=? AND rate_key_hash=? AND bucket_start=?").bind(scope, key, bucket).first();
  if (current?.locked_until && new Date(current.locked_until) > new Date()) return false;
  if (Number(current?.attempt_count || 0) >= limit) return false;
  await db.prepare("INSERT INTO advisor_auth_rate_limits(scope,rate_key_hash,bucket_start,attempt_count) VALUES(?,?,?,1) ON CONFLICT(scope,rate_key_hash,bucket_start) DO UPDATE SET attempt_count=attempt_count+1").bind(scope, key, bucket).run();
  return true;
}

async function loginAdvisor(request, env, cors) {
  const input = await request.json(), phone = normalizeTaiwanMobile(input.phone), password = clean(input.password, 20);
  if (!phone || !await rateLimitLogin(env.FINANCE_DB, "advisor_login_phone", phone, 10) || !await rateLimitLogin(env.FINANCE_DB, "advisor_login_ip", clientIp(request), 30)) return json({ error: "手機號碼或會員密碼錯誤。" }, 401, cors);
  const member = await findPlatformMemberByPhone(env.FINANCE_DB, phone);
  const credential = member ? await env.FINANCE_DB.prepare("SELECT * FROM platform_member_login_credentials WHERE platform_member_id=? AND credential_type='numeric_password_8' AND status='active'").bind(member.id).first() : null;
  const fallbackSalt = "advisor-login-timing-fallback", derived = await deriveMerchantPassword(password || "invalid", credential?.password_salt || fallbackSalt, Number(credential?.password_iterations || 600000));
  const advisor = member ? await env.FINANCE_DB.prepare("SELECT a.*,p.display_name,p.slug FROM advisors a LEFT JOIN advisor_profiles p ON p.advisor_id=a.id WHERE a.platform_member_id=? AND a.status NOT IN('SUSPENDED','TERMINATED')").bind(member.id).first() : null;
  if (!credential || derived !== credential.password_hash || !advisor) {
    await audit(env.FINANCE_DB, request, "LOGIN_FAILED", "advisor", advisor?.id, { advisorId: advisor?.id, actorType: "advisor", actorId: member?.id });
    return json({ error: "手機號碼或會員密碼錯誤。" }, 401, cors);
  }
  const token = random(), csrf = random(), expires = new Date(Date.now() + 8 * 3600000).toISOString();
  await env.FINANCE_DB.prepare("INSERT INTO advisor_sessions(id,advisor_id,platform_member_id,token_hash,csrf_hash,expires_at) VALUES(?,?,?,?,?,?)").bind(uid("advsess"), advisor.id, member.id, await hash(token), await hash(csrf), expires).run();
  await audit(env.FINANCE_DB, request, "LOGIN_SUCCESS", "advisor", advisor.id, { advisorId: advisor.id, actorType: "advisor", actorId: member.id });
  return json({ advisor: { id: advisor.id, display_name: advisor.display_name, slug: advisor.slug, status: advisor.status }, csrf_token: csrf, expires_at: expires }, 200, { ...cors, "set-cookie": advisorCookie(token) });
}

export async function createAdvisorBooking(db, request, input, member, env) {
  const service = await db.prepare(`SELECT s.*,a.status advisor_status,p.published,p.moderation_status profile_moderation
    FROM advisor_services s JOIN advisors a ON a.id=s.advisor_id JOIN advisor_profiles p ON p.advisor_id=a.id WHERE s.id=? AND s.advisor_id=? AND s.active=1 AND s.moderation_status='approved'`).bind(clean(input.service_id, 100), clean(input.advisor_id, 100)).first();
  if (!service || service.advisor_status !== "ACTIVE" || !Number(service.published)) return { ok: false, status: 404, error: "找不到可預約服務。" };
  const date = clean(input.date, 10), time = clean(input.time, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { ok: false, status: 400, error: "預約日期或時間格式不正確。" };
  const start = new Date(`${date}T${time}:00+08:00`), end = new Date(start.getTime() + Number(service.duration_minutes) * 60000);
  if (!Number.isFinite(start.getTime()) || start <= new Date()) return { ok: false, status: 409, error: "此時段已無法預約。" };
  const weekday = start.getUTCDay(), availability = await db.prepare("SELECT * FROM advisor_availability WHERE advisor_id=? AND weekday=? AND active=1 AND start_time<=? AND end_time>=? ORDER BY max_concurrent DESC LIMIT 1").bind(service.advisor_id, weekday, time, new Date(end.getTime() + 8 * 3600000).toISOString().slice(11,16)).first();
  if (!availability) return { ok: false, status: 409, error: "此時段未開放預約。" };
  const blackout = await db.prepare("SELECT id FROM advisor_blackouts WHERE advisor_id=? AND active=1 AND start_at<? AND end_at>? LIMIT 1").bind(service.advisor_id, end.toISOString(), start.toISOString()).first();
  if (blackout) return { ok: false, status: 409, error: "此時段未開放預約。" };
  const staging = env.APP_MODE === "staging";
  const terms = await db.prepare(staging
    ? "SELECT * FROM advisor_consumer_terms_versions WHERE version='advisor_consumer_service_terms_v1_1_draft' LIMIT 1"
    : "SELECT * FROM advisor_consumer_terms_versions WHERE is_active=1 AND legal_review_status='approved' ORDER BY created_at DESC LIMIT 1").first();
  const cancellation = await db.prepare(staging
    ? "SELECT * FROM advisor_cancellation_policies WHERE version='advisor_cancellation_policy_v1_0' LIMIT 1"
    : "SELECT * FROM advisor_cancellation_policies WHERE status='approved' AND legal_review_status='approved' ORDER BY created_at DESC LIMIT 1").first();
  if (!terms || (terms.legal_review_status !== "approved" && !staging)) return { ok: false, status: 423, error: "服務條款尚待法律審閱。", code: "LEGAL_REVIEW_REQUIRED" };
  if (!cancellation || (cancellation.legal_review_status !== "approved" && !staging)) return { ok: false, status: 423, error: "取消退款政策尚待法律審閱。", code: "LEGAL_REVIEW_REQUIRED" };
  if (!input.accept_terms || !input.accept_service || !input.accept_price || !input.accept_cancellation || !input.accept_disclaimer) return { ok: false, status: 422, error: "請完成全部服務與條款確認。" };
  const readiness = advisorPaymentReadiness(env);
  if (!staging && !readiness.realPaymentEnabled) return { ok: false, status: 423, error: "顧問服務付款尚未啟用。", code: "PAYMENT_PROVIDER_DISABLED" };
  const id = uid("advbook"), code = `ADV-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${random(6).slice(0,8).toUpperCase()}`;
  const leadSource = ['platform_referred','advisor_referred','organic','campaign','admin_import'].includes(input.lead_source) ? input.lead_source : 'organic';
  const result = await db.prepare(`INSERT INTO advisor_bookings(id,booking_code,advisor_id,service_id,platform_member_id,start_at,end_at,blocked_start_at,blocked_end_at,service_mode,status,service_price_minor,payment_status,payment_provider,test_data,customer_note,terms_version,terms_hash,lead_source,cancellation_policy_version,cancellation_policy_hash)
    SELECT ?,?,?,?,?,?,?,?,?,?,'CONFIRMED',?,'PAID',?,1,?,?,?,?,?,? WHERE
    (SELECT COUNT(*) FROM advisor_bookings WHERE advisor_id=? AND status IN('SLOT_HELD','PAYMENT_PENDING','CONFIRMED','IN_SERVICE') AND blocked_start_at<? AND blocked_end_at>?) < ?`)
    .bind(id, code, service.advisor_id, service.id, member.id, start.toISOString(), end.toISOString(), start.toISOString(), end.toISOString(), service.service_mode, Number(service.price_minor), readiness.paymentProvider, clean(input.note, 1000) || null, terms.version, terms.content_hash, leadSource, cancellation.version, cancellation.content_hash, service.advisor_id, end.toISOString(), start.toISOString(), Number(availability.max_concurrent || 1)).run();
  if (!Number(result.meta?.changes || 0)) return { ok: false, status: 409, error: "此時段剛被預約，請選擇其他時間。", code: "SLOT_CONFLICT" };
  const acceptanceId = uid("advterms"), sessionHash = await hash(member.session_id || member.id);
  await db.batch([
    db.prepare("INSERT INTO advisor_consumer_terms_acceptances(id,booking_id,platform_member_id,terms_version,terms_hash,ip_hash,session_evidence_hash,consent_json) VALUES(?,?,?,?,?,?,?,?)").bind(acceptanceId,id,member.id,terms.version,terms.content_hash,await hash(`ip:${clientIp(request)}`),sessionHash,JSON.stringify({service:true,price:true,cancellation:true,disclaimer:true,cancellation_policy_version:cancellation.version,cancellation_policy_hash:cancellation.content_hash})),
    db.prepare("INSERT INTO advisor_booking_events(id,booking_id,advisor_id,actor_type,actor_id,event_type,from_status,to_status,metadata_json) VALUES(?,?,?,?,?,'BOOKING_CONFIRMED','PAYMENT_PENDING','CONFIRMED',?)").bind(uid("advbe"),id,service.advisor_id,"consumer",member.id,JSON.stringify({provider:readiness.paymentProvider,test_data:true})),
  ]);
  return { ok: true, status: 201, booking: await db.prepare("SELECT * FROM advisor_bookings WHERE id=?").bind(id).first() };
}

export async function recordAdvisorCommission(db, bookingId, { providerFeeMinor = 0, providerFeeActualMinor = null, providerFeeEstimatedMinor = null, providerFeeSource = "none", providerFeePolicy = ADVISOR_PROVIDER_FEE_POLICY, idempotencyKey = `commission:${bookingId}` } = {}) {
  const booking = await db.prepare("SELECT * FROM advisor_bookings WHERE id=?").bind(bookingId).first();
  if (!booking || booking.status !== "COMPLETED" || booking.payment_status !== "PAID" || Number(booking.test_data) === 1 || Number(booking.fraud_suspected || 0) === 1 || Number(booking.refunded_amount_minor || 0) >= Number(booking.service_price_minor)) return { created: false, excluded: true };
  const month = booking.completed_at.slice(0, 7), count = await db.prepare("SELECT COUNT(*) count FROM advisor_bookings WHERE advisor_id=? AND status='COMPLETED' AND payment_status='PAID' AND test_data=0 AND fraud_suspected=0 AND refunded_amount_minor<service_price_minor AND substr(completed_at,1,7)=?").bind(booking.advisor_id, month).first();
  const snapshot = advisorCommissionSnapshot({ servicePriceMinor: Number(booking.service_price_minor), providerFeeMinor, providerFeeActualMinor, providerFeeEstimatedMinor, providerFeeSource, monthlyCompletedCount: Number(count.count), providerFeePolicy });
  const id = uid("advledger");
  await db.prepare(`INSERT OR IGNORE INTO advisor_commission_ledger(id,advisor_id,booking_id,entry_type,service_price_minor,provider_fee_minor,advisor_rate_bp,platform_rate_bp,commission_policy_version,monthly_completed_count_at_snapshot,advisor_share_minor,platform_share_minor,refund_policy_version,idempotency_key,tier_at_completion,gross_amount_minor,provider_fee_actual_minor,provider_fee_estimated_minor,provider_fee_source,provider_fee_policy_version,commission_base_minor,rounding_policy) VALUES(?,?,?,'COMMISSION',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,booking.advisor_id,booking.id,snapshot.servicePriceMinor,snapshot.providerFeeMinor,snapshot.advisorRateBp,snapshot.platformRateBp,snapshot.commissionPolicyVersion,snapshot.monthlyCompletedCountAtSnapshot,snapshot.advisorShareMinor,snapshot.platformShareMinor,snapshot.refundPolicyVersion,idempotencyKey,snapshot.tierAtCompletion,snapshot.grossAmountMinor,snapshot.providerFeeActualMinor,snapshot.providerFeeEstimatedMinor,snapshot.providerFeeSource,snapshot.providerFeePolicyVersion,snapshot.commissionBaseMinor,snapshot.roundingPolicy).run();
  return { created: true, snapshot, id };
}

export async function reverseAdvisorCommission(db, bookingId, idempotencyKey, refundAmountMinor = null) {
  const original = await db.prepare("SELECT * FROM advisor_commission_ledger WHERE booking_id=? AND entry_type='COMMISSION'").bind(bookingId).first();
  if (!original) return { created: false, reason: "NO_COMMISSION" };
  const refund = advisorRefundReversalSnapshot({grossAmountMinor:Number(original.gross_amount_minor||original.service_price_minor),commissionBaseMinor:Number(original.commission_base_minor||original.service_price_minor),advisorRateBp:Number(original.advisor_rate_bp),roundingPolicy:original.rounding_policy,refundPolicyVersion:original.refund_policy_version},refundAmountMinor == null?Number(original.gross_amount_minor||original.service_price_minor):Number(refundAmountMinor));
  const id = uid("advledger");
  const result=await db.prepare(`INSERT OR IGNORE INTO advisor_commission_ledger(id,advisor_id,booking_id,entry_type,original_entry_id,service_price_minor,provider_fee_minor,advisor_rate_bp,platform_rate_bp,commission_policy_version,monthly_completed_count_at_snapshot,advisor_share_minor,platform_share_minor,refund_policy_version,idempotency_key,tier_at_completion,gross_amount_minor,provider_fee_source,provider_fee_policy_version,commission_base_minor,rounding_policy,reversal_amount_minor) VALUES(?,?,?,'REFUND_REVERSAL',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,original.advisor_id,original.booking_id,original.id,-refund.refundAmountMinor,0,Number(original.advisor_rate_bp),Number(original.platform_rate_bp),original.commission_policy_version,Number(original.monthly_completed_count_at_snapshot),-refund.advisorReversalMinor,-refund.platformReversalMinor,original.refund_policy_version,idempotencyKey,original.tier_at_completion,-refund.refundAmountMinor,'none',original.provider_fee_policy_version,-refund.reversalBaseMinor,original.rounding_policy,refund.refundAmountMinor).run();
  return { created: Number(result.meta?.changes||0)>0, id, refund };
}

export async function createAdvisorSettlementDraft(db, advisorId, periodStart, periodEnd) {
  const policy = await db.prepare("SELECT * FROM advisor_commission_policies WHERE version=?").bind(ADVISOR_COMMISSION_POLICY_VERSION).first();
  const entries = await db.prepare(`SELECT l.* FROM advisor_commission_ledger l LEFT JOIN advisor_settlement_items i ON i.ledger_entry_id=l.id WHERE l.advisor_id=? AND l.created_at>=? AND l.created_at<? AND i.id IS NULL ORDER BY l.created_at`).bind(advisorId,periodStart,periodEnd).all();
  const rows = entries.results || [], statementId = uid("advsettle"), advisorShare = rows.reduce((sum,row)=>sum+Number(row.advisor_share_minor),0), gross = rows.filter(row=>row.entry_type==='COMMISSION').reduce((sum,row)=>sum+Number(row.service_price_minor),0), reversal = rows.filter(row=>row.entry_type==='REFUND_REVERSAL').reduce((sum,row)=>sum+Number(row.advisor_share_minor),0);
  await db.prepare("INSERT INTO advisor_settlement_statements(id,statement_no,advisor_id,period_start,period_end,gross_service_minor,advisor_share_minor,reversal_minor,net_payable_minor,status,provider_fee_policy,tax_withholding_mode,payout_block_reason,settlement_policy_version) VALUES(?,?,?,?,?,?,?,?,?,'draft',?,?,?,?)")
    .bind(statementId,`ADV-STG-${Date.now()}`,advisorId,periodStart,periodEnd,gross,advisorShare,reversal,advisorShare,policy?.provider_fee_policy || ADVISOR_PROVIDER_FEE_POLICY,policy?.tax_withholding_mode || 'manual_review','PAYOUT_BLOCKED_POLICY_REQUIRED',ADVISOR_SETTLEMENT_POLICY_VERSION).run();
  for (const row of rows) await db.prepare("INSERT INTO advisor_settlement_items(id,statement_id,ledger_entry_id,amount_minor) VALUES(?,?,?,?)").bind(uid("advsi"),statementId,row.id,Number(row.advisor_share_minor)).run();
  return db.prepare("SELECT * FROM advisor_settlement_statements WHERE id=?").bind(statementId).first();
}

async function signAdvisorContract(request, env, cors, session) {
  const input = await request.json(), staging = env.CONTRACT_SIGNING_MODE === "staging", contract = await env.FINANCE_DB.prepare(staging
    ? "SELECT * FROM advisor_contract_versions WHERE version='advisor_partner_v1_1_draft' LIMIT 1"
    : "SELECT * FROM advisor_contract_versions WHERE is_active=1 AND legal_review_status='approved' ORDER BY created_at DESC LIMIT 1").first();
  if (!contract) return json({ error: "目前沒有可簽署契約。" }, 409, cors);
  if (contract.legal_review_status !== "approved" && !staging) return json({ code: "LEGAL_REVIEW_REQUIRED", error: "契約尚待法律審閱。" }, 423, cors);
  const key = clean(request.headers.get("idempotency-key"), 160);
  if (key.length < 12) return json({ error: "缺少有效 Idempotency-Key。" }, 400, cors);
  const existing = await env.FINANCE_DB.prepare("SELECT * FROM advisor_contract_operations WHERE party_id=? AND operation_type='sign' AND idempotency_key=?").bind(session.advisor_id,key).first();
  if (existing?.status === "completed") return json(safeJson(existing.result_json), 200, cors);
  const operationId = existing?.id || uid("advcontractop");
  if (!existing) await env.FINANCE_DB.prepare("INSERT INTO advisor_contract_operations(id,party_id,operation_type,idempotency_key,expires_at) VALUES(? ,?,'sign',?,datetime('now','+5 minutes'))").bind(operationId,session.advisor_id,key).run();
  try {
    const signatureId=uid("advsig"),publicId=`ADV-${random(12).toUpperCase()}`;
    const agreement=await buildSignedAgreement({title:contract.title,documentId:signatureId,publicId,verificationUrl:`${env.PUBLIC_SITE_URL || 'https://staging.invalid'}/#/verify-advisor-contract/${publicId}`,contract,partyType:"advisor",partyId:session.advisor_id,partyLabel:`平台方：創百業智慧鏈　顧問：${session.display_name}`,signatory:clean(input.legal_name,120),signatoryRole:"獨立生活顧問",signature:input.signature,consents:{read:input.read,electronic:input.electronic,commercial_terms:input.commercial_terms,authority:input.authority,signature_evidence:input.signature_evidence},consentVersion:"advisor-contract-consent-v1",sessionEvidence:await sessionEvidenceHash(session.session_id),ip:await hash(`ip:${clientIp(request)}`),userAgent:await hash(`ua:${request.headers.get('user-agent')||'unknown'}`),staging});
    const stored=await storePrivateAgreementArtifacts(env.CONTRACTS_BUCKET,`advisor-contracts/${session.advisor_id}/${signatureId}`,agreement);
    try {
      await env.FINANCE_DB.batch([
        env.FINANCE_DB.prepare("INSERT INTO advisor_contract_signatures(id,public_id,advisor_id,contract_version_id,legal_name,signed_at,contract_content_hash,signature_hash,document_hash,signature_data,signature_assurance_level,consent_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(signatureId,publicId,session.advisor_id,contract.id,clean(input.legal_name,120),agreement.signedAt,contract.content_hash,agreement.signatureHash,agreement.documentHash,agreement.signatureData,'standard_electronic_agreement_evidence','advisor-contract-consent-v1'),
        env.FINANCE_DB.prepare("INSERT INTO advisor_contract_artifacts(id,advisor_id,signature_id,artifact_type,object_key,sha256,content_type) VALUES(?,?,?,'signed_pdf',?,?,'application/pdf')").bind(uid("advart"),session.advisor_id,signatureId,stored.pdfKey,agreement.pdfHash),
        env.FINANCE_DB.prepare("INSERT INTO advisor_contract_artifacts(id,advisor_id,signature_id,artifact_type,object_key,sha256,content_type) VALUES(?,?,?,'evidence_json',?,?,'application/json')").bind(uid("advart"),session.advisor_id,signatureId,stored.evidenceKey,stored.evidenceHash),
        env.FINANCE_DB.prepare("UPDATE advisors SET contract_status='signed',status='PROFILE_SETUP',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(session.advisor_id),
      ]);
    } catch(error) { await stored.cleanup(); throw error; }
    const result={ok:true,signature_id:signatureId,public_id:publicId,version:contract.version,pdf_hash:agreement.pdfHash,legal_status:contract.legal_review_status,staging};
    await env.FINANCE_DB.prepare("UPDATE advisor_contract_operations SET status='completed',result_json=?,completed_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(result),operationId).run();
    return json(result,201,cors);
  } catch(error) { if(error instanceof ContractError) return json({code:error.code,error:error.message},error.status,cors); throw error; }
}

export async function handleAdvisorPublic(request, env, url, cors) {
  const db=env.FINANCE_DB;
  if (url.pathname === "/api/advisors/categories" && request.method === "GET") {
    const rows=await db.prepare("SELECT slug,display_name,description,icon_name,seo_title,seo_description,policy_disclaimer FROM advisor_categories WHERE active=1 ORDER BY sort_order,display_name").all(); return json({categories:rows.results||[]},200,cors);
  }
  if (url.pathname === "/api/advisors" && request.method === "GET") {
    const category=clean(url.searchParams.get("category"),80),query=clean(url.searchParams.get("q"),100),min=Number(url.searchParams.get("min_price")||0),max=Number(url.searchParams.get("max_price")||999999999),mode=clean(url.searchParams.get("mode"),30);
    const rows=await db.prepare(`SELECT p.*,a.completed_services_count,MIN(s.price_minor) service_start_minor,
      (SELECT json_group_array(json_object('slug',c2.slug,'name',c2.display_name,'icon',c2.icon_name)) FROM advisor_profile_categories pc2 JOIN advisor_categories c2 ON c2.id=pc2.category_id WHERE pc2.advisor_id=a.id AND c2.active=1) categories_json
      FROM advisors a JOIN advisor_profiles p ON p.advisor_id=a.id JOIN advisor_services s ON s.advisor_id=a.id AND s.active=1 AND s.moderation_status='approved'
      JOIN advisor_categories c ON c.id=s.category_id WHERE a.status='ACTIVE' AND p.published=1 AND p.moderation_status='approved'
      AND (?='' OR c.slug=?) AND (?='' OR p.display_name LIKE '%'||?||'%' OR p.tagline LIKE '%'||?||'%' OR p.specialties_json LIKE '%'||?||'%')
      AND s.price_minor BETWEEN ? AND ? AND (?='' OR s.service_mode=?) GROUP BY a.id ORDER BY p.average_rating_bp DESC,a.completed_services_count DESC,p.profile_completeness DESC`).bind(category,category,query,query,query,query,min,max,mode,mode).all();
    return json({advisors:(rows.results||[]).map(publicAdvisor),filters:{category,query,min,max,mode}},200,cors);
  }
  if (url.pathname === "/api/advisors/match" && request.method === "POST") {
    const input=await request.json(),slug=classifyAdvisorNeed(input.question),category=await db.prepare("SELECT * FROM advisor_categories WHERE slug=? AND active=1").bind(slug).first();
    const rows=await db.prepare(`SELECT p.*,a.completed_services_count,MIN(s.price_minor) service_start_minor,'[]' categories_json FROM advisors a JOIN advisor_profiles p ON p.advisor_id=a.id JOIN advisor_services s ON s.advisor_id=a.id JOIN advisor_categories c ON c.id=s.category_id WHERE c.slug=? AND a.status='ACTIVE' AND p.published=1 AND p.moderation_status='approved' AND s.active=1 AND s.moderation_status='approved' GROUP BY a.id ORDER BY p.average_rating_bp DESC,a.completed_services_count DESC,p.profile_completeness DESC LIMIT 5`).bind(slug).all();
    const relevant=rows.results||[],ids=relevant.map((row)=>row.advisor_id),needed=Math.max(0,3-relevant.length);
    const fallback=needed ? await db.prepare(`SELECT p.*,a.completed_services_count,MIN(s.price_minor) service_start_minor,'[]' categories_json FROM advisors a JOIN advisor_profiles p ON p.advisor_id=a.id JOIN advisor_services s ON s.advisor_id=a.id WHERE a.status='ACTIVE' AND p.published=1 AND p.moderation_status='approved' AND s.active=1 AND s.moderation_status='approved' AND a.id NOT IN (SELECT value FROM json_each(?)) GROUP BY a.id ORDER BY p.average_rating_bp DESC,a.completed_services_count DESC,p.profile_completeness DESC LIMIT ?`).bind(JSON.stringify(ids),needed).all() : {results:[]};
    return json({category:{slug,name:category?.display_name||"人生方向"},message:advisorMatchCopy(category?.display_name||"人生方向"),advisors:[...relevant,...(fallback.results||[])].slice(0,5).map(publicAdvisor),safety:"AI 僅協助分類與推薦，不提供算命、醫療診斷或重大人生決策結論。"},200,cors);
  }
  if (url.pathname === "/api/advisor/apply" && request.method === "POST") {
    const member=await authenticatePlatformMember(db,request); if(!member)return json({error:"請先使用百工會員身分登入。"},401,cors);
    const input=await request.json(),keys=await encryptionKeys(env),legal=await protect(clean(input.legal_name,120),keys),email=await protect(clean(input.email,160),keys),phone=await protect(member.phone_normalized,keys);
    if(!input.declarations?.independent_provider||!input.declarations?.content_policy||!input.declarations?.no_guaranteed_income)return json({error:"請完成必要聲明。"},422,cors);
    const id=uid("advapp"); await db.prepare(`INSERT INTO advisor_applications(id,platform_member_id,display_name,legal_name_ciphertext,legal_name_iv,identity_hmac,email_ciphertext,email_iv,phone_hmac,experience,introduction,service_modes_json,proposed_services_json,desired_pricing_json,portfolio_urls_json,declarations_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,member.id,clean(input.display_name,120),legal.ciphertext,legal.iv,legal.hmac,email.ciphertext,email.iv,phone.hmac,clean(input.experience,3000),clean(input.introduction,3000),JSON.stringify(input.service_modes||[]),JSON.stringify(input.proposed_services||[]),JSON.stringify(input.desired_pricing||{}),JSON.stringify(input.portfolio_urls||[]),JSON.stringify(input.declarations)).run();
    await audit(db,request,"ADVISOR_APPLIED","advisor_application",id,{actorType:"consumer",actorId:member.id}); return json({application_id:id,status:"APPLIED"},201,cors);
  }
  if (url.pathname === "/api/advisor/login" && request.method === "POST") return loginAdvisor(request,env,cors);
  const profileMatch=url.pathname.match(/^\/api\/advisors\/([^/]+)$/);
  if(profileMatch&&request.method==='GET'){
    const advisor=await advisorBySlug(db,decodeURIComponent(profileMatch[1])); if(!advisor)return json({error:"找不到此顧問。"},404,cors);
    const [services,reviews,media,cancellation]=await Promise.all([
      db.prepare("SELECT s.id,s.name,s.description,s.price_minor,s.currency,s.duration_minutes,s.service_mode,s.delivery_details,s.notice,c.slug category_slug,c.display_name category_name FROM advisor_services s JOIN advisor_categories c ON c.id=s.category_id WHERE s.advisor_id=? AND s.active=1 AND s.moderation_status='approved' ORDER BY s.sort_order,s.name").bind(advisor.advisor_id).all(),
      db.prepare("SELECT rating,review_text,created_at FROM advisor_reviews WHERE advisor_id=? AND moderation_status='approved' ORDER BY created_at DESC LIMIT 20").bind(advisor.advisor_id).all(),
      db.prepare("SELECT asset_type,public_url FROM advisor_media_assets WHERE advisor_id=? AND moderation_status='approved'").bind(advisor.advisor_id).all(),
      db.prepare("SELECT version,policy_json,content_hash,legal_review_status FROM advisor_cancellation_policies WHERE version='advisor_cancellation_policy_v1_0'").first(),
    ]);
    return json({advisor:publicAdvisor(advisor),services:services.results||[],reviews:reviews.results||[],media:media.results||[],cancellation_policy:cancellation?{version:cancellation.version,hash:cancellation.content_hash,status:cancellation.legal_review_status,rules:safeJson(cancellation.policy_json)}:null,ai_faq:{scope:["老師介紹","服務項目","價格","預約方式","服務方式","公開 FAQ"],disallowed:["命理判斷","醫療、法律或投資指示"]},disclaimer:"本平台顧問服務主要屬於文化、娛樂、生活探索、個人成長與一般陪談用途，不替代醫療、心理治療、法律、投資或其他依法須由專業資格人員提供的服務。"},200,cors);
  }
  const availabilityMatch=url.pathname.match(/^\/api\/advisors\/([^/]+)\/availability$/);
  if(availabilityMatch&&request.method==='GET'){
    const advisor=await advisorBySlug(db,decodeURIComponent(availabilityMatch[1])); if(!advisor)return json({error:"找不到此顧問。"},404,cors);
    const serviceId=clean(url.searchParams.get('service_id'),100),date=clean(url.searchParams.get('date'),10),service=await db.prepare("SELECT duration_minutes FROM advisor_services WHERE id=? AND advisor_id=? AND active=1").bind(serviceId,advisor.advisor_id).first();
    if(!service||!/^\d{4}-\d{2}-\d{2}$/.test(date))return json({error:"服務或日期不正確。"},400,cors);
    const weekday=new Date(`${date}T00:00:00+08:00`).getUTCDay(),hours=await db.prepare("SELECT * FROM advisor_availability WHERE advisor_id=? AND weekday=? AND active=1 ORDER BY start_time").bind(advisor.advisor_id,weekday).all(),slots=[];
    for(const row of hours.results||[]){for(let m=Number(row.start_time.slice(0,2))*60+Number(row.start_time.slice(3));m+Number(service.duration_minutes)<=Number(row.end_time.slice(0,2))*60+Number(row.end_time.slice(3));m+=30){const time=`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`,start=new Date(`${date}T${time}:00+08:00`),end=new Date(start.getTime()+Number(service.duration_minutes)*60000),occupied=await db.prepare("SELECT COUNT(*) count FROM advisor_bookings WHERE advisor_id=? AND status IN('SLOT_HELD','PAYMENT_PENDING','CONFIRMED','IN_SERVICE') AND blocked_start_at<? AND blocked_end_at>?").bind(advisor.advisor_id,end.toISOString(),start.toISOString()).first();if(start>new Date()&&Number(occupied.count)<Number(row.max_concurrent))slots.push(time)}}
    return json({date,timezone:'Asia/Taipei',slots},200,cors);
  }
  if(url.pathname==='/api/advisor/bookings'&&request.method==='POST'){
    const member=await authenticatePlatformMember(db,request);if(!member)return json({error:"請先登入或加入會員。"},401,cors);const result=await createAdvisorBooking(db,request,await request.json(),member,env);return json(result.ok?{booking:result.booking}:{error:result.error,code:result.code},result.status,cors);
  }
  const reviewMatch=url.pathname.match(/^\/api\/advisor\/bookings\/([^/]+)\/review$/);
  if(reviewMatch&&request.method==='POST'){
    const member=await authenticatePlatformMember(db,request);if(!member)return json({error:"請先登入會員。"},401,cors);const booking=await db.prepare("SELECT * FROM advisor_bookings WHERE id=? AND platform_member_id=?").bind(reviewMatch[1],member.id).first();if(!booking)return json({error:"找不到預約。"},404,cors);if(booking.status!=='COMPLETED'||booking.payment_status!=='PAID')return json({error:"只有已完成且已付款的服務可以評價。"},409,cors);const input=await request.json(),moderation=moderateAdvisorContent(input.review_text),id=uid('advreview');if(!Number.isInteger(input.rating)||input.rating<1||input.rating>5)return json({error:"評分必須為 1 到 5。"},422,cors);await db.prepare("INSERT INTO advisor_reviews(id,booking_id,advisor_id,platform_member_id,rating,review_text,moderation_status) VALUES(?,?,?,?,?,?,?)").bind(id,booking.id,booking.advisor_id,member.id,input.rating,clean(input.review_text,2000),moderation.status==='blocked'?'pending_review':'pending_review').run();return json({review_id:id,moderation_status:'pending_review'},201,cors);
  }
  return null;
}

export async function handleAdvisorPrivate(request,env,url,cors){
  const session=await advisorAuth(request,env);if(!session)return json({error:"請先登入顧問後台。"},401,cors);try{await requireAdvisorMutation(request,env,session)}catch(error){return json({code:error.code,error:"安全驗證失敗。"},error.status,cors)}const db=env.FINANCE_DB;
  if(url.pathname==='/api/advisor/session'&&request.method==='GET')return json({advisor:{id:session.advisor_id,display_name:session.display_name,slug:session.slug,status:session.status},permissions:['profile','services','availability','bookings','customers','reviews','media','earnings','contracts','account']},200,cors);
  if(url.pathname==='/api/advisor/logout'&&request.method==='POST'){await db.prepare("UPDATE advisor_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=?").bind(session.session_id).run();return json({ok:true},200,{...cors,'set-cookie':advisorCookie('',0)})}
  if(url.pathname==='/api/advisor/dashboard'&&request.method==='GET'){
    const metrics=await db.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN date(start_at)=date('now') THEN 1 ELSE 0 END) today,SUM(CASE WHEN status='CONFIRMED' THEN 1 ELSE 0 END) pending,SUM(CASE WHEN status='COMPLETED' AND substr(completed_at,1,7)=substr(CURRENT_TIMESTAMP,1,7) AND payment_status='PAID' AND test_data=0 THEN 1 ELSE 0 END) valid_month FROM advisor_bookings WHERE advisor_id=?`).bind(session.advisor_id).first();const profile=await db.prepare("SELECT profile_completeness,average_rating_bp FROM advisor_profiles WHERE advisor_id=?").bind(session.advisor_id).first();const earnings=await db.prepare("SELECT COALESCE(SUM(advisor_share_minor),0) amount FROM advisor_commission_ledger WHERE advisor_id=?").bind(session.advisor_id).first();const count=Number(metrics.valid_month||0),rate=count?advisorCommissionSnapshot({servicePriceMinor:100,monthlyCompletedCount:count,providerFeePolicy:'platform_absorbs'}).advisorRateBp:5000;return json({metrics:{month_bookings:Number(metrics.total||0),today:Number(metrics.today||0),pending:Number(metrics.pending||0),completed:Number(metrics.valid_month||0),valid_month:count,commission_rate_bp:rate,estimated_settlement_minor:Number(earnings.amount||0),rating:Number(profile?.average_rating_bp||0)/100,star_level:advisorStarLevel(count),profile_completeness:Number(profile?.profile_completeness||0)},payment:advisorPaymentReadiness(env)},200,cors)
  }
  if(url.pathname==='/api/advisor/profile'){
    if(request.method==='GET')return json({profile:await db.prepare("SELECT * FROM advisor_profiles WHERE advisor_id=?").bind(session.advisor_id).first()},200,cors);
    if(request.method==='PATCH'){const input=await request.json(),copy=`${input.tagline||''} ${input.biography||''}`,moderation=moderateAdvisorContent(copy);if(moderation.status==='blocked'){await audit(db,request,'CONTENT_BLOCKED','advisor_profile',session.advisor_id,{advisorId:session.advisor_id,actorType:'advisor',actorId:session.platform_member_id,metadata:{code:moderation.code}});return json({code:moderation.code,error:'內容含有不允許的宣稱。'},422,cors)}await db.prepare("UPDATE advisor_profiles SET display_name=?,tagline=?,biography=?,specialties_json=?,moderation_status='pending_review',updated_at=CURRENT_TIMESTAMP WHERE advisor_id=?").bind(clean(input.display_name,120),clean(input.tagline,200),clean(input.biography,5000),JSON.stringify(input.specialties||[]),session.advisor_id).run();return json({ok:true,moderation_status:'pending_review'},200,cors)}
  }
  if(url.pathname==='/api/advisor/services'){
    if(request.method==='GET'){const rows=await db.prepare("SELECT * FROM advisor_services WHERE advisor_id=? ORDER BY sort_order,name").bind(session.advisor_id).all();return json({services:rows.results||[]},200,cors)}
    if(request.method==='POST'){const input=await request.json(),moderation=moderateAdvisorContent(`${input.name||''} ${input.description||''} ${input.notice||''}`);if(moderation.status==='blocked')return json({code:moderation.code,error:'服務內容含有不允許的宣稱。'},422,cors);const price=Number(input.price_minor),duration=Number(input.duration_minutes);if(!Number.isInteger(price)||price<0||!Number.isInteger(duration))return json({error:'價格與時間格式不正確。'},422,cors);const id=uid('advservice');await db.prepare("INSERT INTO advisor_services(id,advisor_id,category_id,name,description,price_minor,duration_minutes,service_mode,delivery_details,notice,moderation_status,active) VALUES(?,?,?,?,?,?,?,?,?,?,'pending_review',0)").bind(id,session.advisor_id,clean(input.category_id,100),clean(input.name,160),clean(input.description,4000),price,duration,clean(input.service_mode,30),clean(input.delivery_details,1000)||null,clean(input.notice,1000)||null).run();return json({service_id:id,moderation_status:'pending_review'},201,cors)}
  }
  const serviceRoute=url.pathname.match(/^\/api\/advisor\/services\/([^/]+)$/);if(serviceRoute&&['PATCH','DELETE'].includes(request.method)){
    const existing=await db.prepare("SELECT * FROM advisor_services WHERE id=? AND advisor_id=?").bind(serviceRoute[1],session.advisor_id).first();if(!existing)return json({error:'找不到服務或無權限。'},404,cors);
    if(request.method==='DELETE'){await db.prepare("UPDATE advisor_services SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND advisor_id=?").bind(existing.id,session.advisor_id).run();return json({ok:true,archived:true},200,cors)}
    const input=await request.json(),moderation=moderateAdvisorContent(`${input.name||existing.name} ${input.description||existing.description} ${input.notice||existing.notice||''}`);if(moderation.status==='blocked')return json({code:moderation.code,error:'服務內容含有不允許的宣稱。'},422,cors);const price=Number(input.price_minor??existing.price_minor),duration=Number(input.duration_minutes??existing.duration_minutes);if(!Number.isInteger(price)||price<0||!Number.isInteger(duration))return json({error:'價格與時間格式不正確。'},422,cors);await db.prepare("UPDATE advisor_services SET name=?,description=?,price_minor=?,duration_minutes=?,service_mode=?,notice=?,moderation_status='pending_review',active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND advisor_id=?").bind(clean(input.name??existing.name,160),clean(input.description??existing.description,4000),price,duration,clean(input.service_mode??existing.service_mode,30),clean(input.notice??existing.notice,1000)||null,existing.id,session.advisor_id).run();return json({ok:true,moderation_status:'pending_review'},200,cors)
  }
  if(url.pathname==='/api/advisor/availability'){
    if(request.method==='GET'){const [hours,blackouts]=await Promise.all([db.prepare("SELECT * FROM advisor_availability WHERE advisor_id=? ORDER BY weekday,start_time").bind(session.advisor_id).all(),db.prepare("SELECT * FROM advisor_blackouts WHERE advisor_id=? ORDER BY start_at").bind(session.advisor_id).all()]);return json({availability:hours.results||[],blackouts:blackouts.results||[]},200,cors)}
    if(request.method==='POST'){const input=await request.json(),id=uid('advavail');await db.prepare("INSERT INTO advisor_availability(id,advisor_id,weekday,start_time,end_time,timezone,max_concurrent) VALUES(?,?,?,?,?,'Asia/Taipei',?)").bind(id,session.advisor_id,Number(input.weekday),clean(input.start_time,5),clean(input.end_time,5),Number(input.max_concurrent||1)).run();return json({id},201,cors)}
  }
  if(url.pathname==='/api/advisor/bookings'&&request.method==='GET'){const rows=await db.prepare("SELECT b.*,s.name service_name FROM advisor_bookings b JOIN advisor_services s ON s.id=b.service_id WHERE b.advisor_id=? ORDER BY b.start_at DESC").bind(session.advisor_id).all();return json({bookings:rows.results||[]},200,cors)}
  if(url.pathname==='/api/advisor/customers'&&request.method==='GET'){const rows=await db.prepare("SELECT b.platform_member_id,c.phone_normalized,MAX(b.created_at) last_booking_at,COUNT(*) booking_count FROM advisor_bookings b JOIN platform_members pm ON pm.id=b.platform_member_id JOIN ordering_customers c ON c.id=pm.customer_id WHERE b.advisor_id=? GROUP BY b.platform_member_id,c.phone_normalized ORDER BY last_booking_at DESC").bind(session.advisor_id).all();return json({customers:(rows.results||[]).map(row=>({platform_member_id:row.platform_member_id,phone_masked:maskMemberPhone(row.phone_normalized),last_booking_at:row.last_booking_at,booking_count:Number(row.booking_count)})),export_enabled:false,scope:'service_necessary_only'},200,cors)}
  if(url.pathname==='/api/advisor/reviews'&&request.method==='GET'){const rows=await db.prepare("SELECT id,booking_id,rating,review_text,moderation_status,created_at FROM advisor_reviews WHERE advisor_id=? ORDER BY created_at DESC").bind(session.advisor_id).all();return json({reviews:rows.results||[]},200,cors)}
  if(url.pathname==='/api/advisor/media'&&request.method==='GET'){const [assets,requests]=await Promise.all([db.prepare("SELECT id,asset_type,public_url,moderation_status,created_at FROM advisor_media_assets WHERE advisor_id=?").bind(session.advisor_id).all(),db.prepare("SELECT id,status,portrait_consent_confirmed,voice_consent_confirmed,created_at FROM advisor_ai_video_requests WHERE advisor_id=?").bind(session.advisor_id).all()]);return json({assets:assets.results||[],video_requests:requests.results||[],provider:'NOT_CONNECTED'},200,cors)}
  if(url.pathname==='/api/advisor/account'&&request.method==='GET')return json({platform_member_id:session.platform_member_id,advisor_id:session.advisor_id,status:session.status,role:'advisor'},200,cors);
  const complete=url.pathname.match(/^\/api\/advisor\/bookings\/([^/]+)\/complete$/);if(complete&&request.method==='POST'){const booking=await db.prepare("SELECT * FROM advisor_bookings WHERE id=? AND advisor_id=?").bind(complete[1],session.advisor_id).first();if(!booking)return json({error:'找不到預約。'},404,cors);assertAdvisorBookingTransition(booking.status,'IN_SERVICE');await db.prepare("UPDATE advisor_bookings SET status='IN_SERVICE',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(booking.id).run();assertAdvisorBookingTransition('IN_SERVICE','COMPLETED');await db.prepare("UPDATE advisor_bookings SET status='COMPLETED',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(booking.id).run();const commission=await recordAdvisorCommission(db,booking.id);return json({ok:true,status:'COMPLETED',commission},200,cors)}
  if(url.pathname==='/api/advisor/earnings'&&request.method==='GET'){const [ledger,statements,countRow]=await Promise.all([db.prepare("SELECT * FROM advisor_commission_ledger WHERE advisor_id=? ORDER BY created_at DESC").bind(session.advisor_id).all(),db.prepare("SELECT * FROM advisor_settlement_statements WHERE advisor_id=? ORDER BY period_start DESC").bind(session.advisor_id).all(),db.prepare("SELECT COUNT(*) count FROM advisor_bookings WHERE advisor_id=? AND status='COMPLETED' AND payment_status='PAID' AND test_data=0 AND fraud_suspected=0 AND refunded_amount_minor<service_price_minor AND substr(completed_at,1,7)=substr(CURRENT_TIMESTAMP,1,7)").bind(session.advisor_id).first()]);const count=Number(countRow?.count||0),tier=count>=200?{label:'200+',rate:6000,next:null}:count>=100?{label:'100–199',rate:5500,next:200-count}:count>=61?{label:'61–99',rate:5300,next:100-count}:count>=31?{label:'31–60',rate:5200,next:61-count}:{label:'1–30',rate:5000,next:31-count};return json({summary:{valid_completed_count:count,current_tier:tier.label,advisor_rate_bp:tier.rate,next_tier_remaining:tier.next,provider_fee_policy:ADVISOR_PROVIDER_FEE_POLICY,rounding_policy:'platform_remainder'},ledger:ledger.results||[],statements:statements.results||[],payout:advisorPaymentReadiness(env)},200,cors)}
  if(url.pathname==='/api/advisor/contracts/current'&&request.method==='GET'){const staging=env.CONTRACT_SIGNING_MODE==='staging',contract=await db.prepare(staging?"SELECT * FROM advisor_contract_versions WHERE version='advisor_partner_v1_1_draft' LIMIT 1":"SELECT * FROM advisor_contract_versions WHERE is_active=1 AND legal_review_status='approved' ORDER BY created_at DESC LIMIT 1").first(),signature=await db.prepare("SELECT public_id,signed_at,status FROM advisor_contract_signatures WHERE advisor_id=? ORDER BY signed_at DESC LIMIT 1").bind(session.advisor_id).first();return json({contract,signature,legal_gate:contract?.legal_review_status==='approved'?'approved':'LEGAL_REVIEW_REQUIRED'},200,cors)}
  if(url.pathname==='/api/advisor/contracts/sign'&&request.method==='POST')return signAdvisorContract(request,env,cors,session);
  if(url.pathname==='/api/advisor/media/video-requests'&&request.method==='POST'){const input=await request.json(),moderation=moderateAdvisorContent(input.script_text);if(moderation.status==='blocked')return json({code:moderation.code,error:'影片腳本含有不允許的宣稱。'},422,cors);const signed=await db.prepare("SELECT id FROM advisor_contract_signatures WHERE advisor_id=? AND status='VALID'").bind(session.advisor_id).first();if(!signed||!input.portrait_consent_confirmed)return json({code:'MEDIA_CONSENT_REQUIRED',error:'未完成肖像與 AI 影片使用授權。'},423,cors);const id=uid('advvideo');await db.prepare("INSERT INTO advisor_ai_video_requests(id,advisor_id,script_text,status,portrait_consent_confirmed,voice_consent_confirmed) VALUES(?,?,?,'script_review',?,?)").bind(id,session.advisor_id,clean(input.script_text,5000),input.portrait_consent_confirmed?1:0,input.voice_consent_confirmed?1:0).run();return json({id,status:'script_review',provider:'NOT_CONNECTED'},201,cors)}
  return json({error:'Not found'},404,cors)
}

export async function handleAdvisorAdmin(request,env,url,cors,adminSession){
  const db=env.FINANCE_DB,actor=adminSession?.admin_user_id||adminSession?.id||'admin';
  if(url.pathname==='/api/admin/advisors'&&request.method==='GET'){const rows=await db.prepare("SELECT a.*,p.display_name,p.slug,p.moderation_status FROM advisors a LEFT JOIN advisor_profiles p ON p.advisor_id=a.id ORDER BY a.created_at DESC").all();return json({advisors:rows.results||[]},200,cors)}
  if(url.pathname==='/api/admin/advisor-applications'&&request.method==='GET'){const rows=await db.prepare("SELECT id,platform_member_id,display_name,experience,introduction,service_modes_json,status,review_note,created_at,reviewed_at FROM advisor_applications ORDER BY created_at DESC").all();return json({applications:rows.results||[]},200,cors)}
  if(url.pathname==='/api/admin/advisor-services'&&request.method==='GET'){const rows=await db.prepare("SELECT s.*,p.display_name FROM advisor_services s JOIN advisor_profiles p ON p.advisor_id=s.advisor_id ORDER BY s.created_at DESC").all();return json({services:rows.results||[]},200,cors)}
  if(url.pathname==='/api/admin/advisor-bookings'&&request.method==='GET'){const rows=await db.prepare("SELECT b.*,p.display_name,s.name service_name FROM advisor_bookings b JOIN advisor_profiles p ON p.advisor_id=b.advisor_id JOIN advisor_services s ON s.id=b.service_id ORDER BY b.created_at DESC").all();return json({bookings:rows.results||[]},200,cors)}
  if(url.pathname==='/api/admin/advisor-reviews'&&request.method==='GET'){const rows=await db.prepare("SELECT r.*,p.display_name FROM advisor_reviews r JOIN advisor_profiles p ON p.advisor_id=r.advisor_id ORDER BY r.created_at DESC").all();return json({reviews:rows.results||[]},200,cors)}
  if(url.pathname==='/api/admin/advisor-content'&&request.method==='GET'){const [profiles,services,flags,media]=await Promise.all([db.prepare("SELECT * FROM advisor_profiles WHERE moderation_status!='approved'").all(),db.prepare("SELECT * FROM advisor_services WHERE moderation_status!='approved'").all(),db.prepare("SELECT * FROM advisor_policy_flags WHERE status='pending_review'").all(),db.prepare("SELECT * FROM advisor_ai_video_requests WHERE status IN('script_review','review_required')").all()]);return json({profiles:profiles.results||[],services:services.results||[],flags:flags.results||[],media:media.results||[]},200,cors)}
  if(url.pathname==='/api/admin/advisor-commissions'&&request.method==='GET'){const rows=await db.prepare("SELECT * FROM advisor_commission_ledger ORDER BY created_at DESC").all();return json({ledger:rows.results||[]},200,cors)}
  if(url.pathname==='/api/admin/advisor-settlements'&&request.method==='GET'){const rows=await db.prepare("SELECT * FROM advisor_settlement_statements ORDER BY period_start DESC").all();return json({settlements:rows.results||[]},200,cors)}
  if(url.pathname==='/api/admin/advisor-contracts'&&request.method==='GET'){const [versions,signatures]=await Promise.all([db.prepare("SELECT id,version,title,content_hash,legal_review_status,approved_content_hash,is_active,commission_policy_version,created_at FROM advisor_contract_versions ORDER BY created_at DESC").all(),db.prepare("SELECT id,public_id,advisor_id,contract_version_id,signed_at,document_hash,status FROM advisor_contract_signatures ORDER BY signed_at DESC").all()]);return json({versions:versions.results||[],signatures:signatures.results||[]},200,cors)}
  const approve=url.pathname.match(/^\/api\/admin\/advisor-applications\/([^/]+)\/approve$/);if(approve&&request.method==='POST'){const app=await db.prepare("SELECT * FROM advisor_applications WHERE id=? AND status IN('APPLIED','UNDER_REVIEW')").bind(approve[1]).first();if(!app)return json({error:'找不到可核准申請。'},404,cors);const id=uid('advisor');await db.batch([db.prepare("UPDATE advisor_applications SET status='CONTRACT_REQUIRED',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(actor,app.id),db.prepare("INSERT INTO advisors(id,platform_member_id,application_id,status) VALUES(?,?,?,'CONTRACT_REQUIRED')").bind(id,app.platform_member_id,app.id),db.prepare("INSERT INTO advisor_profiles(advisor_id,slug,display_name,tagline,biography,moderation_status,published) VALUES(?,?,?,'尚未完成品牌定位','尚未完成公開介紹','draft',0)").bind(id,`profile-${id.slice(-16)}`,app.display_name)]);await audit(db,request,'APPLICATION_APPROVED','advisor_application',app.id,{advisorId:id,actorType:'admin',actorId:actor});return json({advisor_id:id,status:'CONTRACT_REQUIRED'},200,cors)}
  if(url.pathname==='/api/admin/advisor-policies'&&request.method==='GET'){const [policies,commercial,commission,cancellation,settlement,contracts,terms]=await Promise.all([db.prepare("SELECT * FROM advisor_platform_policies ORDER BY policy_key").all(),db.prepare("SELECT * FROM advisor_commercial_policies ORDER BY created_at DESC").all(),db.prepare("SELECT * FROM advisor_commission_policies ORDER BY created_at DESC").all(),db.prepare("SELECT * FROM advisor_cancellation_policies ORDER BY created_at DESC").all(),db.prepare("SELECT * FROM advisor_settlement_policies ORDER BY created_at DESC").all(),db.prepare("SELECT version,legal_review_status,is_active FROM advisor_contract_versions ORDER BY created_at DESC").all(),db.prepare("SELECT version,legal_review_status,is_active,cancellation_policy_status FROM advisor_consumer_terms_versions ORDER BY created_at DESC").all()]);return json({platform_policies:policies.results||[],commercial_policies:commercial.results||[],commission_policies:commission.results||[],cancellation_policies:cancellation.results||[],settlement_policies:settlement.results||[],contract_versions:contracts.results||[],consumer_terms_versions:terms.results||[],payment:advisorPaymentReadiness(env),commission_application_mode:ADVISOR_COMMISSION_MODE,approval_actions_enabled:false},200,cors)}
  if(url.pathname==='/api/admin/advisor-settlements/draft'&&request.method==='POST'){const input=await request.json(),statement=await createAdvisorSettlementDraft(db,clean(input.advisor_id,100),clean(input.period_start,30),clean(input.period_end,30));await audit(db,request,'SETTLEMENT_DRAFT_CREATED','advisor_settlement',statement.id,{advisorId:input.advisor_id,actorType:'admin',actorId:actor});return json({statement},201,cors)}
  const refund=url.pathname.match(/^\/api\/admin\/advisor-bookings\/([^/]+)\/refund$/);if(refund&&request.method==='POST'){const booking=await db.prepare("SELECT * FROM advisor_bookings WHERE id=?").bind(refund[1]).first();if(!booking)return json({error:'找不到預約。'},404,cors);if(booking.status!=='COMPLETED')return json({error:'只有已完成服務可進入退款流程。'},409,cors);const input=await request.json(),amount=input.refund_amount_minor==null?Number(booking.service_price_minor):Number(input.refund_amount_minor);if(!Number.isInteger(amount)||amount<=0||amount>Number(booking.service_price_minor))return json({error:'退款金額不正確。'},422,cors);await db.prepare("UPDATE advisor_bookings SET status='REFUND_PENDING',payment_status='REFUND_PENDING',refunded_amount_minor=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(amount,booking.id).run();const reversal=await reverseAdvisorCommission(db,booking.id,clean(request.headers.get('idempotency-key'),160)||`refund:${booking.id}:${amount}`,amount);return json({status:'REFUND_PENDING',refund_amount_minor:amount,reversal},200,cors)}
  const moderate=url.pathname.match(/^\/api\/admin\/advisor-(services|profiles|reviews)\/([^/]+)\/approve$/);if(moderate&&request.method==='POST'){
    if(moderate[1]==='services')await db.prepare("UPDATE advisor_services SET moderation_status='approved',active=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(moderate[2]).run();
    else if(moderate[1]==='profiles')await db.batch([db.prepare("UPDATE advisor_profiles SET moderation_status='approved',published=1,updated_at=CURRENT_TIMESTAMP WHERE advisor_id=?").bind(moderate[2]),db.prepare("UPDATE advisors SET status='ACTIVE',updated_at=CURRENT_TIMESTAMP WHERE id=? AND contract_status='signed'").bind(moderate[2]),db.prepare("UPDATE advisor_applications SET status='ACTIVE',updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT application_id FROM advisors WHERE id=?)").bind(moderate[2])]);
    else await db.prepare("UPDATE advisor_reviews SET moderation_status='approved',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(moderate[2]).run();
    await audit(db,request,'CONTENT_APPROVED',`advisor_${moderate[1]}`,moderate[2],{actorType:'admin',actorId:actor});return json({ok:true},200,cors)
  }
  return json({error:'Not found'},404,cors)
}
