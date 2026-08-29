import {
  ContractError,
  STANDARD_ASSURANCE,
  assertContractSignable,
  beginContractOperation,
  buildSignedAgreement,
  completeContractOperation,
  sessionEvidenceHash,
  storePrivateAgreementArtifacts,
} from "./contract-engine.js";
import { ensurePlatformMember, finalizePlatformMembershipBatch, normalizeTaiwanMobile, preparePlatformMembershipBatch } from "./platform-membership.js";

const E = new TextEncoder();
const D = new TextDecoder();
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", ...headers } });
const id = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const now = () => new Date().toISOString();
const b64 = (value) => btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const ub64 = (value) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4)), (character) => character.charCodeAt(0));

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", E.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, E.encode(value)));
}
async function hash(value) { return b64(await crypto.subtle.digest("SHA-256", E.encode(value))); }
async function body(request) { try { return await request.json(); } catch { return {}; } }
const clientIp = (request) => request.headers.get("CF-Connecting-IP") || null;
function validSignature(value) {
  try {
    const signature = JSON.parse(value);
    return Array.isArray(signature.strokes) && signature.strokes.some((stroke) => Array.isArray(stroke) && stroke.length >= 2) && String(value).length < 100000;
  } catch { return false; }
}
async function audit(db, request, actorType, actorId, action, entityType, entityId, metadata = {}) {
  await db.prepare("INSERT INTO audit_logs (id,actor_type,actor_id,action,entity_type,entity_id,metadata,ip_address) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id("audit"), actorType, actorId, action, entityType, entityId, JSON.stringify(metadata), request ? clientIp(request) : null).run();
}
async function activeContract(db) { return db.prepare("SELECT * FROM contract_versions WHERE is_active=1 ORDER BY effective_date DESC LIMIT 1").first(); }
async function signedApprovedContract(db, partnerId) {
  return db.prepare("SELECT s.id,s.public_id,s.signed_at,s.status,v.version FROM contract_signatures s JOIN contract_versions v ON v.id=s.contract_version_id WHERE s.partner_id=? AND s.status='VALID' AND v.is_active=1 AND v.legal_review_status='approved' AND v.approved_content_hash=v.content_hash LIMIT 1").bind(partnerId).first();
}
function contractFailure(error, cors) {
  if (error instanceof ContractError) return json({ error: error.message, code: error.code, details: error.details }, error.status, cors);
  console.error(JSON.stringify({ service: "partner_contract", error: error instanceof Error ? error.message : "unknown" }));
  return json({ error: "契約系統暫時無法完成此操作。" }, 503, cors);
}
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "")); }
async function uniquePartnerCode(db) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = `AG${String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0")}`;
    if (!await db.prepare("SELECT id FROM partners WHERE partner_code=? OR referral_code=? LIMIT 1").bind(code, code).first()) return code;
  }
  throw Object.assign(new Error("無法建立承攬夥伴編號。"), { code: "PARTNER_CODE_UNAVAILABLE", status: 503 });
}
async function applicationRateLimit(db, request, email, phone) {
  const ipHash = await hash(`partner-apply-ip:${clientIp(request) || "unknown"}`);
  const emailHash = await hash(`partner-apply-email:${email}`);
  const phoneHash = await hash(`partner-apply-phone:${phone}`);
  for (const [actorId, limit] of [[ipHash, 30], [emailHash, 8], [phoneHash, 8]]) {
    const recent = await db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE actor_type='public' AND actor_id=? AND action='partner.application_attempted' AND created_at>datetime('now','-15 minutes')").bind(actorId).first();
    if (Number(recent?.count || 0) >= limit) return false;
    await audit(db, request, "public", actorId, "partner.application_attempted", "partner_application", actorId);
  }
  return true;
}
async function partnerByNormalizedPhone(db, phone) {
  const identity = await db.prepare("SELECT p.* FROM partner_application_identities i JOIN partners p ON p.id=i.partner_id WHERE i.phone_normalized=? LIMIT 1").bind(phone).first();
  if (identity) return identity;
  const variants = [phone, `+886${phone.slice(1)}`, `886${phone.slice(1)}`, `${phone.slice(0, 4)}-${phone.slice(4, 7)}-${phone.slice(7)}`];
  const rows = await db.prepare("SELECT * FROM partners WHERE phone IN (?,?,?,?) ORDER BY created_at LIMIT 2").bind(...variants).all();
  return rows.results?.[0] || null;
}
async function prepareActivationInvite(db, partnerId, hours = 24) {
  const issuedAt = now(), expiresAt = new Date(Date.now() + hours * 3600e3).toISOString(), raw = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  return {
    raw,
    expiresAt,
    statements: [
      db.prepare("UPDATE partner_invites SET used_at=? WHERE partner_id=? AND used_at IS NULL").bind(issuedAt, partnerId),
      db.prepare("INSERT INTO partner_invites (id,partner_id,token_hash,expires_at) VALUES (?,?,?,?)").bind(id("invite"), partnerId, await hash(raw), expiresAt),
    ],
  };
}
function activationUrl(raw, env) {
  const base = String(env.PUBLIC_SITE_URL || "https://baiyeconnect.com").replace(/\/$/, "");
  return `${base}/#/partner/activate?token=${encodeURIComponent(raw)}`;
}
function auditInsert(db, actorType, actorId, action, entityType, entityId, metadata = {}) {
  return db.prepare("INSERT INTO audit_logs (id,actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?,?,?)")
    .bind(id("audit"), actorType, actorId, action, entityType, entityId, JSON.stringify(metadata));
}
function randomToken() {
  return b64(crypto.getRandomValues(new Uint8Array(32)));
}
function partnerCookie(token, maxAge = 2592000) {
  return `partner_session=${token}; HttpOnly; Secure; SameSite=None; Partitioned; Path=/api/partner; Max-Age=${maxAge}`;
}
async function preparePartnerSession(db, partnerId, assuranceLevel, issuedVia, loginChallengeId = null) {
  const token = randomToken();
  const sessionId = id("partner_session");
  const expiresAt = new Date(Date.now() + 30 * 864e5).toISOString();
  return {
    token,
    sessionId,
    expiresAt,
    statement: db.prepare("INSERT INTO partner_sessions(id,partner_id,token_hash,assurance_level,issued_via,login_challenge_id,expires_at) VALUES(?,?,?,?,?,?,?)")
      .bind(sessionId, partnerId, await hash(token), assuranceLevel, issuedVia, loginChallengeId, expiresAt),
  };
}
async function partnerAuth(request, db) {
  const token = (request.headers.get("cookie") || "").match(/(?:^|;\s*)partner_session=([^;]+)/)?.[1];
  if (!token) return null;
  const session = await db.prepare("SELECT id,partner_id,assurance_level FROM partner_sessions WHERE token_hash=? AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP LIMIT 1").bind(await hash(token)).first();
  if (!session || !["activation_invite", "verified_phone", "trusted_existing_session"].includes(session.assurance_level)) return null;
  await db.prepare("UPDATE partner_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(session.id).run();
  return session;
}
async function partnerNextUrl(db, partnerId) {
  return await signedApprovedContract(db, partnerId) ? "/partner/dashboard" : "/partner/contract";
}
async function partnerLoginRateLimit(db, request, phone) {
  const bucket = new Date(Math.floor(Date.now() / 900000) * 900000).toISOString();
  const device = request.headers.get("x-device-id") || request.headers.get("user-agent") || "unknown";
  const entries = [
    ["partner_login_phone", await hash(`phone:${phone}`), 8],
    ["partner_login_ip", await hash(`ip:${clientIp(request) || "unknown"}`), 30],
    ["partner_login_device", await hash(`device:${device.slice(0, 300)}`), 12],
  ];
  for (const [scope, key, limit] of entries) {
    await db.prepare("INSERT INTO partner_login_rate_limits(scope,rate_key_hash,bucket_start,attempt_count) VALUES(?,?,?,1) ON CONFLICT(scope,rate_key_hash,bucket_start) DO UPDATE SET attempt_count=attempt_count+1").bind(scope, key, bucket).run();
    const row = await db.prepare("SELECT attempt_count FROM partner_login_rate_limits WHERE scope=? AND rate_key_hash=? AND bucket_start=?").bind(scope, key, bucket).first();
    if (Number(row?.attempt_count || 0) > limit) return false;
  }
  return true;
}
async function financeAdmin(request, env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !env.FINANCE_SESSION_SECRET) return false;
  const [payload, signature] = token.split(".");
  if (!payload || signature !== await hmac(payload, env.FINANCE_SESSION_SECRET)) return false;
  try { return JSON.parse(D.decode(ub64(payload))).exp > Date.now(); } catch { return false; }
}

export function partnerWorkflowStatus(partner, latestInvite = null, at = new Date()) {
  if (!partner) return { code: "APPLICATION_NOT_FOUND", state: "not_found", message: "查無可確認的申請紀錄，請檢查 Email，或重新提出申請。" };
  if (partner.status === "active" && partner.contract_status !== "signed") return { code: "PARTNER_CONTRACT_REQUIRED", state: "contract_required", message: "此承攬夥伴帳號已啟用；請登入後繼續完成合作契約。" };
  if (partner.status === "active") return { code: "PARTNER_ALREADY_ACTIVE", state: "active", message: "此 Email 已有承攬夥伴帳號，請直接登入。" };
  if (partner.status === "rejected") return { code: "PARTNER_REJECTED", state: "rejected", message: "此承攬夥伴申請目前未通過審核；如需協助，請聯絡平台客服。" };
  if (partner.status === "suspended") return { code: "PARTNER_SUSPENDED", state: "suspended", message: "此承攬夥伴帳號目前已暫停使用，請聯絡平台客服確認。" };
  if (partner.status === "terminated") return { code: "PARTNER_TERMINATED", state: "terminated", message: "此承攬夥伴帳號的合作關係已終止；如有疑問，請聯絡平台客服。" };
  if (!partner.approved_at) return { code: "HISTORICAL_PENDING_MIGRATION_REQUIRED", state: "historical_pending", message: "這是舊版申請紀錄，平台需完成一次性資料轉換後才能提供啟用方式。" };
  const validInvite = Boolean(latestInvite && !latestInvite.used_at && new Date(latestInvite.expires_at) > at);
  const expiredInvite = Boolean(latestInvite && !latestInvite.used_at && new Date(latestInvite.expires_at) <= at);
  if (expiredInvite) return { code: "PARTNER_INVITE_EXPIRED", state: "invite_expired", message: "您的帳號已通過審核，但啟用連結已失效。" };
  return { code: "PARTNER_PENDING_ACTIVATION", state: "pending_activation", has_valid_invite: validInvite, message: validInvite ? "您的承攬夥伴申請已通過，但帳號尚未完成啟用。請使用已收到的安全啟用通知。" : "您的承攬夥伴申請已通過，但帳號尚未完成啟用。" };
}

