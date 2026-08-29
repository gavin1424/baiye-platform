import { authenticatePlatformMember, ensurePlatformMember, normalizeTaiwanMobile } from "./platform-membership.js";

const E = new TextEncoder(), COOKIE = "baiye_merchant_session", ITERATIONS = 600000, SEGMENT = 100000;
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const b64 = (a) => btoa(String.fromCharCode(...a)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const sha = async (value) => b64(new Uint8Array(await crypto.subtle.digest("SHA-256", E.encode(String(value)))));
const same = (a, b) => { if (!a || !b || a.length !== b.length) return false; let value = 0; for (let i = 0; i < a.length; i += 1) value |= a.charCodeAt(i) ^ b.charCodeAt(i); return value === 0; };
const cookieValue = (request, name) => String(request.headers.get("cookie") || "").split(";").map((x) => x.trim()).find((x) => x.startsWith(`${name}=`))?.slice(name.length + 1) || "";
export const merchantSessionCookie = (value, age = 2592000) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${age}`;

async function pbkdf2(input, salt, iterations) { const key = await crypto.subtle.importKey("raw", input, "PBKDF2", false, ["deriveBits"]); return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: E.encode(salt), iterations }, key, 256)); }
export async function deriveMerchantPassword(password, salt, iterations = ITERATIONS) { let material = E.encode(String(password)); for (let i = 0; i < Math.ceil(iterations / SEGMENT); i += 1) material = await pbkdf2(material, `${salt}:${i}`, Math.min(SEGMENT, iterations - i * SEGMENT)); return b64(material); }

async function getSession(request, env) {
  const token = cookieValue(request, COOKIE); if (!token || !env.FINANCE_DB) return null;
  return env.FINANCE_DB.prepare(`SELECT s.id session_id,s.merchant_id,s.user_id,s.platform_member_id,s.assurance_level,s.issued_via,s.csrf_hash,s.expires_at,u.email,u.display_name,u.phone_normalized,u.status,m.name merchant_name,m.status merchant_status,GROUP_CONCAT(DISTINCT p.permission_code) permissions,GROUP_CONCAT(DISTINCT r.code) roles FROM merchant_user_sessions s JOIN merchant_users u ON u.merchant_id=s.merchant_id AND u.id=s.user_id JOIN merchants m ON m.id=s.merchant_id LEFT JOIN merchant_user_roles ur ON ur.merchant_id=u.merchant_id AND ur.user_id=u.id LEFT JOIN merchant_roles r ON r.id=ur.role_id LEFT JOIN merchant_role_permissions p ON p.role_id=ur.role_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') AND s.assurance_level IN ('activation_invite','verified_phone','trusted_existing_session') AND u.status='active' GROUP BY s.id`).bind(await sha(token)).first();
}
export async function authorizeMerchant(request, env, permission = "") {
  const session = await getSession(request, env); if (!session) return { ok: false, status: 401, error: "UNAUTHENTICATED" };
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) { const csrf = request.headers.get("x-csrf-token") || ""; if (!csrf || !same(await sha(csrf), session.csrf_hash)) return { ok: false, status: 403, error: "CSRF_INVALID" }; }
  const roles = String(session.roles || "").split(","), permissions = String(session.permissions || "").split(",");
  if (permission && !roles.includes("owner") && !permissions.includes(permission)) return { ok: false, status: 403, error: "PERMISSION_DENIED" };
  return { ok: true, status: 200, session };
}

