const WELCOME_CAMPAIGN_ID = "platform_welcome_member_v1";
const SESSION_DAYS = 180;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "private, no-store", ...headers } });
}

function uid(prefix) { return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`; }
function bytesHex(bytes) { return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function sha256(value) { return bytesHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)))); }
function randomToken() { const bytes = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function expiry(days = SESSION_DAYS) { const value = new Date(); value.setUTCDate(value.getUTCDate() + days); return value.toISOString(); }

export function normalizeTaiwanMobile(value) {
  let phone = String(value || "").replace(/[\s()-]/g, "");
  if (phone.startsWith("+886")) phone = `0${phone.slice(4)}`;
  else if (phone.startsWith("886")) phone = `0${phone.slice(3)}`;
  return /^09\d{8}$/.test(phone) ? phone : "";
}

export function maskMemberPhone(phone) { return /^09\d{8}$/.test(phone) ? `${phone.slice(0, 2)}** *** ${phone.slice(-3)}` : "09** *** ***"; }

async function campaign(db) {
  return db.prepare("SELECT * FROM platform_coupon_campaigns WHERE id=? AND campaign_type='platform_welcome_member' AND enabled=1").bind(WELCOME_CAMPAIGN_ID).first();
}

async function claimWelcomeCoupon(db, memberId) {
  const active = await campaign(db);
  if (!active) return { coupon: null, created: false };
  const existing = await db.prepare("SELECT c.*,p.name,p.discount_value_minor,p.currency,p.redemption_enabled FROM platform_member_coupons c JOIN platform_coupon_campaigns p ON p.id=c.campaign_id WHERE c.member_id=? AND c.campaign_id=?").bind(memberId, active.id).first();
  if (existing) return { coupon: existing, created: false };
  const couponId = uid("pcoupon");
  const expiresAt = expiry(Number(active.valid_days || 30));
  await db.prepare("INSERT INTO platform_member_coupons(id,member_id,campaign_id,status,expires_at) VALUES(?,?,?,'claimed',?)").bind(couponId, memberId, active.id, expiresAt).run();
  await db.prepare("UPDATE platform_members SET welcome_coupon_claimed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(memberId).run();
  return { coupon: { id: couponId, status: "claimed", name: active.name, discount_value_minor: active.discount_value_minor, currency: active.currency, expires_at: expiresAt, redemption_enabled: 0 }, created: true };
}

export async function issuePlatformMemberSession(db, memberId, deviceId = "contract-session") {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const deviceHash = await sha256(String(deviceId || "unknown-device").slice(0, 300));
  const expiresAt = expiry();
  await db.prepare("INSERT INTO platform_member_sessions(id,member_id,token_hash,device_hash,expires_at) VALUES(?,?,?,?,?)").bind(uid("pmsess"), memberId, tokenHash, deviceHash, expiresAt).run();
  return { token, expires_at: expiresAt };
}

export async function preparePlatformMembershipBatch(db, { phone, source, originVerified = false, deviceId = "trusted-contract-session", privacyConsentVersion = null, issueSession = true, couponIssuanceEnabled = false }) {
  const normalized = normalizeTaiwanMobile(phone);
  if (!normalized) throw Object.assign(new Error("手機號碼格式不正確。"), { code: "INVALID_PHONE", status: 422 });
  const existing = await memberByPhone(db, normalized);
  if (existing && existing.status !== "active") throw Object.assign(new Error("此會員帳戶目前無法使用。"), { code: "MEMBER_ACCOUNT_UNAVAILABLE", status: 403 });
  const existingCoupon = couponIssuanceEnabled && existing ? await db.prepare("SELECT id FROM platform_member_coupons WHERE member_id=? AND campaign_id=?").bind(existing.id, WELCOME_CAMPAIGN_ID).first() : null;
  const customerId = uid("customer");
  const memberId = uid("pmember");
  const memberNo = `BYM-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const welcomeId = uid("pwelcome");
  const couponId = uid("pcoupon");
  const sessionId = uid("pmsess");
  const token = randomToken();
  const tokenHash = await sha256(token);
  const deviceHash = await sha256(String(deviceId || "trusted-contract-session").slice(0, 300));
  const sessionExpiresAt = expiry();
  const couponExpiresAt = expiry(30);
  const statements = [
    db.prepare("INSERT OR IGNORE INTO ordering_customers(id,display_name,phone_normalized,phone_display,privacy_consent_version,privacy_consented_at) VALUES(?,'會員',?,?,?,CASE WHEN ? IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END)").bind(customerId, normalized, normalized, privacyConsentVersion, privacyConsentVersion),
    db.prepare("UPDATE ordering_customers SET privacy_consent_version=COALESCE(privacy_consent_version,?),privacy_consented_at=CASE WHEN privacy_consented_at IS NULL AND ? IS NOT NULL THEN CURRENT_TIMESTAMP ELSE privacy_consented_at END,updated_at=CURRENT_TIMESTAMP WHERE phone_normalized=?").bind(privacyConsentVersion, privacyConsentVersion, normalized),
    db.prepare("INSERT OR IGNORE INTO platform_members(id,customer_id,member_no,joined_source,phone_verified,membership_origin_verified) SELECT ?,c.id,?,?,c.phone_verified,? FROM ordering_customers c WHERE c.phone_normalized=?").bind(memberId, memberNo, source, Number(Boolean(originVerified)), normalized),
    db.prepare("INSERT OR IGNORE INTO platform_member_welcome_events(id,member_id,source) SELECT ?,p.id,? FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized=?").bind(welcomeId, source, normalized),
    db.prepare("UPDATE platform_members SET membership_origin_verified=MAX(membership_origin_verified,?),updated_at=CURRENT_TIMESTAMP WHERE customer_id=(SELECT id FROM ordering_customers WHERE phone_normalized=?)").bind(Number(Boolean(originVerified)), normalized),
  ];
  if (couponIssuanceEnabled) {
    statements.push(db.prepare("INSERT OR IGNORE INTO platform_member_coupons(id,member_id,campaign_id,status,expires_at) SELECT ?,p.id,campaign.id,'claimed',? FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id JOIN platform_coupon_campaigns campaign ON campaign.id=? AND campaign.enabled=1 WHERE c.phone_normalized=?").bind(couponId, couponExpiresAt, WELCOME_CAMPAIGN_ID, normalized));
    statements.push(db.prepare("UPDATE platform_members SET welcome_coupon_claimed_at=COALESCE(welcome_coupon_claimed_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE customer_id=(SELECT id FROM ordering_customers WHERE phone_normalized=?)").bind(normalized));
  }
  if (issueSession) statements.push(db.prepare("INSERT INTO platform_member_sessions(id,member_id,token_hash,device_hash,expires_at) SELECT ?,p.id,?,?,? FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized=?").bind(sessionId, tokenHash, deviceHash, sessionExpiresAt, normalized));
  return { normalized, existing: Boolean(existing), memberId: existing?.id || memberId, memberCreated: !existing, couponCreated: couponIssuanceEnabled && !existingCoupon, couponIssuanceEnabled, token: issueSession ? token : null, sessionExpiresAt: issueSession ? sessionExpiresAt : null, statements };
}

