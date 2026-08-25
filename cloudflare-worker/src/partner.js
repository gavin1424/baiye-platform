import { createSignedContractPdf } from "./contract-pdf.js";

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
async function passwordHash(password, salt, pepper) {
  const key = await crypto.subtle.importKey("raw", E.encode(`partner-password-v1:${salt}:${pepper}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, E.encode(password)));
}
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
async function partnerSession(partner, env) {
  const payload = b64(E.encode(JSON.stringify({ partner_id: partner.id, exp: Date.now() + 7 * 864e5 })));
  return `${payload}.${await hmac(payload, env.PARTNER_SESSION_SECRET)}`;
}
async function partnerAuth(request, env) {
  const token = (request.headers.get("cookie") || "").match(/(?:^|;\s*)partner_session=([^;]+)/)?.[1];
  if (!token || !env.PARTNER_SESSION_SECRET) return null;
  const [payload, signature] = token.split(".");
  if (!payload || signature !== await hmac(payload, env.PARTNER_SESSION_SECRET)) return null;
  try { const decoded = JSON.parse(D.decode(ub64(payload))); return decoded.exp > Date.now() ? decoded.partner_id : null; } catch { return null; }
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
  if (partner.status === "active") return { code: "PARTNER_ACTIVE", state: "active", message: "此 Email 已有承攬夥伴帳號，請直接登入。" };
  if (partner.status === "rejected") return { code: "PARTNER_REJECTED", state: "rejected", message: "此承攬夥伴申請目前未通過審核；如需協助，請聯絡平台客服。" };
  if (partner.status === "suspended") return { code: "PARTNER_SUSPENDED", state: "suspended", message: "此承攬夥伴帳號目前已暫停使用，請聯絡平台客服確認。" };
  if (partner.status === "terminated") return { code: "PARTNER_TERMINATED", state: "terminated", message: "此承攬夥伴帳號的合作關係已終止；如有疑問，請聯絡平台客服。" };
  if (!partner.approved_at) return { code: "PARTNER_PENDING_REVIEW", state: "pending_review", message: "您的承攬夥伴申請已收到，目前正在等待管理員審核。審核完成後，系統會提供帳號啟用方式。" };
  const validInvite = Boolean(latestInvite && !latestInvite.used_at && new Date(latestInvite.expires_at) > at);
  const expiredInvite = Boolean(latestInvite && !latestInvite.used_at && new Date(latestInvite.expires_at) <= at);
  if (expiredInvite) return { code: "PARTNER_INVITE_EXPIRED", state: "invite_expired", message: "您的帳號已通過審核，但啟用連結已失效。" };
  return { code: "PARTNER_PENDING_ACTIVATION", state: "pending_activation", has_valid_invite: validInvite, message: validInvite ? "您的承攬夥伴申請已通過，但帳號尚未完成啟用。請使用已收到的安全啟用通知。" : "您的承攬夥伴申請已通過，但帳號尚未完成啟用。" };
}

async function workflowForEmail(db, email) {
  const partner = await db.prepare("SELECT id,status,approved_at,activated_at FROM partners WHERE email=? LIMIT 1").bind(email).first();
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
  const signature = contract ? await db.prepare("SELECT id,pdf_hash,signed_at FROM contract_signatures WHERE partner_id=? AND contract_version_id=? ORDER BY signed_at DESC LIMIT 1").bind(partnerId, contract.id).first() : null;
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
    contract: { version: contract?.version || null, signed: Boolean(signature), signature_id: signature?.id || null, signed_at: signature?.signed_at || null },
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
    const existing = await workflowForEmail(db, email);
    if (existing.partner) return json({ error: existing.workflow.message, ...existing.workflow }, 409, cors);
    const partnerId = id("partner"), partnerCode = `AG${String(Date.now()).slice(-6)}`;
    try {
      await db.prepare("INSERT INTO partners (id,partner_code,legal_name,display_name,email,phone,company_name,tax_id,status,referral_code) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(partnerId, partnerCode, String(input.legal_name).slice(0, 80), String(input.display_name || input.legal_name).slice(0, 80), email, String(input.phone).slice(0, 30), input.company_name || null, input.tax_id || null, "pending_contract", partnerCode).run();
      await audit(db, request, "partner", partnerId, "contractor_applied", "partner", partnerId, { independent_contractor_consent: true });
      return json({ id: partnerId, partner_code: partnerCode, status: "pending_contract" }, 201, cors);
    } catch { return json({ error: "申請暫時無法送出，請稍後再試。" }, 503, cors); }
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
    return json({ ok: true, message: "若此 Email 已通過審核且需要新的啟用連結，平台管理員將依安全流程處理；我們不會在畫面或紀錄中顯示啟用 Token。" }, 202, { ...cors, "cache-control": "no-store" });
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
    if (!input.token || String(input.password || "").length < 12 || !env.PARTNER_SESSION_SECRET) return json({ error: "密碼至少需要 12 個字元，且啟用連結必須有效。" }, 400, cors);
    const invite = await db.prepare("SELECT i.*,p.status,p.approved_at,p.activated_at FROM partner_invites i JOIN partners p ON p.id=i.partner_id WHERE i.token_hash=? AND i.used_at IS NULL AND i.expires_at>? LIMIT 1")
      .bind(await hash(String(input.token)), now()).first();
    if (!invite || invite.status !== "pending_contract" || !invite.approved_at) return json({ error: "啟用連結無效、已使用、已過期或帳號尚未核准。" }, 401, cors);
    const salt = crypto.randomUUID(), password = await passwordHash(String(input.password), salt, env.PARTNER_SESSION_SECRET), activatedAt = invite.activated_at || now();
    try {
      await db.batch([
        db.prepare("UPDATE partners SET password_hash=?,password_salt=?,status='active',activated_at=COALESCE(activated_at,?),updated_at=? WHERE id=?").bind(password, salt, activatedAt, now(), invite.partner_id),
        db.prepare("UPDATE partner_invites SET used_at=? WHERE id=?").bind(now(), invite.id),
      ]);
      await audit(db, request, "partner", invite.partner_id, "contractor_activated", "partner", invite.partner_id, { invite_id: invite.id, activated_at: activatedAt });
      await syncVipReward(db, invite.partner_id);
      return json({ ok: true, status: "active" }, 200, cors);
    } catch { return json({ error: "帳號啟用暫時無法完成，請稍後再試。" }, 503, cors); }
  }

  if (path === "/api/partner/login" && request.method === "POST") {
    const input = await body(request), email = String(input.email || "").trim().toLowerCase();
    const recent = await db.prepare("SELECT COUNT(*) count FROM partner_login_attempts WHERE email=? AND attempted_at>datetime('now','-15 minutes')").bind(email).first();
    if (Number(recent.count) >= 5) return json({ error: "登入嘗試次數過多，請 15 分鐘後再試。" }, 429, cors);
    const partner = await db.prepare("SELECT * FROM partners WHERE email=?").bind(email).first();
    const valid = Boolean(partner?.password_hash && env.PARTNER_SESSION_SECRET && await passwordHash(String(input.password || ""), partner.password_salt, env.PARTNER_SESSION_SECRET) === partner.password_hash);
    await db.prepare("INSERT INTO partner_login_attempts (id,email,success) VALUES (?,?,?)").bind(id("login"), email, valid ? 1 : 0).run();
    if (!partner) return json({ error: "Email 或密碼錯誤。", code: "INVALID_CREDENTIALS" }, 401, cors);
    if (partner.status !== "active") {
      const result = await workflowForEmail(db, email);
      return json({ error: result.workflow.message, ...result.workflow }, 403, cors);
    }
    if (!valid) return json({ error: "Email 或密碼錯誤。", code: "INVALID_CREDENTIALS" }, 401, cors);
    await audit(db, request, "partner", partner.id, "contractor_login", "partner", partner.id);
    return json({ ok: true }, 200, { ...cors, "set-cookie": `partner_session=${await partnerSession(partner, env)}; HttpOnly; Secure; SameSite=None; Partitioned; Path=/api/partner; Max-Age=604800` });
  }

  if (path === "/api/partner/attribution" && request.method === "POST") {
    const input = await body(request), referral = String(input.referral_code || "");
    const partner = await db.prepare("SELECT id,status FROM partners WHERE referral_code=?").bind(referral).first();
    if (!partner || partner.status !== "active" || !input.lead_name) return json({ error: "推薦連結無效，或請填寫聯絡人姓名。" }, 400, cors);
    const existing = await db.prepare("SELECT id FROM partner_leads WHERE lead_email=? AND lead_email IS NOT NULL ORDER BY first_seen_at LIMIT 1").bind(input.lead_email || null).first();
    if (existing) return json({ lead_id: existing.id, attribution: "existing" }, 200, cors);
    const leadId = id("lead");
    await db.prepare("INSERT INTO partner_leads (id,partner_id,lead_name,lead_phone,lead_email,source,status) VALUES (?,?,?,?,?,?,?)")
      .bind(leadId, partner.id, String(input.lead_name).slice(0, 100), input.lead_phone || null, input.lead_email || null, "referral", "new").run();
    await audit(db, request, "system", null, "lead_attributed", "partner_lead", leadId, { partner_id: partner.id, source: "referral" });
    return json({ lead_id: leadId, attribution: "created" }, 201, cors);
  }
  if (path === "/api/partner/logout" && request.method === "POST") return json({ ok: true }, 200, { ...cors, "set-cookie": "partner_session=; HttpOnly; Secure; SameSite=None; Partitioned; Path=/api/partner; Max-Age=0" });

  if (path.startsWith("/api/admin/")) {
    if (!adminAuthorized && !(await financeAdmin(request, env))) return json({ error: "需要財務管理員授權。" }, 401, cors);

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
        if (partner.status !== "pending_contract") return json({ error: "目前狀態無法執行核准。" }, 409, cors);
        const approvedAt = now();
        await db.prepare("UPDATE partners SET approved_at=COALESCE(approved_at,?),approved_by=?,updated_at=? WHERE id=?").bind(approvedAt, "finance", now(), partner.id).run();
        await audit(db, request, "admin", "finance", "contractor_approved", "partner", partner.id);
        return json({ ok: true, status: "pending_contract", approved_at: approvedAt }, 200, cors);
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
      const issuedAt = now(), expiresAt = new Date(Date.now() + 72 * 3600e3).toISOString(), raw = crypto.randomUUID() + crypto.randomUUID();
      await db.batch([
        db.prepare("UPDATE partner_invites SET used_at=? WHERE partner_id=? AND used_at IS NULL AND expires_at>?").bind(issuedAt, partner.id, issuedAt),
        db.prepare("INSERT INTO partner_invites (id,partner_id,token_hash,expires_at) VALUES (?,?,?,?)").bind(id("invite"), partner.id, await hash(raw), expiresAt),
      ]);
      await db.prepare("UPDATE audit_logs SET action='partner_activation_reissue_processed' WHERE entity_type='partner' AND entity_id=? AND action='partner_activation_reissue_pending'").bind(partner.id).run();
      await audit(db, request, "admin", "finance", "contractor_invited", "partner", partner.id, { expires_at: expiresAt });
      return json({ invite_url: `https://baiyeconnect.com/#/partner/activate?token=${encodeURIComponent(raw)}`, expires_at: expiresAt }, 201, cors);
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

  const partnerId = await partnerAuth(request, env);
  if (!partnerId) return json({ error: "請先登入承攬夥伴中心。" }, 401, cors);
  const partner = await db.prepare("SELECT * FROM partners WHERE id=?").bind(partnerId).first();
  if (!partner || partner.status !== "active") return json({ error: "承攬夥伴帳號目前尚未啟用或已終止。" }, 403, cors);

  if (path === "/api/partner/me") return json({ id: partner.id, partner_code: partner.partner_code, legal_name: partner.legal_name, display_name: partner.display_name, status: partner.status, referral_code: partner.referral_code }, 200, cors);
  if (path === "/api/partner/contract/current" && request.method === "GET") return json(await activeContract(db), 200, cors);
  if (path === "/api/partner/contract/sign" && request.method === "POST") {
    const input = await body(request), contract = await activeContract(db);
    if (!contract) return json({ error: "目前沒有可簽署的承攬夥伴合作契約版本。" }, 503, cors);
    if (!input.read || !input.electronic || !input.independent || input.legal_name !== partner.legal_name || !validSignature(input.signature)) return json({ error: "請完成閱讀、電子簽署、獨立承攬確認、法定姓名及手寫簽名。" }, 400, cors);
    const existing = await db.prepare("SELECT id FROM contract_signatures WHERE partner_id=? AND contract_version_id=?").bind(partnerId, contract.id).first();
    if (existing) return json({ error: "您已簽署目前有效的承攬夥伴合作契約。" }, 409, cors);
    if (!env.CONTRACTS_BUCKET) return json({ error: "私有契約保存服務尚未啟用。" }, 503, cors);
    const signatureId = id("sign"), signedAt = now(), signatureHash = await hash(String(input.signature));
    const pdf = await createSignedContractPdf({ contractId: signatureId, version: contract.version, contentHtml: contract.content_html, contractHash: contract.content_hash, signatureHash, legalName: partner.legal_name, signedAt, consentVersion: "v1.3", signature: input.signature });
    const key = `contracts/${partnerId}/${contract.version}/${signatureId}.pdf`;
    try { await env.CONTRACTS_BUCKET.put(key, pdf.bytes, { httpMetadata: { contentType: "application/pdf", contentDisposition: `attachment; filename=contract-${signatureId}.pdf` } }); }
    catch { return json({ error: "已簽契約 PDF 保存失敗，請稍後再試。" }, 503, cors); }
    await db.prepare("INSERT INTO contract_signatures (id,partner_id,contract_version_id,legal_name,signed_at,ip_address,user_agent,contract_content_hash,signature_hash,signature_data,pdf_object_key,pdf_hash,document_hash,consent_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(signatureId, partnerId, contract.id, partner.legal_name, signedAt, clientIp(request), request.headers.get("user-agent"), contract.content_hash, signatureHash, String(input.signature), key, pdf.pdfHash, pdf.documentHash, "v1.3").run();
    await db.prepare("UPDATE partners SET contract_status='signed',contract_version=?,contract_signed_at=?,updated_at=? WHERE id=?").bind(contract.version, signedAt, now(), partnerId).run();
    await audit(db, request, "partner", partnerId, "contract_signed", "contract_signature", signatureId, { version: contract.version, signature_hash: signatureHash, pdf_hash: pdf.pdfHash, document_hash: pdf.documentHash, legal_review_required: true });
    return json({ ok: true, signature_id: signatureId, pdf_hash: pdf.pdfHash, document_hash: pdf.documentHash, legal_review_required: true }, 201, cors);
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
  if (path === "/api/partner/referral") return json({ referral_code: partner.referral_code, url: `https://baiyeconnect.com/#/join?ref=${partner.referral_code}` }, 200, cors);
  if (path === "/api/partner/leads") return json({ items: (await db.prepare("SELECT id,lead_name,source,status,created_at,converted_at FROM partner_leads WHERE partner_id=? ORDER BY created_at DESC").bind(partnerId).all()).results }, 200, cors);
  if (path === "/api/partner/orders") return json({ items: (await db.prepare("SELECT order_no,title,amount_due,amount_paid,payment_status,created_at FROM orders WHERE partner_id=? ORDER BY created_at DESC").bind(partnerId).all()).results }, 200, cors);
  if (path === "/api/partner/commissions") return json({ items: (await db.prepare("SELECT c.*,o.order_no,o.title FROM commissions c JOIN orders o ON o.id=c.order_id WHERE c.partner_id=? ORDER BY c.created_at DESC").bind(partnerId).all()).results }, 200, cors);
  if (path === "/api/partner/settlements") return json({ items: (await db.prepare("SELECT * FROM settlements WHERE partner_id=? ORDER BY created_at DESC").bind(partnerId).all()).results }, 200, cors);
  return json({ error: "找不到此服務。" }, 404, cors);
}