async function rateLimit(db, request, phone, action) {
  const bucket = new Date(Math.floor(Date.now() / 900000) * 900000).toISOString(), ip = request.headers.get("cf-connecting-ip") || "unknown", device = request.headers.get("x-device-id") || request.headers.get("user-agent") || "unknown";
  for (const [scope, value, limit] of [[`${action}_phone`, phone, 8], [`${action}_ip`, ip, 30], [`${action}_device`, device.slice(0, 300), 12]]) { const key = await sha(`${scope}:${value}`); await db.prepare("INSERT INTO merchant_auth_rate_limits(scope,rate_key_hash,bucket_start,attempt_count) VALUES(?,?,?,1) ON CONFLICT(scope,rate_key_hash,bucket_start) DO UPDATE SET attempt_count=attempt_count+1,last_attempt_at=CURRENT_TIMESTAMP").bind(scope, key, bucket).run(); const row = await db.prepare("SELECT attempt_count FROM merchant_auth_rate_limits WHERE scope=? AND rate_key_hash=? AND bucket_start=?").bind(scope, key, bucket).first(); if (Number(row?.attempt_count || 0) > limit) return false; }
  return true;
}
async function event(db, request, action, merchantId = null, userId = null, metadata = {}) { await db.prepare("INSERT INTO merchant_security_events(id,merchant_id,user_id,action,metadata,ip_hash,user_agent_hash) VALUES(?,?,?,?,?,?,?)").bind(uid("mse"), merchantId, userId, action, JSON.stringify(metadata), await sha(`ip:${request.headers.get("cf-connecting-ip") || "unknown"}`), await sha(`ua:${request.headers.get("user-agent") || "unknown"}`)).run(); }
export async function issueMerchantSession(db, { merchantId, userId, platformMemberId, assuranceLevel, issuedVia }) { const raw = random(), csrf = random(), expiresAt = new Date(Date.now() + 30 * 864e5).toISOString(), sessionId = uid("mus"); await db.prepare("INSERT INTO merchant_user_sessions(id,merchant_id,user_id,token_hash,csrf_hash,platform_member_id,assurance_level,issued_via,expires_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(sessionId, merchantId, userId, await sha(raw), await sha(csrf), platformMemberId, assuranceLevel, issuedVia, expiresAt).run(); return { raw, csrf, expiresAt, sessionId }; }

async function ownersByPhone(db, phone) { return (await db.prepare(`SELECT l.merchant_id,l.merchant_user_id,l.platform_member_id,l.status link_status,u.status user_status,m.name merchant_name,m.status merchant_status FROM merchant_owner_links l JOIN merchant_users u ON u.id=l.merchant_user_id AND u.merchant_id=l.merchant_id JOIN merchants m ON m.id=l.merchant_id WHERE l.phone_normalized=? ORDER BY l.created_at`).bind(phone).all()).results || []; }
function ownerState(row) { if (row.link_status === "suspended" || row.user_status === "suspended") return "MERCHANT_SUSPENDED"; if (row.link_status === "disabled" || row.user_status === "disabled" || row.merchant_status === "disabled") return "MERCHANT_DISABLED"; return "ACTIVE"; }

export async function createPasswordlessMerchantOwner(db, { request, merchantId, platformMember, phone, email = null }) {
  const existing = await db.prepare("SELECT l.*,u.id user_id FROM merchant_owner_links l JOIN merchant_users u ON u.id=l.merchant_user_id AND u.merchant_id=l.merchant_id WHERE l.merchant_id=? AND l.platform_member_id=?").bind(merchantId, platformMember.id).first();
  if (existing) return { created: false, userId: existing.user_id };
  const userId = uid("merchantuser"), roleId = `merchant_owner_${merchantId}`, internalEmail = email || `${userId}@merchant.internal.invalid`;
  await db.batch([
    db.prepare("INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,status,display_name,phone_normalized,platform_member_id,auth_mode) VALUES(?,?,?,'PASSWORDLESS_DISABLED','','active','商家 Owner',?,?,'passwordless_phone')").bind(userId, merchantId, internalEmail, phone, platformMember.id),
    db.prepare("INSERT OR IGNORE INTO merchant_roles(id,merchant_id,code,name,is_system) VALUES(?,?,'owner','商家擁有者',1)").bind(roleId, merchantId),
    db.prepare("INSERT INTO merchant_user_roles(merchant_id,user_id,role_id) VALUES(?,?,?)").bind(merchantId, userId, roleId),
    db.prepare("INSERT INTO merchant_owner_links(merchant_id,merchant_user_id,platform_member_id,phone_normalized) VALUES(?,?,?,?)").bind(merchantId, userId, platformMember.id, phone),
  ]);
  await event(db, request, "merchant.owner_created", merchantId, userId, { member_id: platformMember.id }); return { created: true, userId };
}

async function register(request, env, cors) {
  const db = env.FINANCE_DB, input = await request.json().catch(() => ({})), phone = normalizeTaiwanMobile(input.phone);
  if (!phone) return json({ error: "請輸入正確的台灣手機號碼。", code: "INVALID_PHONE" }, 422, cors);
  if (input.privacy_consent !== true || !String(input.consent_version || "").trim()) return json({ error: "請閱讀並同意會員服務、隱私權說明及商家平台相關條款。", code: "PRIVACY_CONSENT_REQUIRED" }, 422, cors);
  if (!await rateLimit(db, request, phone, "merchant_register")) return json({ error: "操作過於頻繁，請稍後再試。", code: "RATE_LIMITED" }, 429, cors);
  if ((await ownersByPhone(db, phone)).length) return json({ code: "MERCHANT_ALREADY_REGISTERED", message: "此手機已有商家帳號，請前往商家登入。", next_url: "/merchant/login" }, 409, cors);
  const existingMember = await db.prepare("SELECT p.id FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized=?").bind(phone).first();
  if (existingMember) { const authenticated = await authenticatePlatformMember(db, request); if (!authenticated || authenticated.id !== existingMember.id) return json({ error: "此手機已是平台會員，請先完成帳戶驗證。", code: "MEMBER_VERIFICATION_REQUIRED" }, 401, cors); }
  const membership = await ensurePlatformMember(db, { phone, source: "phone", privacyConsentVersion: String(input.consent_version), deviceId: request.headers.get("x-device-id") || "merchant-register", issueSession: true });
  const merchantId = uid("merchant"), merchantCode = `MR${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  await db.batch([db.prepare("INSERT INTO merchants(id,merchant_code,name,phone,status) VALUES(?,?, '待完成商家資料',?,'registration_started')").bind(merchantId, merchantCode, phone), db.prepare("INSERT INTO merchant_applications(id,merchant_id,platform_member_id,phone_hash,consent_version) VALUES(?,?,?,?,?)").bind(uid("mapp"), merchantId, membership.member.id, await sha(`phone:${phone}`), String(input.consent_version))]);
  const owner = await createPasswordlessMerchantOwner(db, { request, merchantId, platformMember: membership.member, phone });
  const session = await issueMerchantSession(db, { merchantId, userId: owner.userId, platformMemberId: membership.member.id, assuranceLevel: "activation_invite", issuedVia: "phone_registration" });
  await event(db, request, "merchant.registration_started", merchantId, owner.userId, { member_id: membership.member.id });
  return json({ code: "MERCHANT_REGISTERED", merchant: { id: merchantId, name: "待完成商家資料", status: "registration_started" }, membership: { member_id: membership.member.id, member_no: membership.member.member_no, created: membership.created }, member_session: membership.session, welcome: membership.welcome, coupon: membership.coupon, csrf_token: session.csrf, next_url: "/merchant" }, 201, { ...cors, "set-cookie": merchantSessionCookie(session.raw) });
}

async function loginStart(request, env, cors) {
  const db = env.FINANCE_DB, input = await request.json().catch(() => ({})), phone = normalizeTaiwanMobile(input.phone);
  if (!phone) return json({ error: "請輸入正確的台灣手機號碼。", code: "INVALID_PHONE" }, 422, cors);
  if (!await rateLimit(db, request, phone, "merchant_login_start")) return json({ error: "操作過於頻繁，請稍後再試。", code: "RATE_LIMITED" }, 429, cors);
  const current = await getSession(request, env); if (current?.phone_normalized === phone) return json({ code: "SESSION_RESTORED", next_url: "/merchant" }, 200, cors);
  const owners = await ownersByPhone(db, phone); if (!owners.length) return json({ code: "MERCHANT_NOT_FOUND", message: "若此手機已登記為商家 Owner，系統將提供安全登入方式。" }, 202, cors);
  if (owners.every((row) => ownerState(row) !== "ACTIVE")) { const state = ownerState(owners[0]); return json({ code: state, error: state === "MERCHANT_SUSPENDED" ? "商家帳號目前暫停使用，請聯絡平台。" : "商家帳號目前無法使用。" }, 403, cors); }
  const mode = String(env.MERCHANT_OTP_MODE || "disabled"); if (!["staging", "sms_otp", "line_login"].includes(mode)) return json({ code: "VERIFICATION_SERVICE_UNAVAILABLE", error: "手機驗證服務目前尚未開放，請使用原裝置或安全啟用連結。" }, 503, cors);
  const challengeId = uid("mchallenge"), code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0"), expiresAt = new Date(Date.now() + 10 * 60e3).toISOString();
  await db.prepare("INSERT INTO merchant_login_challenges(id,platform_member_id,phone_hash,code_hash,mode,expires_at) VALUES(?,?,?,?,?,?)").bind(challengeId, owners[0].platform_member_id, await sha(`phone:${phone}`), await sha(`merchant-otp:${challengeId}:${code}`), mode === "staging" ? "staging_otp" : mode, expiresAt).run();
  await event(db, request, "merchant.login_challenge_created", null, null, { challenge_id: challengeId, mode }); return json({ code: "VERIFICATION_REQUIRED", challenge_id: challengeId, expires_at: expiresAt, ...(mode === "staging" ? { staging_otp: code } : {}) }, 200, cors);
}

async function loginVerify(request, env, cors) {
  const db = env.FINANCE_DB, input = await request.json().catch(() => ({})), challenge = await db.prepare("SELECT * FROM merchant_login_challenges WHERE id=? AND used_at IS NULL AND datetime(expires_at)>datetime('now')").bind(String(input.challenge_id || "")).first();
  if (!challenge) return json({ error: "驗證碼無效或已過期。", code: "CHALLENGE_INVALID" }, 401, cors);
  if (!await rateLimit(db, request, challenge.phone_hash, "merchant_login_verify")) return json({ error: "操作過於頻繁，請稍後再試。", code: "RATE_LIMITED" }, 429, cors);
  if (!same(await sha(`merchant-otp:${challenge.id}:${String(input.code || "")}`), challenge.code_hash)) { await db.prepare("UPDATE merchant_login_challenges SET attempts=attempts+1 WHERE id=? AND attempts<8").bind(challenge.id).run(); return json({ error: "驗證碼錯誤。", code: "OTP_INVALID" }, 401, cors); }
  const rows = (await db.prepare(`SELECT l.merchant_id,l.merchant_user_id,l.platform_member_id,l.status link_status,u.status user_status,m.name merchant_name,m.status merchant_status FROM merchant_owner_links l JOIN merchant_users u ON u.id=l.merchant_user_id AND u.merchant_id=l.merchant_id JOIN merchants m ON m.id=l.merchant_id WHERE l.platform_member_id=? ORDER BY l.created_at`).bind(challenge.platform_member_id).all()).results.filter((row) => ownerState(row) === "ACTIVE");
  if (!rows.length) return json({ error: "商家帳號目前無法使用。", code: "MERCHANT_DISABLED" }, 403, cors);
  if (rows.length > 1 && !input.merchant_id) return json({ code: "MERCHANT_SELECTION_REQUIRED", merchants: rows.map((row) => ({ id: row.merchant_id, name: row.merchant_name })) }, 200, cors);
  const selected = rows.find((row) => row.merchant_id === (input.merchant_id || rows[0].merchant_id)); if (!selected) return json({ error: "無法存取所選商家。", code: "MERCHANT_ISOLATION_DENIED" }, 403, cors);
  const changed = await db.prepare("UPDATE merchant_login_challenges SET used_at=CURRENT_TIMESTAMP WHERE id=? AND used_at IS NULL").bind(challenge.id).run(); if (!changed.meta?.changes) return json({ error: "驗證碼已使用。", code: "OTP_REPLAY" }, 409, cors);
  const session = await issueMerchantSession(db, { merchantId: selected.merchant_id, userId: selected.merchant_user_id, platformMemberId: selected.platform_member_id, assuranceLevel: "verified_phone", issuedVia: challenge.mode }); await event(db, request, "merchant.session_created", selected.merchant_id, selected.merchant_user_id, { assurance_level: "verified_phone" });
  return json({ code: "LOGIN_SUCCESS", merchant: { id: selected.merchant_id, name: selected.merchant_name }, csrf_token: session.csrf, expires_at: session.expiresAt, next_url: "/merchant" }, 200, { ...cors, "set-cookie": merchantSessionCookie(session.raw) });
}

async function legacyLogin(request, env, cors) { const db = env.FINANCE_DB, body = await request.json().catch(() => ({})), merchantId = String(body.merchant_id || "").trim(), email = String(body.email || "").trim().toLowerCase(); if (!await rateLimit(db, request, email, "legacy_login")) return json({ error: "登入嘗試過多，請稍後再試。" }, 429, cors); const user = await db.prepare("SELECT * FROM merchant_users WHERE merchant_id=? AND email=? AND auth_mode='password'").bind(merchantId, email).first(); const supplied = user ? await deriveMerchantPassword(String(body.password || ""), user.password_salt, Number(user.password_iterations || ITERATIONS)) : random(); if (!user || user.status !== "active" || !same(supplied, user.password_hash)) return json({ error: "帳號或密碼錯誤。" }, 401, cors); const session = await issueMerchantSession(db, { merchantId, userId: user.id, platformMemberId: user.platform_member_id || null, assuranceLevel: "trusted_existing_session", issuedVia: "legacy_password" }); return json({ deprecated: true, user: { id: user.id, merchant_id: merchantId, email: user.email, name: user.display_name }, csrf_token: session.csrf, expires_at: session.expiresAt }, 200, { ...cors, "set-cookie": merchantSessionCookie(session.raw) }); }

export async function handleMerchantAuth(request, env, url, cors = {}) {
  const db = env.FINANCE_DB; if (!db) return json({ error: "商家登入服務暫時無法使用。" }, 503, cors);
  if (url.pathname === "/api/merchant/register" && request.method === "POST") return register(request, env, cors);
  if (url.pathname === "/api/merchant-auth/login/start" && request.method === "POST") return loginStart(request, env, cors);
  if (url.pathname === "/api/merchant-auth/login/verify" && request.method === "POST") return loginVerify(request, env, cors);
  if (url.pathname === "/api/merchant-auth/login" && request.method === "POST") return legacyLogin(request, env, cors);
  if (url.pathname === "/api/merchant-auth/session" && request.method === "GET") { const s = await getSession(request, env); if (!s) return json({ error: "未登入。" }, 401, cors); const csrf = random(); await db.prepare("UPDATE merchant_user_sessions SET csrf_hash=?,last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(await sha(csrf), s.session_id).run(); const signed = await db.prepare("SELECT COUNT(*) count FROM merchant_contract_signatures WHERE merchant_id=? AND status='VALID'").bind(s.merchant_id).first(); return json({ user: { id: s.user_id, merchant_id: s.merchant_id, name: s.display_name, phone_masked: s.phone_normalized ? `${s.phone_normalized.slice(0,2)}** *** ${s.phone_normalized.slice(-3)}` : null }, merchant: { id: s.merchant_id, name: s.merchant_name, status: s.merchant_status }, contract_status: Number(signed?.count || 0) ? "signed" : "contract_required", permissions: String(s.permissions || "").split(",").filter(Boolean), roles: String(s.roles || "").split(",").filter(Boolean), assurance_level: s.assurance_level, csrf_token: csrf, expires_at: s.expires_at }, 200, cors); }
  if (url.pathname === "/api/merchant-auth/logout" && request.method === "POST") { const result = await authorizeMerchant(request, env); if (!result.ok) return json({ error: result.error }, result.status, cors); await db.prepare("UPDATE merchant_user_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=?").bind(result.session.session_id).run(); return json({ ok: true }, 200, { ...cors, "set-cookie": merchantSessionCookie("", 0) }); }
  return null;
}