export async function finalizePlatformMembershipBatch(db, prepared) {
  const member = await memberByPhone(db, prepared.normalized);
  if (!member) throw Object.assign(new Error("會員資格建立失敗。"), { code: "MEMBERSHIP_COMMIT_FAILED", status: 503 });
  const coupon = prepared.couponIssuanceEnabled ? (await claimWelcomeCoupon(db, member.id)).coupon : null;
  const welcome = welcomeCopy(member.joined_source);
  return { member: { id: member.id, member_no: member.member_no, status: member.status, phone_masked: maskMemberPhone(prepared.normalized), joined_at: member.joined_at }, created: !prepared.existing, session: prepared.token ? { token: prepared.token, expires_at: prepared.sessionExpiresAt } : null, coupon, welcome: { ...welcome, show: !prepared.existing }, customer: member };
}

async function memberByPhone(db, phone) {
  return db.prepare("SELECT p.*,c.phone_normalized,c.display_name,c.email,c.phone_verified customer_phone_verified FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized=?").bind(phone).first();
}

export async function authenticatePlatformMember(db, request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || request.headers.get("x-platform-member-token") || "";
  if (!bearer) return null;
  const tokenHash = await sha256(bearer);
  const row = await db.prepare("SELECT p.*,c.phone_normalized,c.display_name,c.email,s.id session_id,s.expires_at FROM platform_member_sessions s JOIN platform_members p ON p.id=s.member_id JOIN ordering_customers c ON c.id=p.customer_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND p.status='active'").bind(tokenHash).first();
  if (row) await db.prepare("UPDATE platform_member_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.session_id).run();
  return row || null;
}

async function checkRateLimit(db, request, phone, deviceId) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const bucket = new Date(Math.floor(Date.now() / 600000) * 600000).toISOString();
  for (const [scope, raw, limit] of [["member_join_phone", phone, 8], ["member_join_ip", ip, 30], ["member_join_device", deviceId || "unknown", 12]]) {
    const key = await sha256(raw);
    await db.prepare("INSERT INTO platform_member_rate_limits(scope,rate_key_hash,bucket_start,attempt_count) VALUES(?,?,?,1) ON CONFLICT(scope,rate_key_hash,bucket_start) DO UPDATE SET attempt_count=attempt_count+1").bind(scope, key, bucket).run();
    const row = await db.prepare("SELECT attempt_count FROM platform_member_rate_limits WHERE scope=? AND rate_key_hash=? AND bucket_start=?").bind(scope, key, bucket).first();
    if (Number(row?.attempt_count || 0) > limit) return false;
  }
  return true;
}