async function workflowForEmail(db, email) {
  const partner = await db.prepare("SELECT id,partner_code,status,approved_at,activated_at,contract_status,phone FROM partners WHERE email=? LIMIT 1").bind(email).first();
  if (!partner) return { partner: null, latestInvite: null, workflow: partnerWorkflowStatus(null) };
  const latestInvite = await db.prepare("SELECT id,expires_at,used_at,created_at FROM partner_invites WHERE partner_id=? ORDER BY created_at DESC LIMIT 1").bind(partner.id).first();
  return { partner, latestInvite, workflow: partnerWorkflowStatus(partner, latestInvite) };
}

async function publicStatusRateLimit(db, request, email, action) {
  const actorId = await hash(`${action}:${email}`);
  const recent = await db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE actor_type='public' AND actor_id=? AND action=? AND created_at>datetime('now','-15 minutes')").bind(actorId, action).first();
  if (Number(recent?.count || 0) >= 5) return { limited: true, actorId };
  await audit(db, request, "public", actorId, action, "partner_application", actorId);
  return { limited: false, actorId };
}

const LEVELS = [
  { key: "starter", label: "初階承攬夥伴", min: 1, max: 10, rate: 1000, monthly: 1, fallback: 1000 },
  { key: "advanced", label: "進階承攬夥伴", min: 11, max: 30, rate: 1500, monthly: 1, fallback: 1000 },
  { key: "intermediate", label: "中階承攬夥伴", min: 31, max: 70, rate: 2000, monthly: 2, fallback: 1500 },
  { key: "high", label: "高階承攬夥伴", min: 71, max: 120, rate: 2500, monthly: 3, fallback: 2000 },
  { key: "senior", label: "資深承攬夥伴", min: 121, max: Number.POSITIVE_INFINITY, rate: 3000, monthly: 4, fallback: 2500 },
];
export function contractorLevelForCompletedSales(count) {
  const n = Math.max(1, Number(count || 0));
  return LEVELS.find((level) => n >= level.min && n <= level.max) || LEVELS[LEVELS.length - 1];
}
const levelForCount = contractorLevelForCompletedSales;
// The tier applies from the *next* valid sale after a threshold is reached.
// `priorValidSales` is the completed historical count before the new sale.
export function commissionTier(priorValidSales) { return levelForCount(Math.max(1, Number(priorValidSales || 0))).rate; }
export function monthlyRequirementForCompletedSales(count) { return levelForCount(count).monthly; }

function taipeiYearMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit" }).formatToParts(date);
  return { year: Number(parts.find((p) => p.type === "year")?.value), month: Number(parts.find((p) => p.type === "month")?.value) };
}
function shiftYearMonth(year, month, offset) {
  const index = year * 12 + (month - 1) + offset;
  return { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1 };
}
function taipeiMonthStart(year, month) { return new Date(Date.UTC(year, month - 1, 1, -8)).toISOString(); }
function monthWindow(offset = 0, reference = new Date()) {
  const current = taipeiYearMonth(reference);
  const target = shiftYearMonth(current.year, current.month, offset);
  const next = shiftYearMonth(target.year, target.month, 1);
  return { key: `${target.year}-${String(target.month).padStart(2, "0")}-01`, start: taipeiMonthStart(target.year, target.month), end: taipeiMonthStart(next.year, next.month), year: target.year, month: target.month };
}
function firstFullMonthStart(activatedAt) {
  if (!activatedAt) return null;
  const ym = taipeiYearMonth(new Date(activatedAt));
  const next = shiftYearMonth(ym.year, ym.month, 1);
  return taipeiMonthStart(next.year, next.month);
}
async function validSalesInWindow(db, partnerId, start, end) {
  const row = await db.prepare("SELECT COUNT(*) count FROM commissions c JOIN orders o ON o.id=c.order_id WHERE c.partner_id=? AND c.commission_type='sales' AND o.payment_status='paid' AND datetime(c.earned_at)>=datetime(?) AND datetime(c.earned_at)<datetime(?)")
    .bind(partnerId, start, end).first();
  return Number(row?.count || 0);
}
async function validSalesCount(db, partnerId) {
  const row = await db.prepare("SELECT COUNT(*) count FROM commissions c JOIN orders o ON o.id=c.order_id WHERE c.partner_id=? AND c.commission_type='sales' AND o.payment_status='paid'")
    .bind(partnerId).first();
  return Number(row?.count || 0);
}
async function syncPartnerTotals(db, partnerId) {
  const row = await db.prepare("SELECT COUNT(*) count,COALESCE(SUM(o.amount_due),0) total FROM commissions c JOIN orders o ON o.id=c.order_id WHERE c.partner_id=? AND c.commission_type='sales' AND o.payment_status='paid'")
    .bind(partnerId).first();
  await db.prepare("UPDATE partners SET total_valid_sales=?,total_sales_amount=?,updated_at=? WHERE id=?")
    .bind(Number(row?.count || 0), Number(row?.total || 0), now(), partnerId).run();
  return { count: Number(row?.count || 0), total: Number(row?.total || 0) };
}
async function upsertQualification(db, partner, window, level) {
  const firstFull = firstFullMonthStart(partner.activated_at);
  if (!firstFull || new Date(window.start) < new Date(firstFull)) {
    return { result: "grace", actual_sales: 0, required_sales: level.monthly, next_month_rate: level.rate, identity_level: level.label };
  }
  const actual = await validSalesInWindow(db, partner.id, window.start, window.end);
  const met = actual >= level.monthly;
  const result = met ? "met" : "missed";
  const nextRate = met || level.key === "starter" ? level.rate : level.fallback;
  await db.prepare("INSERT INTO partner_monthly_qualifications (id,partner_id,month_start,identity_level,required_sales,actual_sales,next_month_rate,result,evaluated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(partner_id,month_start) DO UPDATE SET identity_level=excluded.identity_level,required_sales=excluded.required_sales,actual_sales=excluded.actual_sales,next_month_rate=excluded.next_month_rate,result=excluded.result,evaluated_at=excluded.evaluated_at")
    .bind(id("qual"), partner.id, window.key, level.label, level.monthly, actual, nextRate, result, now()).run();
  return { result, actual_sales: actual, required_sales: level.monthly, next_month_rate: nextRate, identity_level: level.label };
}
async function currentRewardContext(db, partner, sequence) {
  const level = levelForCount(sequence);
  const previous = monthWindow(-1);
  const qualification = await upsertQualification(db, partner, previous, level);
  const effectiveRate = qualification.result === "missed" && level.key !== "starter" ? level.fallback : level.rate;
  return { level, effectiveRate, qualification };
}

function addYearsSafe(date, years) {
  const copy = new Date(date);
  const month = copy.getUTCMonth();
  copy.setUTCFullYear(copy.getUTCFullYear() + years);
  if (copy.getUTCMonth() !== month) copy.setUTCDate(0);
  return copy;
}
export function vipCycleForActivation(activatedAt, at = new Date()) {
  const activation = new Date(activatedAt || at.toISOString());
  let cycleNo = 1;
  let start = activation;
  let end = addYearsSafe(start, 3);
  while (at >= end) { start = end; end = addYearsSafe(start, 3); cycleNo += 1; }
  return { cycleNo, start: start.toISOString(), end: end.toISOString() };
}
const vipCycle = vipCycleForActivation;