function welcomeCopy(source) {
  if (source === "partner_contract") return { title: "歡迎成為創百業會員！", message: "契約簽署完成，您的創百業會員資格也已建立。" };
  if (source === "merchant_contract") return { title: "歡迎成為創百業會員！", message: "商家契約簽署完成，您的創百業會員資格也已建立。" };
  return { title: "歡迎成為創百業會員！", message: "您的會員資格已建立。" };
}

export async function ensurePlatformMember(db, { phone, source, privacyConsentVersion = null, originVerified = false, deviceId = "trusted-contract-session", issueSession = true, couponIssuanceEnabled = false }) {
  const normalized = normalizeTaiwanMobile(phone);
  if (!normalized) throw Object.assign(new Error("手機號碼格式不正確。"), { code: "INVALID_PHONE", status: 422 });
  let customer = await db.prepare("SELECT * FROM ordering_customers WHERE phone_normalized=?").bind(normalized).first();
  if (!customer) {
    const customerId = uid("customer");
    await db.prepare("INSERT INTO ordering_customers(id,display_name,phone_normalized,phone_display,privacy_consent_version,privacy_consented_at) VALUES(?,'會員',?,?,?,CURRENT_TIMESTAMP)")
      .bind(customerId, normalized, normalized, privacyConsentVersion).run();
    customer = { id: customerId, phone_normalized: normalized, display_name: "會員", phone_verified: 0 };
  } else if (privacyConsentVersion) {
    await db.prepare("UPDATE ordering_customers SET privacy_consent_version=COALESCE(privacy_consent_version,?),privacy_consented_at=COALESCE(privacy_consented_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(privacyConsentVersion, customer.id).run();
  }
  let member = await db.prepare("SELECT * FROM platform_members WHERE customer_id=?").bind(customer.id).first();
  const created = !member;
  if (!member) {
    const memberId = uid("pmember");
    const memberNo = `BYM-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    await db.prepare("INSERT INTO platform_members(id,customer_id,member_no,joined_source,phone_verified,membership_origin_verified) VALUES(?,?,?,?,?,?)")
      .bind(memberId, customer.id, memberNo, source, Number(Boolean(customer.phone_verified)), Number(Boolean(originVerified))).run();
    member = await db.prepare("SELECT * FROM platform_members WHERE id=?").bind(memberId).first();
    await db.prepare("INSERT INTO platform_member_welcome_events(id,member_id,source) VALUES(?,?,?)").bind(uid("pwelcome"), memberId, source).run();
  } else if (member.status !== "active") {
    throw Object.assign(new Error("此會員帳戶目前無法使用。"), { code: "MEMBER_ACCOUNT_UNAVAILABLE", status: 403 });
  }
  const claimed = couponIssuanceEnabled ? await claimWelcomeCoupon(db, member.id) : { coupon: null, created: false };
  const session = issueSession ? await issuePlatformMemberSession(db, member.id, deviceId) : null;
  const welcome = welcomeCopy(source);
  return {
    member: { id: member.id, member_no: member.member_no, status: member.status, phone_masked: maskMemberPhone(normalized), joined_at: member.joined_at },
    created,
    session,
    coupon: claimed.coupon,
    welcome: { ...welcome, show: created },
    customer,
  };
}

export async function handlePlatformMemberRequest(request, env, url, cors = {}) {
  const db = env.FINANCE_DB;
  try {
    if (url.pathname === "/api/members/join" && request.method === "POST") {
      const input = await request.json();
      if (input?.privacy_consent !== true || !String(input?.consent_version || "").trim()) return json({ error: "請閱讀並同意會員服務與隱私權說明。", code: "PRIVACY_CONSENT_REQUIRED" }, 422, cors);
      const phone = normalizeTaiwanMobile(input.phone);
      if (!phone) return json({ error: "請輸入正確的台灣手機號碼。", code: "INVALID_PHONE" }, 422, cors);
      const deviceId = String(input.device_id || request.headers.get("x-device-id") || "").slice(0, 300);
      if (!await checkRateLimit(db, request, phone, deviceId)) return json({ error: "操作過於頻繁，請稍後再試。", code: "RATE_LIMITED" }, 429, cors);
      const existing = await memberByPhone(db, phone);
      if (existing) {
        const current = await authenticatePlatformMember(db, request);
        if (!current || current.id !== existing.id) return json({ error: "此手機已建立會員，請先完成手機或 LINE 身分驗證。", code: "MEMBER_VERIFICATION_REQUIRED", verification_methods: env.SMS_OTP_MODE === "staging" ? ["staging_otp"] : ["sms_otp", "line_login"], verification_available: env.SMS_OTP_MODE === "staging" }, 409, cors);
        return json({ member: { id: current.id, member_no: current.member_no, status: current.status, phone_masked: maskMemberPhone(current.phone_normalized), joined_at: current.joined_at }, new_member: false, welcome: { show: false }, session: null }, 200, cors);
      }
      const result = await ensurePlatformMember(db, { phone, source: "phone", privacyConsentVersion: String(input.consent_version).slice(0, 100), deviceId, couponIssuanceEnabled: env.MEMBERSHIP_COUPON_ISSUANCE_ENABLED === "1" });
      return json({ member: result.member, new_member: true, welcome: result.welcome, coupon: result.coupon, session: result.session }, 201, cors);
    }
    const member = await authenticatePlatformMember(db, request);
    if (!member) return json({ error: "會員 Session 無效或已過期。", code: "MEMBER_SESSION_REQUIRED" }, 401, cors);
    if (url.pathname === "/api/members/me" && request.method === "GET") return json({ member: { id: member.id, member_no: member.member_no, status: member.status, phone_masked: maskMemberPhone(member.phone_normalized), joined_at: member.joined_at, display_name: member.display_name, email: member.email } }, 200, cors);
    if (url.pathname === "/api/members/coupons" && request.method === "GET") {
      return json({ coupons: [], disabled: true, redemption_enabled: false }, 200, cors);
    }
    if (url.pathname === "/api/members/welcome/acknowledge" && request.method === "POST") {
      await db.prepare("UPDATE platform_member_welcome_events SET acknowledged_at=COALESCE(acknowledged_at,CURRENT_TIMESTAMP) WHERE member_id=?").bind(member.id).run();
      return json({ ok: true }, 200, cors);
    }
    if (url.pathname === "/api/members/logout" && request.method === "POST") {
      await db.prepare("UPDATE platform_member_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=?").bind(member.session_id).run();
      return json({ ok: true }, 200, cors);
    }
    if (url.pathname === "/api/members/coupons/redeem" && request.method === "POST") {
      if (env.MEMBERSHIP_COUPON_ISSUANCE_ENABLED !== "1") return json({ error: "會員優惠券功能已停用。", code: "COUPON_FEATURE_DISABLED" }, 409, cors);
      if (env.PLATFORM_WELCOME_COUPON_REDEMPTION_ENABLED !== "1") return json({ error: "使用通路開放後即可折抵。", code: "PLATFORM_COUPON_REDEMPTION_DISABLED" }, 409, cors);
      if (!Number(member.phone_verified)) return json({ error: "首次使用迎新券前，請完成手機驗證。", code: "PHONE_VERIFICATION_REQUIRED_FOR_WELCOME_COUPON" }, 409, cors);
      return json({ error: "跨商家補貼與對帳尚未開放。", code: "PLATFORM_COUPON_REIMBURSEMENT_REQUIRED" }, 409, cors);
    }
    return null;
  } catch (error) {
    return json({ error: error?.message || "會員服務目前暫時忙碌，請稍後再試。", code: error?.code || "MEMBER_SERVICE_ERROR" }, Number(error?.status || 500), cors);
  }
}