export function shouldTerminateStarterForInactivity({ activatedAt, status, previousMonthSales, monthBeforePreviousSales, referenceDate = new Date() }) {
  if (status !== "active" || !activatedAt) return false;
  const firstFull = firstFullMonthStart(activatedAt);
  const m2 = monthWindow(-2, referenceDate);
  return Boolean(firstFull && new Date(m2.start) >= new Date(firstFull) && Number(previousMonthSales) < 1 && Number(monthBeforePreviousSales) < 1);
}
export function vipReviewStatusForCount(validNewMerchants) { return Number(validNewMerchants) >= 1000 ? "pending_review" : "tracking"; }
async function syncVipReward(db, partnerId) {
  const partner = await db.prepare("SELECT id,activated_at FROM partners WHERE id=?").bind(partnerId).first();
  if (!partner?.activated_at) return null;
  const cycle = vipCycle(partner.activated_at);
  const countRow = await db.prepare("SELECT COUNT(DISTINCT o.merchant_id) count FROM commissions c JOIN orders o ON o.id=c.order_id JOIN partner_leads l ON l.id=o.lead_id AND l.partner_id=c.partner_id AND l.merchant_id=o.merchant_id WHERE c.partner_id=? AND c.commission_type='sales' AND o.payment_status='paid' AND o.partner_vip_eligible=1 AND datetime(c.earned_at)>=datetime(?) AND datetime(c.earned_at)<datetime(?)")
    .bind(partnerId, cycle.start, cycle.end).first();
  const count = Number(countRow?.count || 0);
  const existing = await db.prepare("SELECT * FROM partner_vip_rewards WHERE partner_id=? AND cycle_no=?").bind(partnerId, cycle.cycleNo).first();
  const desired = vipReviewStatusForCount(count);
  if (!existing) {
    await db.prepare("INSERT INTO partner_vip_rewards (id,partner_id,cycle_no,cycle_start,cycle_end,valid_new_merchants,status,qualified_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(id("vip"), partnerId, cycle.cycleNo, cycle.start, cycle.end, count, desired, count >= 1000 ? now() : null, now()).run();
  } else if (!["approved", "paid", "cancelled"].includes(existing.status)) {
    await db.prepare("UPDATE partner_vip_rewards SET valid_new_merchants=?,status=?,qualified_at=?,updated_at=? WHERE id=?")
      .bind(count, desired, count >= 1000 ? (existing.qualified_at || now()) : null, now(), existing.id).run();
  } else {
    await db.prepare("UPDATE partner_vip_rewards SET valid_new_merchants=?,updated_at=? WHERE id=?").bind(count, now(), existing.id).run();
  }
  return db.prepare("SELECT * FROM partner_vip_rewards WHERE partner_id=? AND cycle_no=?").bind(partnerId, cycle.cycleNo).first();
}

export async function awardCommissionForOrder(db, orderId, paymentId) {
  const order = await db.prepare("SELECT * FROM orders WHERE id=?").bind(orderId).first();
  if (!order?.partner_id || order.payment_status !== "paid") return;
  const existing = await db.prepare("SELECT id FROM commissions WHERE order_id=? AND commission_type='sales'").bind(orderId).first();
  if (existing) { await syncPartnerTotals(db, order.partner_id); await syncVipReward(db, order.partner_id); return; }
  const partner = await db.prepare("SELECT * FROM partners WHERE id=?").bind(order.partner_id).first();
  if (!partner || partner.status !== "active") return;
  if (!await signedApprovedContract(db, partner.id)) return { blocked: true, code: "PARTNER_CONTRACT_REQUIRED" };
  const prior = await validSalesCount(db, order.partner_id);
  const sequence = prior + 1;
  // A threshold is earned by this sale and applies from the following valid sale.
  const reward = await currentRewardContext(db, partner, Math.max(1, prior));
  await db.prepare("INSERT INTO commissions (id,partner_id,order_id,payment_id,commission_type,base_amount,service_bonus,adjustment_amount,final_amount,tier,status,earned_at,confirmed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id("commission"), order.partner_id, orderId, paymentId, "sales", reward.effectiveRate, 0, 0, reward.effectiveRate, sequence, "confirmed", now(), now()).run();
  await syncPartnerTotals(db, order.partner_id);
  await syncVipReward(db, order.partner_id);
}

export async function reverseOrderCommission(db, orderId, reason = "customer_refund") {
  const rows = await db.prepare("SELECT * FROM commissions WHERE order_id=? AND status NOT IN ('reversed','cancelled')").bind(orderId).all();
  for (const commission of rows.results) {
    const locked = await db.prepare("SELECT s.id FROM settlement_items si JOIN settlements s ON s.id=si.settlement_id WHERE si.commission_id=? AND s.status IN ('approved','paid') LIMIT 1").bind(commission.id).first();
    const amount = -Number(commission.final_amount);
    await db.prepare("INSERT INTO commission_adjustments (id,commission_id,reason,amount,status) VALUES (?,?,?,?,?)")
      .bind(id("adjust"), commission.id, reason, amount, locked ? "confirmed" : "cancelled").run();
    if (!locked) {
      await db.prepare("UPDATE commissions SET adjustment_amount=adjustment_amount+?,final_amount=0,status='reversed',updated_at=? WHERE id=?")
        .bind(amount, now(), commission.id).run();
    }
    if (commission.commission_type === "sales") {
      await syncPartnerTotals(db, commission.partner_id);
      await syncVipReward(db, commission.partner_id);
    }
  }
}

async function partnerDashboard(db, partnerId) {
  let partner = await db.prepare("SELECT partner_code,display_name,legal_name,referral_code,total_valid_sales,total_sales_amount,contract_status,contract_version,contract_signed_at,activated_at FROM partners WHERE id=?").bind(partnerId).first();
  const totals = await syncPartnerTotals(db, partnerId);
  partner = { ...partner, total_valid_sales: totals.count, total_sales_amount: totals.total };
  const level = levelForCount(Math.max(1, totals.count));
  const previous = await upsertQualification(db, { ...partner, id: partnerId }, monthWindow(-1), level);
  const currentRate = previous.result === "missed" && level.key !== "starter" ? level.fallback : level.rate;
  const commissions = await db.prepare("SELECT COALESCE(SUM(CASE WHEN status='confirmed' THEN final_amount ELSE 0 END),0) pending,COALESCE(SUM(CASE WHEN status='payable' THEN final_amount ELSE 0 END),0) payable,COALESCE(SUM(CASE WHEN status='paid' THEN final_amount ELSE 0 END),0) paid,COALESCE(SUM(CASE WHEN status='reversed' THEN adjustment_amount ELSE 0 END),0) reversed FROM commissions WHERE partner_id=?").bind(partnerId).first();
  const contract = await activeContract(db);
  const signature = contract ? await db.prepare("SELECT id,public_id,pdf_hash,signed_at,status FROM contract_signatures WHERE partner_id=? AND contract_version_id=? ORDER BY signed_at DESC LIMIT 1").bind(partnerId, contract.id).first() : null;
  const vip = await syncVipReward(db, partnerId);
  const nextBoundary = totals.count < 10 ? 11 : totals.count < 30 ? 31 : totals.count < 70 ? 71 : totals.count < 120 ? 121 : null;
  return {
    partner,
    commissions,
    identity_level: level.label,
    current_tier: currentRate,
    standard_tier: level.rate,
    monthly_requirement: level.monthly,
    previous_month_qualification: previous,
    next_tier: nextBoundary ? Math.max(0, nextBoundary - totals.count) : 0,
    vip: vip ? { cycle_no: vip.cycle_no, cycle_start: vip.cycle_start, cycle_end: vip.cycle_end, valid_new_merchants: vip.valid_new_merchants, target_merchants: vip.target_merchants, reward_amount: vip.reward_amount, status: vip.status } : null,
    contract: { version: contract?.version || null, signed: Boolean(signature), signature_id: signature?.id || null, signed_at: signature?.signed_at || null, legal_review_status: contract?.legal_review_status || "pending_review", resign_required: Boolean(contract?.requires_resign && !signature) },
    operation_locked: !Boolean(await signedApprovedContract(db, partnerId)),
    operation_lock_code: await signedApprovedContract(db, partnerId) ? null : "PARTNER_CONTRACT_REQUIRED",
  };
}

async function createSettlement(db, partnerId, start, end) {
  const duplicate = await db.prepare("SELECT id FROM settlements WHERE partner_id=? AND period_start=? AND period_end=? AND status!='cancelled'").bind(partnerId, start, end).first();
  if (duplicate) throw new Error("此期間已建立結算單。");
  const commissions = (await db.prepare("SELECT c.* FROM commissions c WHERE c.partner_id=? AND c.status IN ('confirmed','payable') AND datetime(c.earned_at)>=datetime(?) AND datetime(c.earned_at)<=datetime(?) AND NOT EXISTS (SELECT 1 FROM settlement_items si JOIN settlements s ON s.id=si.settlement_id WHERE si.commission_id=c.id AND s.status IN ('approved','paid'))").bind(partnerId, start, end).all()).results;
  const adjustments = (await db.prepare("SELECT a.* FROM commission_adjustments a JOIN commissions c ON c.id=a.commission_id WHERE c.partner_id=? AND a.status='confirmed' AND a.settlement_id IS NULL AND datetime(a.created_at)>=datetime(?) AND datetime(a.created_at)<=datetime(?)").bind(partnerId, start, end).all()).results;
  const gross = commissions.reduce((sum, row) => sum + Number(row.base_amount), 0);
  const legacyService = commissions.reduce((sum, row) => sum + Number(row.service_bonus || 0), 0);
  const adjustment = adjustments.reduce((sum, row) => sum + Number(row.amount), 0);
  const refund = adjustments.filter((row) => String(row.reason).includes("refund")).reduce((sum, row) => sum + Number(row.amount), 0);
  const settlementId = id("settlement");
  const statements = [db.prepare("INSERT INTO settlements (id,settlement_no,partner_id,period_start,period_end,gross_commission,service_bonus,refund_deduction,other_adjustment,net_payable,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(settlementId, `SET-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, partnerId, start, end, gross, legacyService, refund, adjustment - refund, commissions.reduce((sum, row) => sum + Number(row.final_amount), 0) + adjustment, "draft")];
  for (const row of commissions) statements.push(db.prepare("INSERT INTO settlement_items (id,settlement_id,commission_id,amount) VALUES (?,?,?,?)").bind(id("settleitem"), settlementId, row.id, row.final_amount));
  for (const row of adjustments) {
    statements.push(db.prepare("INSERT INTO settlement_adjustment_items (id,settlement_id,adjustment_id,amount) VALUES (?,?,?,?)").bind(id("settleadjust"), settlementId, row.id, row.amount));
    statements.push(db.prepare("UPDATE commission_adjustments SET settlement_id=? WHERE id=?").bind(settlementId, row.id));
  }
  await db.batch(statements);
  return db.prepare("SELECT * FROM settlements WHERE id=?").bind(settlementId).first();
}

async function evaluateInactivityForPartner(db, partner) {
  if (!partner.activated_at || partner.status !== "active") return false;
  const totals = await syncPartnerTotals(db, partner.id);
  const currentLevel = levelForCount(Math.max(1, totals.count));
  await upsertQualification(db, partner, monthWindow(-1), currentLevel);
  await upsertQualification(db, partner, monthWindow(-2), currentLevel);
  if (currentLevel.key !== "starter") return false;
  const m1 = monthWindow(-1), m2 = monthWindow(-2);
  const [sales1, sales2] = await Promise.all([validSalesInWindow(db, partner.id, m1.start, m1.end), validSalesInWindow(db, partner.id, m2.start, m2.end)]);
  if (!shouldTerminateStarterForInactivity({ activatedAt: partner.activated_at, status: partner.status, previousMonthSales: sales1, monthBeforePreviousSales: sales2 })) return false;
  const timestamp = now();
  await db.prepare("UPDATE partners SET status='terminated',terminated_for_inactivity_at=?,updated_at=? WHERE id=? AND status='active'").bind(timestamp, timestamp, partner.id).run();
  await audit(db, null, "system", "monthly_qualification", "partner_auto_terminated_inactivity", "partner", partner.id, { months: [m2.key, m1.key], reason: "two_consecutive_full_months_without_valid_sale" });
  return true;
}

export async function runPartnerDailyMaintenance(env) {
  const db = env.FINANCE_DB;
  if (!db) return { ok: false, reason: "database_unavailable" };
  const partners = await db.prepare("SELECT * FROM partners WHERE status='active'").all();
  let terminated = 0;
  for (const partner of partners.results) {
    try {
      if (await evaluateInactivityForPartner(db, partner)) terminated += 1;
      if (partner.status === "active") await syncVipReward(db, partner.id);
    } catch (error) { console.error("Contractor daily maintenance failed", partner.id, error instanceof Error ? error.message : error); }
  }
  return { ok: true, checked: partners.results.length, terminated };
}

export async function handlePartnerRequest(request, env, url, cors, adminAuthorized = false) {
  const db = env.FINANCE_DB, path = url.pathname;
  if (!db) return json({ error: "財務資料庫目前無法使用。" }, 503, cors);

  if (path === "/api/partner/apply" && request.method === "POST") {
    const input = await body(request);
    if (!input.legal_name || !input.email || !input.phone || !input.consent) return json({ error: "請完整填寫必填資料，並確認獨立承攬／居間合作聲明。" }, 400, cors);
    const email = String(input.email).trim().toLowerCase();
    const phone = normalizeTaiwanMobile(input.phone);
    if (!validEmail(email)) return json({ error: "請輸入有效的 Email。", code: "INVALID_EMAIL" }, 422, cors);
    if (!phone) return json({ error: "請輸入正確的台灣手機號碼。", code: "INVALID_PHONE" }, 422, cors);
    if (!await applicationRateLimit(db, request, email, phone)) return json({ error: "申請操作過於頻繁，請 15 分鐘後再試。", code: "RATE_LIMITED" }, 429, cors);
    const existing = await workflowForEmail(db, email);
    if (existing.partner) {
      if (normalizeTaiwanMobile(existing.partner.phone) !== phone) return json({ error: "此申請資料已存在，身分資料不符，請聯絡平台客服。", code: "PARTNER_IDENTITY_MISMATCH" }, 409, cors);
      if (["suspended", "terminated", "rejected"].includes(existing.partner.status)) return json({ error: existing.workflow.message, ...existing.workflow }, 409, cors);
      if (!existing.partner.approved_at) return json({ error: "此為既有待處理申請，請由平台管理員使用歷史申請批次核准功能處理。", code: "HISTORICAL_PENDING_REVIEW", state: "historical_pending_review" }, 409, cors);
      if (existing.partner.status === "active") return json({ error: existing.workflow.message, ...existing.workflow, next_url: "/partner/login" }, 409, cors);
      const invite = await prepareActivationInvite(db, existing.partner.id);
      const membership = await preparePlatformMembershipBatch(db, { phone, source: "phone", privacyConsentVersion: "partner-auto-approval-v1", issueSession: false });
      const statements = [...invite.statements, ...membership.statements,
        db.prepare("INSERT OR IGNORE INTO partner_platform_member_links(partner_id,member_id) VALUES(?,?)").bind(existing.partner.id, membership.memberId),
        auditInsert(db, "system", "partner_auto_approval", "partner.activation_invite_created", "partner", existing.partner.id, { expires_at: invite.expiresAt, reissued: true })];
      if (membership.memberCreated) statements.push(auditInsert(db, "system", "partner_auto_approval", "platform_member.created", "platform_member", membership.memberId, { source: "partner_application" }));
      else statements.push(auditInsert(db, "system", "partner_auto_approval", "platform_member.linked", "platform_member", membership.memberId, { source: "partner_application" }));
      if (membership.couponCreated) statements.push(auditInsert(db, "system", "partner_auto_approval", "platform_coupon.claimed", "platform_member", membership.memberId, { campaign_id: "platform_welcome_member_v1" }));
      await db.batch(statements);
      const member = await finalizePlatformMembershipBatch(db, membership);
      return json({ code: "PARTNER_ALREADY_APPROVED", state: "pending_activation", partner_code: existing.partner.partner_code, approved_at: existing.partner.approved_at, activation_url: activationUrl(invite.raw, env), activation_expires_at: invite.expiresAt, membership: member.member, welcome: member.welcome, coupon: member.coupon }, 200, { ...cors, "cache-control": "no-store" });
    }
    const phoneOwner = await partnerByNormalizedPhone(db, phone);
    if (phoneOwner) return json({ error: "此手機已建立承攬夥伴申請；如需協助，請聯絡平台客服。", code: "PARTNER_PHONE_ALREADY_REGISTERED" }, 409, cors);
    const partnerId = id("partner"), partnerCode = await uniquePartnerCode(db), approvedAt = now();
    try {
      const invite = await prepareActivationInvite(db, partnerId);
      const membership = await preparePlatformMembershipBatch(db, { phone, source: "phone", privacyConsentVersion: "partner-auto-approval-v1", issueSession: false });
      const statements = [
        db.prepare("INSERT INTO partners (id,partner_code,legal_name,display_name,email,phone,company_name,tax_id,status,referral_code,approved_at,approved_by,approval_mode,auto_approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'system','automatic',?)")
          .bind(partnerId, partnerCode, String(input.legal_name).slice(0, 80), String(input.display_name || input.legal_name).slice(0, 80), email, phone, input.company_name || null, input.tax_id || null, "pending_contract", partnerCode, approvedAt, approvedAt),
        db.prepare("INSERT INTO partner_application_identities(phone_normalized,partner_id) VALUES(?,?)").bind(phone, partnerId),
        ...invite.statements,
        ...membership.statements,
        db.prepare("INSERT INTO partner_platform_member_links(partner_id,member_id) VALUES(?,?)").bind(partnerId, membership.memberId),
        auditInsert(db, "system", "partner_auto_approval", "partner.application_submitted", "partner", partnerId, { independent_contractor_consent: true }),
        auditInsert(db, "system", "partner_auto_approval", "partner.auto_approved", "partner", partnerId, { approval_mode: "automatic" }),
        auditInsert(db, "system", "partner_auto_approval", "partner.activation_invite_created", "partner", partnerId, { expires_at: invite.expiresAt }),
      ];
      if (membership.memberCreated) statements.push(auditInsert(db, "system", "partner_auto_approval", "platform_member.created", "platform_member", membership.memberId, { source: "partner_application" }));
      else statements.push(auditInsert(db, "system", "partner_auto_approval", "platform_member.linked", "platform_member", membership.memberId, { source: "partner_application" }));
      if (membership.couponCreated) statements.push(auditInsert(db, "system", "partner_auto_approval", "platform_coupon.claimed", "platform_member", membership.memberId, { campaign_id: "platform_welcome_member_v1" }));
      await db.batch(statements);
      const member = await finalizePlatformMembershipBatch(db, membership);
      const contract = await activeContract(db);
      return json({ id: partnerId, partner_code: partnerCode, status: "pending_contract", state: "pending_activation", approved_at: approvedAt, approval_mode: "automatic", activation_url: activationUrl(invite.raw, env), activation_expires_at: invite.expiresAt, membership: member.member, welcome: { show: member.created, title: "歡迎成為創百業會員！", message: "您也已成為創百業會員，NT$100 迎新禮券已放入會員帳戶。" }, coupon: member.coupon, contract: { version: contract?.version || null, legal_review_status: contract?.legal_review_status || "pending_review", signing_available: Boolean(contract?.legal_review_status === "approved" && contract?.approved_content_hash === contract?.content_hash) } }, 201, { ...cors, "cache-control": "no-store" });
    } catch (error) {
      if (String(error?.message || "").includes("UNIQUE")) return json({ error: "此 Email 或手機已建立承攬夥伴申請。", code: "PARTNER_DUPLICATE_IDENTITY" }, 409, cors);
      console.error(JSON.stringify({ service: "partner_apply", code: error?.code || "APPLY_FAILED" }));
      return json({ error: "申請暫時無法送出，請稍後再試。" }, Number(error?.status || 503), cors);
    }
  }

  if (path === "/api/partner/status" && request.method === "POST") {
    const input = await body(request), email = String(input.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return json({ error: "請輸入有效的 Email。" }, 400, cors);
    const rate = await publicStatusRateLimit(db, request, email, "partner_status_checked");
    if (rate.limited) return json({ error: "查詢次數過多，請 15 分鐘後再試。" }, 429, cors);
    const result = await workflowForEmail(db, email);
    return json({ ...result.workflow }, 200, { ...cors, "cache-control": "no-store" });
  }

  if (path === "/api/partner/activation/request" && request.method === "POST") {
    const input = await body(request), email = String(input.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return json({ error: "請輸入有效的 Email。" }, 400, cors);
    const rate = await publicStatusRateLimit(db, request, email, "partner_activation_reissue_requested");
    if (rate.limited) return json({ error: "申請次數過多，請 15 分鐘後再試。" }, 429, cors);
    const result = await workflowForEmail(db, email);
    if (result.partner && ["pending_activation", "invite_expired"].includes(result.workflow.state)) {
      await audit(db, request, "public", rate.actorId, "partner_activation_reissue_pending", "partner", result.partner.id, { workflow_state: result.workflow.state });
    }
    return json({ ok: true, message: "請返回承攬夥伴申請頁，輸入原 Email 與手機，即可依安全流程重新取得短效啟用連結。" }, 202, { ...cors, "cache-control": "no-store" });
  }

  if (path === "/api/partner/invite/validate" && request.method === "POST") {
    const input = await body(request);
    if (!input.token) return json({ error: "請提供啟用連結。" }, 400, cors);
    const invite = await db.prepare("SELECT i.expires_at,p.legal_name,p.display_name,p.email,p.status,p.approved_at FROM partner_invites i JOIN partners p ON p.id=i.partner_id WHERE i.token_hash=? AND i.used_at IS NULL AND i.expires_at>? LIMIT 1")
      .bind(await hash(String(input.token)), now()).first();
    if (!invite || invite.status !== "pending_contract" || !invite.approved_at) return json({ error: "啟用連結無效、已使用、已過期或帳號尚未核准。" }, 401, cors);
    return json({ legal_name: invite.legal_name, display_name: invite.display_name, email: invite.email, expires_at: invite.expires_at }, 200, cors);
  }

  if (path === "/api/partner/accept-invite" && request.method === "POST") {
    const input = await body(request);
    if (!input.token) return json({ error: "啟用連結必須有效。" }, 400, cors);
    const invite = await db.prepare("SELECT i.*,p.status,p.approved_at,p.activated_at FROM partner_invites i JOIN partners p ON p.id=i.partner_id WHERE i.token_hash=? AND i.used_at IS NULL AND i.expires_at>? LIMIT 1")
      .bind(await hash(String(input.token)), now()).first();
    if (!invite || invite.status !== "pending_contract" || !invite.approved_at) return json({ error: "啟用連結無效、已使用、已過期或帳號尚未核准。" }, 401, cors);
    const activatedAt = invite.activated_at || now();
    try {
      const session = await preparePartnerSession(db, invite.partner_id, "activation_invite", "activation_invite");
      await db.batch([
        db.prepare("UPDATE partners SET status='active',activated_at=COALESCE(activated_at,?),updated_at=? WHERE id=?").bind(activatedAt, now(), invite.partner_id),
        db.prepare("UPDATE partner_invites SET used_at=? WHERE id=?").bind(now(), invite.id),
        session.statement,
        auditInsert(db, "partner", invite.partner_id, "partner.activation_session_issued", "partner_session", session.sessionId, { assurance_level: "activation_invite", invite_id: invite.id }),
      ]);
      await audit(db, request, "partner", invite.partner_id, "contractor_activated", "partner", invite.partner_id, { invite_id: invite.id, activated_at: activatedAt });
      await syncVipReward(db, invite.partner_id);
      return json({ ok: true, status: "active", next_url: await partnerNextUrl(db, invite.partner_id) }, 200, { ...cors, "set-cookie": partnerCookie(session.token) });
    } catch { return json({ error: "帳號啟用暫時無法完成，請稍後再試。" }, 503, cors); }
  }

  if (path === "/api/partner/login/start" && request.method === "POST") {
    const input = await body(request);
    const phone = normalizeTaiwanMobile(input.phone);
    if (!phone) return json({ error: "請輸入正確的台灣手機號碼。", code: "INVALID_PHONE" }, 422, cors);
    if (!await partnerLoginRateLimit(db, request, phone)) return json({ error: "登入操作過於頻繁，請 15 分鐘後再試。", code: "RATE_LIMITED" }, 429, cors);
    const currentSession = await partnerAuth(request, db);
    if (currentSession) {
      const currentPartner = await db.prepare("SELECT p.id,p.phone,p.status FROM partners p WHERE p.id=?").bind(currentSession.partner_id).first();
      if (currentPartner && normalizeTaiwanMobile(currentPartner.phone) === phone && currentPartner.status === "active") {
        await audit(db, request, "partner", currentPartner.id, "partner.session_restored", "partner_session", currentSession.id, { assurance_level: "trusted_existing_session" });
        return json({ code: "SESSION_RESTORED", next_url: await partnerNextUrl(db, currentPartner.id) }, 200, { ...cors, "cache-control": "no-store" });
      }
    }
    const partner = await partnerByNormalizedPhone(db, phone);
    if (partner?.status === "suspended") return json({ error: "此承攬夥伴帳號目前已暫停使用，請聯絡平台客服。", code: "PARTNER_SUSPENDED" }, 403, cors);
    if (partner?.status === "terminated") return json({ error: "此承攬夥伴帳號的合作關係已終止。", code: "PARTNER_TERMINATED" }, 403, cors);
    if (partner && partner.status !== "active") return json({ error: "您的承攬夥伴帳號尚未完成啟用，請使用安全啟用連結。", code: "PARTNER_ACTIVATION_REQUIRED" }, 403, cors);
    const challengeId = id("partner_challenge");
    const staging = env.PARTNER_OTP_MODE === "staging";
    const code = staging ? String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0") : null;
    const expiresAt = new Date(Date.now() + 10 * 60e3).toISOString();
    const phoneHash = await hash(`partner-login-phone:${phone}`);
    const ipHash = await hash(`partner-login-ip:${clientIp(request) || "unknown"}`);
    const deviceHash = await hash(`partner-login-device:${String(request.headers.get("x-device-id") || request.headers.get("user-agent") || "unknown").slice(0, 300)}`);
    await db.prepare("INSERT INTO partner_login_challenges(id,partner_id,phone_hash,code_hash,provider,expires_at,ip_hash,device_hash) VALUES(?,?,?,?,?,?,?,?)")
      .bind(challengeId, partner?.id || null, phoneHash, code ? await hash(`partner-otp:${challengeId}:${code}`) : null, staging ? "staging_otp" : "disabled", expiresAt, ipHash, deviceHash).run();
    await audit(db, request, "public", phoneHash, "partner.login_challenge_created", "partner_login_challenge", challengeId, { provider: staging ? "staging_otp" : "disabled", partner_linked: Boolean(partner) });
    return json({
      code: "VERIFICATION_REQUIRED",
      challenge_id: challengeId,
      expires_at: expiresAt,
      verification_available: staging,
      verification_method: staging ? "staging_otp" : null,
      staging_code: staging ? code : undefined,
      message: staging ? "請輸入測試環境驗證碼。" : "若此手機已登記為承攬夥伴，我們將提供登入驗證方式。正式手機驗證服務尚未開放。",
    }, 202, { ...cors, "cache-control": "no-store" });
  }

  if (path === "/api/partner/login/verify" && request.method === "POST") {
    const input = await body(request);
    const challengeId = String(input.challenge_id || "");
    const code = String(input.code || "");
    if (!challengeId || !/^\d{6}$/.test(code)) return json({ error: "請輸入 6 位數驗證碼。", code: "INVALID_OTP" }, 422, cors);
    const challenge = await db.prepare("SELECT * FROM partner_login_challenges WHERE id=? LIMIT 1").bind(challengeId).first();
    if (!challenge || challenge.used_at || challenge.revoked_at || new Date(challenge.expires_at) <= new Date()) return json({ error: "驗證碼已失效，請重新取得。", code: "OTP_EXPIRED" }, 401, cors);
    if (challenge.provider !== "staging_otp" || env.PARTNER_OTP_MODE !== "staging" || !challenge.partner_id) return json({ error: "目前無法完成手機驗證。", code: "PARTNER_VERIFICATION_UNAVAILABLE" }, 503, cors);
    if (Number(challenge.attempt_count) >= Number(challenge.max_attempts)) return json({ error: "驗證嘗試次數過多，請重新取得驗證碼。", code: "OTP_ATTEMPTS_EXCEEDED" }, 429, cors);
    if (await hash(`partner-otp:${challengeId}:${code}`) !== challenge.code_hash) {
      await db.prepare("UPDATE partner_login_challenges SET attempt_count=attempt_count+1 WHERE id=? AND used_at IS NULL").bind(challengeId).run();
      return json({ error: "驗證碼錯誤。", code: "INVALID_OTP" }, 401, cors);
    }
    const partner = await db.prepare("SELECT id,status FROM partners WHERE id=?").bind(challenge.partner_id).first();
    if (!partner || partner.status !== "active") return json({ error: "承攬夥伴帳號目前無法登入。", code: "PARTNER_ACCOUNT_UNAVAILABLE" }, 403, cors);
    const session = await preparePartnerSession(db, partner.id, "verified_phone", "staging_otp", challenge.id);
    const usedAt = now();
    await db.batch([
      db.prepare("UPDATE partner_login_challenges SET used_at=?,attempt_count=attempt_count+1 WHERE id=? AND used_at IS NULL").bind(usedAt, challenge.id),
      session.statement,
      auditInsert(db, "partner", partner.id, "partner.phone_verified_login", "partner_session", session.sessionId, { provider: "staging_otp", challenge_id: challenge.id }),
    ]);
    return json({ ok: true, code: "PARTNER_LOGIN_SUCCESS", next_url: await partnerNextUrl(db, partner.id) }, 200, { ...cors, "set-cookie": partnerCookie(session.token), "cache-control": "no-store" });
  }

  if (path === "/api/partner/login" && request.method === "POST") {
    return json({ error: "Email／密碼登入已停用，請改用手機免密碼登入。", code: "PARTNER_PASSWORD_LOGIN_DEPRECATED" }, 410, cors);
  }

  if (path === "/api/partner/attribution" && request.method === "POST") {
    const input = await body(request), referral = String(input.referral_code || "");
    const partner = await db.prepare("SELECT id,status FROM partners WHERE referral_code=?").bind(referral).first();
    if (!partner || partner.status !== "active" || !input.lead_name) return json({ error: "推薦連結無效，或請填寫聯絡人姓名。" }, 400, cors);
    if (!await signedApprovedContract(db, partner.id)) return json({ error: "承攬夥伴須先簽署目前有效契約，才能建立正式推薦歸因。", code: "PARTNER_CONTRACT_REQUIRED" }, 423, cors);
    const existing = await db.prepare("SELECT id FROM partner_leads WHERE lead_email=? AND lead_email IS NOT NULL ORDER BY first_seen_at LIMIT 1").bind(input.lead_email || null).first();
    if (existing) return json({ lead_id: existing.id, attribution: "existing" }, 200, cors);
    const leadId = id("lead");
    await db.prepare("INSERT INTO partner_leads (id,partner_id,lead_name,lead_phone,lead_email,source,status) VALUES (?,?,?,?,?,?,?)")
      .bind(leadId, partner.id, String(input.lead_name).slice(0, 100), input.lead_phone || null, input.lead_email || null, "referral", "new").run();
    await audit(db, request, "system", null, "lead_attributed", "partner_lead", leadId, { partner_id: partner.id, source: "referral" });
    return json({ lead_id: leadId, attribution: "created" }, 201, cors);
  }
  if (path === "/api/partner/logout" && request.method === "POST") {
    const session = await partnerAuth(request, db);
    if (session) await db.prepare("UPDATE partner_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=? AND revoked_at IS NULL").bind(session.id).run();
    return json({ ok: true }, 200, { ...cors, "set-cookie": partnerCookie("", 0) });
  }

  if (path.startsWith("/api/admin/")) {
    if (!adminAuthorized && !(await financeAdmin(request, env))) return json({ error: "需要財務管理員授權。" }, 401, cors);

    if (path === "/api/admin/partner-contract-versions" && request.method === "GET") {
      const rows = await db.prepare("SELECT id,version,title,content_hash,effective_date,is_active,requires_resign,legal_review_required,legal_review_status,reviewed_by,reviewed_at,legal_counsel_reference,approved_content_hash,created_at FROM contract_versions ORDER BY created_at DESC").all();
      return json({ items: rows.results }, 200, cors);
    }
    const legalReview = path.match(/^\/api\/admin\/partner-contract-versions\/([^/]+)\/legal-review$/);
    if (legalReview && request.method === "POST") {
      const input = await body(request);
      if (input.confirm_legal_review !== true || !input.legal_counsel_reference) return json({ error: "請確認已完成正式法律審閱並填寫律師審閱參考。", code: "LEGAL_REVIEW_CONFIRMATION_REQUIRED" }, 422, cors);
      const current = await db.prepare("SELECT * FROM contract_versions WHERE id=?").bind(legalReview[1]).first();
      if (!current) return json({ error: "找不到契約版本。" }, 404, cors);
      let operation;
      try {
        operation = await beginContractOperation(db, { partyType: "partner", partyId: current.id, operationType: "legal_review", idempotencyKey: request.headers.get("idempotency-key") || "" });
        if (operation.replay) return json(operation.result, 200, cors);
      } catch (error) { return contractFailure(error, cors); }
      const statements = [];
      if (input.activate === true) statements.push(db.prepare("UPDATE contract_versions SET is_active=0 WHERE is_active=1"));
      statements.push(db.prepare("UPDATE contract_versions SET legal_review_status='approved',reviewed_by='authorized_admin',reviewed_at=CURRENT_TIMESTAMP,legal_counsel_reference=?,approved_content_hash=content_hash,is_active=? WHERE id=?")
        .bind(String(input.legal_counsel_reference).slice(0, 240), input.activate === true ? 1 : 0, current.id));
      await db.batch(statements);
      await audit(db, request, "admin", "authorized_admin", "partner_contract_legal_review_approved", "contract_version", current.id, { approved_content_hash: current.content_hash, activate: input.activate === true });
      const result = { ok: true, legal_review_status: "approved", approved_content_hash: current.content_hash, is_active: input.activate === true };
      await completeContractOperation(db, operation.operation.id, result);
      return json(result, 200, cors);
    }

    const adminPdf = path.match(/^\/api\/admin\/contracts\/([^/]+)\/pdf$/);
    if (adminPdf && request.method === "GET") {
      const signature = await db.prepare("SELECT * FROM contract_signatures WHERE id=?").bind(adminPdf[1]).first();
      if (!signature?.pdf_object_key || !env.CONTRACTS_BUCKET) return json({ error: "找不到已簽契約 PDF。" }, 404, cors);
      const object = await env.CONTRACTS_BUCKET.get(signature.pdf_object_key);
      if (!object) return json({ error: "找不到已簽契約 PDF。" }, 404, cors);
      await audit(db, request, "admin", "finance", "contract_downloaded", "contract_signature", signature.id);
      return new Response(object.body, { headers: { ...cors, "content-type": "application/pdf", "content-disposition": `attachment; filename=contract-${signature.id}.pdf`, "x-pdf-sha256": signature.pdf_hash } });
    }

    if (path === "/api/admin/partners" && request.method === "GET") {
      const search = `%${url.searchParams.get("q") || ""}%`;
      const rows = await db.prepare("SELECT p.id,p.partner_code,p.legal_name,p.display_name,p.email,p.phone,p.company_name,p.tax_id,p.status,p.approved_at,p.activated_at,p.contract_status,p.contract_version,p.contract_signed_at,p.total_valid_sales,p.total_sales_amount,p.terminated_for_inactivity_at,p.created_at,(SELECT MAX(a.created_at) FROM audit_logs a WHERE a.entity_type='partner' AND a.entity_id=p.id AND a.action='partner_activation_reissue_pending') activation_requested_at FROM partners p WHERE p.partner_code LIKE ? OR p.legal_name LIKE ? OR p.email LIKE ? ORDER BY p.created_at DESC").bind(search, search, search).all();
      return json({ items: rows.results }, 200, cors);
    }

    if (path === "/api/admin/partners/auto-approve-pending" && request.method === "POST") {
      const input = await body(request);
      if (input.confirm !== "AUTO_APPROVE_EXISTING_PENDING_APPLICATIONS") return json({ error: "請完成批次核准二次確認。", code: "BATCH_CONFIRMATION_REQUIRED" }, 422, cors);
      const pending = await db.prepare("SELECT * FROM partners WHERE status='pending_contract' AND approved_at IS NULL ORDER BY created_at LIMIT 100").all();
      const approved = [], failed = [];
      for (const partner of pending.results || []) {
        try {
          const phone = normalizeTaiwanMobile(partner.phone);
          if (!phone) throw new Error("INVALID_PHONE");
          const owner = await partnerByNormalizedPhone(db, phone);
          if (owner && owner.id !== partner.id) throw new Error("DUPLICATE_PHONE");
          const invite = await prepareActivationInvite(db, partner.id);
          const membership = await preparePlatformMembershipBatch(db, { phone, source: "phone", privacyConsentVersion: "partner-auto-approval-v1", issueSession: false });
          const approvedAt = now();
          const statements = [
            db.prepare("UPDATE partners SET approved_at=?,approved_by='system',approval_mode='automatic',auto_approved_at=?,updated_at=? WHERE id=? AND approved_at IS NULL").bind(approvedAt, approvedAt, approvedAt, partner.id),
            db.prepare("INSERT OR IGNORE INTO partner_application_identities(phone_normalized,partner_id) VALUES(?,?)").bind(phone, partner.id),
            ...invite.statements,
            ...membership.statements,
            db.prepare("INSERT OR IGNORE INTO partner_platform_member_links(partner_id,member_id) VALUES(?,?)").bind(partner.id, membership.memberId),
            auditInsert(db, "system", "partner_auto_approval", "partner.auto_approved", "partner", partner.id, { historical_batch: true }),
            auditInsert(db, "system", "partner_auto_approval", "partner.activation_invite_created", "partner", partner.id, { expires_at: invite.expiresAt, historical_batch: true }),
          ];
          if (membership.memberCreated) statements.push(auditInsert(db, "system", "partner_auto_approval", "platform_member.created", "platform_member", membership.memberId, { source: "historical_partner_application" }));
          if (membership.couponCreated) statements.push(auditInsert(db, "system", "partner_auto_approval", "platform_coupon.claimed", "platform_member", membership.memberId, { campaign_id: "platform_welcome_member_v1" }));
          await db.batch(statements);
          approved.push({ partner_id: partner.id, partner_code: partner.partner_code, approved_at: approvedAt, activation_url: activationUrl(invite.raw, env), activation_expires_at: invite.expiresAt });
        } catch (error) { failed.push({ partner_id: partner.id, code: String(error?.message || "BATCH_FAILED").slice(0, 80) }); }
      }
      await audit(db, request, "admin", "authorized_admin", "partner.historical_pending_batch_processed", "partner_batch", id("batch"), { approved_count: approved.length, failed_count: failed.length });
      return json({ approved, failed, processed: pending.results?.length || 0 }, 200, { ...cors, "cache-control": "no-store" });
    }

    const match = path.match(/^\/api\/admin\/partners\/([^/]+)(?:\/(invite|commissions|contracts))?$/);
    if (match && request.method === "GET") {
      const partner = await db.prepare("SELECT * FROM partners WHERE id=?").bind(match[1]).first();
      if (!partner) return json({ error: "找不到承攬夥伴資料。" }, 404, cors);
      if (match[2] === "commissions") return json({ partner, items: (await db.prepare("SELECT * FROM commissions WHERE partner_id=? ORDER BY created_at DESC").bind(match[1]).all()).results }, 200, cors);
      if (match[2] === "contracts") return json({ partner, items: (await db.prepare("SELECT s.*,v.version,v.title FROM contract_signatures s JOIN contract_versions v ON v.id=s.contract_version_id WHERE s.partner_id=? ORDER BY s.signed_at DESC").bind(match[1]).all()).results }, 200, cors);
      return json(partner, 200, cors);
    }
    if (match && !match[2] && request.method === "PATCH") {
      const input = await body(request), partner = await db.prepare("SELECT * FROM partners WHERE id=?").bind(match[1]).first();
      if (!partner) return json({ error: "找不到承攬夥伴資料。" }, 404, cors);
      const action = input.action || input.status;
      if (action === "approve") {
        return json({ error: "一般新申請已改為自動核准；歷史待審資料請使用批次核准功能。", code: "PARTNER_MANUAL_APPROVAL_REMOVED" }, 410, cors);
      }
      const transitions = { reject: "rejected", suspended: "suspended", terminated: "terminated" }, status = transitions[action];
      if (!status) return json({ error: "不允許的承攬夥伴狀態操作。" }, 400, cors);
      await db.prepare("UPDATE partners SET status=?,updated_at=? WHERE id=?").bind(status, now(), partner.id).run();
      await audit(db, request, "admin", "finance", `contractor_${action}`, "partner", partner.id);
      return json({ ok: true, status }, 200, cors);
    }
    if (match && match[2] === "invite" && request.method === "POST") {
      const partner = await db.prepare("SELECT * FROM partners WHERE id=?").bind(match[1]).first();
      if (!partner) return json({ error: "找不到承攬夥伴資料。" }, 404, cors);
      if (partner.status !== "pending_contract" || !partner.approved_at) return json({ error: "請先核准此申請，才能產生啟用邀請。" }, 409, cors);
      const invite = await prepareActivationInvite(db, partner.id);
      await db.batch(invite.statements);
      await db.prepare("UPDATE audit_logs SET action='partner_activation_reissue_processed' WHERE entity_type='partner' AND entity_id=? AND action='partner_activation_reissue_pending'").bind(partner.id).run();
      await audit(db, request, "admin", "finance", "contractor_invited", "partner", partner.id, { expires_at: invite.expiresAt });
      return json({ invite_url: activationUrl(invite.raw, env), expires_at: invite.expiresAt }, 201, cors);
    }

    if (path === "/api/admin/settlements" && request.method === "GET") return json({ items: (await db.prepare("SELECT s.*,p.display_name,p.partner_code FROM settlements s JOIN partners p ON p.id=s.partner_id ORDER BY s.created_at DESC").all()).results }, 200, cors);
    if (path === "/api/admin/settlements" && request.method === "POST") {
      const input = await body(request);
      if (!input.partner_id || !input.period_start || !input.period_end) return json({ error: "請提供承攬夥伴與結算期間。" }, 400, cors);
      try {
        const result = await createSettlement(db, String(input.partner_id), String(input.period_start), String(input.period_end));
        await audit(db, request, "admin", "finance", "settlement_created", "settlement", result.id, { partner_id: input.partner_id });
        return json(result, 201, cors);
      } catch (error) { return json({ error: error.message || "無法建立結算單。" }, 409, cors); }
    }
    const settlement = path.match(/^\/api\/admin\/settlements\/([^/]+)$/);
    if (settlement && request.method === "PATCH") {
      const input = await body(request), current = await db.prepare("SELECT * FROM settlements WHERE id=?").bind(settlement[1]).first();
      if (!current) return json({ error: "找不到結算單。" }, 404, cors);
      if (input.status === "approved" && current.status === "draft") {
        await db.batch([
          db.prepare("UPDATE settlements SET status='approved',approved_at=? WHERE id=?").bind(now(), current.id),
          db.prepare("UPDATE commissions SET status='payable',updated_at=? WHERE id IN (SELECT commission_id FROM settlement_items WHERE settlement_id=?) AND status='confirmed'").bind(now(), current.id),
        ]);
        await audit(db, request, "admin", "finance", "settlement_approved", "settlement", current.id);
        return json({ ok: true, status: "approved" }, 200, cors);
      }
      if (input.status === "paid" && current.status === "approved") {
        const paidAt = now();
        await db.batch([
          db.prepare("UPDATE settlements SET status='paid',paid_at=?,paid_method=?,paid_reference=?,paid_by=? WHERE id=?").bind(paidAt, input.paid_method || null, input.paid_reference || null, "finance", current.id),
          db.prepare("UPDATE commissions SET status='paid',paid_at=?,updated_at=? WHERE id IN (SELECT commission_id FROM settlement_items WHERE settlement_id=?)").bind(paidAt, paidAt, current.id),
        ]);
        await audit(db, request, "admin", "finance", "settlement_paid", "settlement", current.id, { paid_method: input.paid_method || null });
        return json({ ok: true, status: "paid" }, 200, cors);
      }
      if (input.status === "cancelled" && current.status === "draft") {
        await db.batch([
          db.prepare("UPDATE commission_adjustments SET settlement_id=NULL WHERE settlement_id=?").bind(current.id),
          db.prepare("UPDATE settlements SET status='cancelled' WHERE id=?").bind(current.id),
        ]);
        await audit(db, request, "admin", "finance", "settlement_cancelled", "settlement", current.id);
        return json({ ok: true, status: "cancelled" }, 200, cors);
      }
      return json({ error: "不允許的結算單狀態轉換。" }, 409, cors);
    }

    const convert = path.match(/^\/api\/admin\/leads\/([^/]+)\/convert$/);
    if (convert && request.method === "POST") {
      const input = await body(request), lead = await db.prepare("SELECT * FROM partner_leads WHERE id=?").bind(convert[1]).first();
      if (!lead) return json({ error: "找不到推薦客戶資料。" }, 404, cors);
      if (!input.merchant_name || !Number.isFinite(Number(input.amount_due)) || Number(input.amount_due) < 0) return json({ error: "請提供商家名稱與正確金額。" }, 400, cors);
      const merchantId = id("merchant"), orderId = id("order"), merchantCode = String(input.merchant_code || `M${Date.now()}`).slice(0, 40), orderNo = String(input.order_no || `ORD-${Date.now()}`).slice(0, 60);
      await db.batch([
        db.prepare("INSERT INTO merchants (id,merchant_code,name,contact_name,phone,email,status) VALUES (?,?,?,?,?,?,?)").bind(merchantId, merchantCode, String(input.merchant_name).slice(0, 100), lead.lead_name, lead.lead_phone, lead.lead_email, "active"),
        db.prepare("INSERT INTO orders (id,order_no,merchant_id,title,amount_due,currency,payment_status,partner_id,lead_id) VALUES (?,?,?,?,?,?,?,?,?)").bind(orderId, orderNo, merchantId, String(input.title || "AI 行銷推廣方案").slice(0, 120), Number(input.amount_due), input.currency || "TWD", "unpaid", lead.partner_id, lead.id),
        db.prepare("UPDATE partner_leads SET merchant_id=?,status='converted',converted_at=? WHERE id=?").bind(merchantId, now(), lead.id),
      ]);
      await audit(db, request, "admin", "finance", "lead_converted", "partner_lead", lead.id, { merchant_id: merchantId, order_id: orderId, partner_id: lead.partner_id });
      return json({ merchant_id: merchantId, order_id: orderId, partner_id: lead.partner_id }, 201, cors);
    }
    const attribution = path.match(/^\/api\/admin\/leads\/([^/]+)\/attribution$/);
    if (attribution && request.method === "PATCH") {
      const input = await body(request), lead = await db.prepare("SELECT * FROM partner_leads WHERE id=?").bind(attribution[1]).first(), partner = await db.prepare("SELECT id FROM partners WHERE id=? AND status='active'").bind(input.partner_id || "").first();
      if (!lead || !partner) return json({ error: "找不到推薦客戶或已啟用的承攬夥伴。" }, 404, cors);
      await db.batch([
        db.prepare("UPDATE partner_leads SET partner_id=? WHERE id=?").bind(partner.id, lead.id),
        db.prepare("UPDATE orders SET partner_id=? WHERE lead_id=?").bind(partner.id, lead.id),
        db.prepare("INSERT INTO partner_attribution_audits (id,lead_id,previous_partner_id,new_partner_id,actor_id,reason) VALUES (?,?,?,?,?,?)").bind(id("attribution"), lead.id, lead.partner_id, partner.id, "finance", String(input.reason || "管理員歸屬修正").slice(0, 300)),
      ]);
      await audit(db, request, "admin", "finance", "lead_attribution_changed", "partner_lead", lead.id, { from_partner_id: lead.partner_id, to_partner_id: partner.id, reason: input.reason || null });
      return json({ ok: true }, 200, cors);
    }

    const bonus = path.match(/^\/api\/admin\/commissions\/([^/]+)\/service-bonus$/);
    if (bonus) return json({ error: "此舊版獎勵操作已停用，請依承攬夥伴分級獎勵與 VIP 百萬推廣獎勵制度辦理。" }, 410, cors);

    if (path === "/api/admin/vip-rewards" && request.method === "GET") {
      const rows = await db.prepare("SELECT v.*,p.display_name,p.partner_code FROM partner_vip_rewards v JOIN partners p ON p.id=v.partner_id ORDER BY v.updated_at DESC").all();
      return json({ items: rows.results }, 200, cors);
    }
    const vipMatch = path.match(/^\/api\/admin\/vip-rewards\/([^/]+)$/);
    if (vipMatch && request.method === "PATCH") {
      const input = await body(request), reward = await db.prepare("SELECT * FROM partner_vip_rewards WHERE id=?").bind(vipMatch[1]).first();
      if (!reward) return json({ error: "找不到 VIP 獎勵紀錄。" }, 404, cors);
      if (input.status === "approved" && reward.status === "pending_review") {
        await db.prepare("UPDATE partner_vip_rewards SET status='approved',approved_at=?,updated_at=? WHERE id=?").bind(now(), now(), reward.id).run();
        await audit(db, request, "admin", "finance", "vip_reward_approved", "partner_vip_reward", reward.id, { amount: reward.reward_amount });
        return json({ ok: true, status: "approved" }, 200, cors);
      }
      if (input.status === "paid" && reward.status === "approved") {
        await db.prepare("UPDATE partner_vip_rewards SET status='paid',paid_at=?,updated_at=? WHERE id=?").bind(now(), now(), reward.id).run();
        await audit(db, request, "admin", "finance", "vip_reward_paid", "partner_vip_reward", reward.id, { amount: reward.reward_amount });
        return json({ ok: true, status: "paid" }, 200, cors);
      }
      if (input.status === "cancelled" && ["tracking", "pending_review", "approved"].includes(reward.status)) {
        await db.prepare("UPDATE partner_vip_rewards SET status='cancelled',updated_at=? WHERE id=?").bind(now(), reward.id).run();
        await audit(db, request, "admin", "finance", "vip_reward_cancelled", "partner_vip_reward", reward.id);
        return json({ ok: true, status: "cancelled" }, 200, cors);
      }
      return json({ error: "不允許的 VIP 獎勵狀態轉換。" }, 409, cors);
    }

    const auditMatch = path === "/api/admin/audit" ? null : path.match(/^\/api\/admin\/partners\/([^/]+)\/audit$/);
    if ((path === "/api/admin/audit" || auditMatch) && request.method === "GET") {
      const partnerId = auditMatch?.[1] || url.searchParams.get("partner") || null;
      const rows = await db.prepare(partnerId ? "SELECT id,actor_type,actor_id,action,entity_type,entity_id,metadata,created_at FROM audit_logs WHERE (entity_type='partner' AND entity_id=?) OR entity_id IN (SELECT id FROM contract_signatures WHERE partner_id=?) OR entity_id IN (SELECT id FROM partner_leads WHERE partner_id=?) OR entity_id IN (SELECT id FROM orders WHERE partner_id=?) OR entity_id IN (SELECT id FROM commissions WHERE partner_id=?) OR entity_id IN (SELECT id FROM settlements WHERE partner_id=?) ORDER BY created_at DESC LIMIT 100" : "SELECT id,actor_type,actor_id,action,entity_type,entity_id,metadata,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100")
        .bind(...(partnerId ? [partnerId, partnerId, partnerId, partnerId, partnerId, partnerId] : [])).all();
      return json({ items: rows.results }, 200, cors);
    }
  }

  const partnerSession = await partnerAuth(request, db);
  if (!partnerSession) return json({ error: "請先登入承攬夥伴中心。" }, 401, cors);
  const partnerId = partnerSession.partner_id;
  const partner = await db.prepare("SELECT * FROM partners WHERE id=?").bind(partnerId).first();
  if (!partner || partner.status !== "active") return json({ error: "承攬夥伴帳號目前尚未啟用或已終止。" }, 403, cors);

  if (path === "/api/partner/me") return json({ id: partner.id, partner_code: partner.partner_code, legal_name: partner.legal_name, display_name: partner.display_name, status: partner.status, referral_code: partner.referral_code }, 200, cors);
  if (path === "/api/partner/contract/current" && request.method === "GET") return json(await activeContract(db), 200, cors);
  if (path === "/api/partner/contract/sign-preview" && request.method === "POST") {
    try {
      const input = await body(request), contract = await activeContract(db);
      assertContractSignable(contract, env);
      if (String(input.legal_name || "").trim() !== partner.legal_name) throw new ContractError("SIGNATORY_NAME_MISMATCH", "簽署姓名與承攬夥伴法定姓名不一致。", 422);
      return json({ version: contract.version, party_a: "平台契約正式設定法律主體", party_b: partner.legal_name, signatory: partner.legal_name, relationship: "獨立承攬／居間合作，非僱傭關係", signed_at: now(), important_terms: ["有效成交與五級獎勵", "每月合作資格維持", "退款與佣金沖回", "禁止私收款、假交易與未授權承諾", "線上簽署證據不等同憑證式數位簽章"] }, 200, cors);
    } catch (error) { return contractFailure(error, cors); }
  }
  if (path === "/api/partner/contract/sign" && request.method === "POST") {
    try {
      const input = await body(request), contract = await activeContract(db);
      const staging = assertContractSignable(contract, env).staging;
      if (String(input.legal_name || "").trim() !== partner.legal_name) throw new ContractError("SIGNATORY_NAME_MISMATCH", "簽署姓名與承攬夥伴法定姓名不一致。", 422);
      if (!normalizeTaiwanMobile(partner.phone)) throw new ContractError("PARTNER_PHONE_REQUIRED", "承攬夥伴手機資料不完整，請先聯絡平台更新後再簽署。", 422);
      const cookieToken = (request.headers.get("cookie") || "").match(/(?:^|;\s*)partner_session=([^;]+)/)?.[1] || "unknown";
      const operation = await beginContractOperation(db, { partyType: "partner", partyId: partnerId, operationType: "sign", idempotencyKey: request.headers.get("idempotency-key") || "" });
      if (operation.replay) return json({ ...operation.result, member_session: null, welcome: { show: false }, replay: true }, 200, cors);
      const existing = await db.prepare("SELECT id,public_id,document_hash,pdf_hash FROM contract_signatures WHERE partner_id=? AND contract_version_id=?").bind(partnerId, contract.id).first();
      if (existing) {
        const membership = await ensurePlatformMember(db, { phone: partner.phone, source: "partner_contract", originVerified: true, deviceId: cookieToken || "partner-contract", issueSession: true });
        const replay = { ok: true, signature_id: existing.id, public_id: existing.public_id, document_hash: existing.document_hash, pdf_hash: existing.pdf_hash, membership: { member_id: membership.member.id, member_no: membership.member.member_no, created: membership.created }, member_session: membership.session, welcome: membership.welcome, replay: true };
        await completeContractOperation(db, operation.operation.id, replay); return json(replay, 200, cors);
      }
      const signatureId = id("sign"), publicId = `BYPC-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
      const sessionHash = await sessionEvidenceHash(cookieToken);
      const agreement = await buildSignedAgreement({ title: "創百業智慧鏈｜承攬夥伴合作契約", documentId: signatureId, publicId, verificationUrl: `https://baiyeconnect.com/#/verify-contract/${publicId}`, contract, partyType: "partner", partyId: partnerId, partyLabel: `甲方：平台契約正式設定法律主體　乙方：${partner.legal_name}`, signatory: partner.legal_name, signatoryRole: "承攬夥伴", signature: input.signature, consents: { read: input.read, electronic: input.electronic, independent: input.independent }, consentVersion: "partner-contract-consent-v1.4", ip: clientIp(request), userAgent: request.headers.get("user-agent"), sessionEvidence: sessionHash, staging });
      const prefix = `contracts/partners/${partnerId}/${contract.version}/${signatureId}`;
      const stored = await storePrivateAgreementArtifacts(env.CONTRACTS_BUCKET, prefix, agreement);
      const membershipBatch = await preparePlatformMembershipBatch(db, { phone: partner.phone, source: "partner_contract", originVerified: true, deviceId: cookieToken || "partner-contract" });
      try {
        await db.batch([
          db.prepare("INSERT INTO contract_signatures(id,partner_id,contract_version_id,legal_name,signed_at,ip_address,user_agent,contract_content_hash,signature_hash,signature_data,pdf_object_key,pdf_hash,document_hash,consent_version,signature_assurance_level,public_id,evidence_object_key,session_id_hash,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(signatureId, partnerId, contract.id, partner.legal_name, agreement.signedAt, clientIp(request), request.headers.get("user-agent"), contract.content_hash, agreement.signatureHash, agreement.signatureData, stored.pdfKey, agreement.pdfHash, agreement.documentHash, "partner-contract-consent-v1.4", STANDARD_ASSURANCE, publicId, stored.evidenceKey, sessionHash, "VALID"),
          db.prepare("UPDATE partners SET contract_status='signed',contract_version=?,contract_signed_at=?,updated_at=? WHERE id=?").bind(contract.version, agreement.signedAt, now(), partnerId),
          ...membershipBatch.statements,
        ]);
      } catch (error) { await stored.cleanup(); throw error; }
      await audit(db, request, "partner", partnerId, "contract_signed", "contract_signature", signatureId, { version: contract.version, signature_hash: agreement.signatureHash, pdf_hash: agreement.pdfHash, document_hash: agreement.documentHash, assurance: STANDARD_ASSURANCE });
      const membership = await finalizePlatformMembershipBatch(db, membershipBatch);
      const result = { ok: true, signature_id: signatureId, public_id: publicId, pdf_hash: agreement.pdfHash, document_hash: agreement.documentHash, membership: { member_id: membership.member.id, member_no: membership.member.member_no, created: membership.created }, member_session: membership.session, welcome: membership.welcome };
      await completeContractOperation(db, operation.operation.id, result);
      return json(result, 201, cors);
    } catch (error) { return contractFailure(error, cors); }
  }

  const pdfMatch = path.match(/^\/api\/partner\/contracts\/([^/]+)\/pdf$/);
  if (pdfMatch && request.method === "GET") {
    const signature = await db.prepare("SELECT * FROM contract_signatures WHERE id=? AND partner_id=?").bind(pdfMatch[1], partnerId).first();
    if (!signature?.pdf_object_key || !env.CONTRACTS_BUCKET) return json({ error: "找不到已簽契約 PDF。" }, 404, cors);
    const object = await env.CONTRACTS_BUCKET.get(signature.pdf_object_key);
    if (!object) return json({ error: "找不到已簽契約 PDF。" }, 404, cors);
    await audit(db, request, "partner", partnerId, "contract_downloaded", "contract_signature", signature.id);
    return new Response(object.body, { headers: { ...cors, "content-type": "application/pdf", "content-disposition": `attachment; filename=contract-${signature.id}.pdf`, "x-pdf-sha256": signature.pdf_hash } });
  }

  if (path === "/api/partner/dashboard") return json(await partnerDashboard(db, partnerId), 200, cors);
  if (path === "/api/partner/referral") {
    if (!await signedApprovedContract(db, partnerId)) return json({ error: "請先簽署目前有效的承攬夥伴合作契約。", code: "PARTNER_CONTRACT_REQUIRED" }, 423, cors);
    return json({ referral_code: partner.referral_code, url: `https://baiyeconnect.com/#/join?ref=${partner.referral_code}` }, 200, cors);
  }
  if (path === "/api/partner/leads") {
    if (!await signedApprovedContract(db, partnerId)) return json({ error: "請先簽署目前有效的承攬夥伴合作契約。", code: "PARTNER_CONTRACT_REQUIRED" }, 423, cors);
    return json({ items: (await db.prepare("SELECT id,lead_name,source,status,created_at,converted_at FROM partner_leads WHERE partner_id=? ORDER BY created_at DESC").bind(partnerId).all()).results }, 200, cors);
  }
  if (path === "/api/partner/orders") return json({ items: (await db.prepare("SELECT order_no,title,amount_due,amount_paid,payment_status,created_at FROM orders WHERE partner_id=? ORDER BY created_at DESC").bind(partnerId).all()).results }, 200, cors);
  if (path === "/api/partner/commissions") return json({ items: (await db.prepare("SELECT c.*,o.order_no,o.title FROM commissions c JOIN orders o ON o.id=c.order_id WHERE c.partner_id=? ORDER BY c.created_at DESC").bind(partnerId).all()).results }, 200, cors);
  if (path === "/api/partner/settlements") return json({ items: (await db.prepare("SELECT * FROM settlements WHERE partner_id=? ORDER BY created_at DESC").bind(partnerId).all()).results }, 200, cors);
  return json({ error: "找不到此服務。" }, 404, cors);
}
