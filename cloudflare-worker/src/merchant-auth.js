import { finalizePlatformMembershipBatch, normalizeTaiwanMobile, preparePlatformMembershipBatch } from "./platform-membership.js";

const encoder = new TextEncoder();
const COOKIE = "baiye_merchant_session";
const ITERATIONS = 600000;
const SEGMENT = 100000;
const SESSION_SECONDS = 8 * 60 * 60;
const PASSWORD_TYPE = "numeric_password_8";
const ALGORITHM = "pbkdf2-sha256-segmented-v1";
const GENERIC_ERROR = "手機號碼或密碼錯誤。";
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const b64 = (array) => btoa(String.fromCharCode(...array)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const random = (size = 32) => b64(crypto.getRandomValues(new Uint8Array(size)));
const sha = async (value) => b64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(value)))));
const same = (a, b) => { if (!a || !b || a.length !== b.length) return false; let result = 0; for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index); return result === 0; };
const cookie = (request, name) => String(request.headers.get("cookie") || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || "";
const sessionCookie = (value, age = SESSION_SECONDS) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${age}`;
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const resultRows = (result) => result?.results || [];
const clientIp = (request) => request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";

async function pbkdf2(input, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", input, "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations }, key, 256));
}
export async function deriveMerchantPassword(password, salt, iterations = ITERATIONS) {
  let material = encoder.encode(String(password));
  for (let index = 0; index < Math.ceil(iterations / SEGMENT); index += 1) material = await pbkdf2(material, `${salt}:${index}`, Math.min(SEGMENT, iterations - index * SEGMENT));
  return b64(material);
}

export function validateMerchantNumericPassword(password, phone = "") {
  const value = String(password || "");
  if (!/^[0-9]{8}$/.test(value)) return { ok: false, error: "密碼必須為 8 位數字。" };
  const normalized = normalizeTaiwanMobile(phone);
  const repeated = /^(\d)\1{7}$/.test(value) || /^(\d{1,2})\1+$/.test(value);
  const sequential = ["01234567", "12345678", "23456789", "98765432", "87654321", "76543210"].includes(value);
  if (repeated || sequential || (normalized && value === normalized.slice(-8))) return { ok: false, error: "此密碼過於簡單，請重新設定。" };
  return { ok: true };
}

async function audit(db, request, action, subject = {}, metadata = {}) {
  await db.prepare("INSERT INTO merchant_security_events(id,merchant_id,user_id,action,metadata,ip_hash,user_agent_hash) VALUES(?,?,?,?,?,?,?)")
    .bind(uid("mse"), subject.merchant_id || null, subject.merchant_user_id || subject.user_id || null, action, JSON.stringify(metadata), await sha(`ip:${clientIp(request)}`), await sha(`ua:${request.headers.get("user-agent") || "unknown"}`)).run();
}

export async function authenticateMerchantSession(request, env) {
  const token = cookie(request, COOKIE);
  if (!token || !env.FINANCE_DB) return null;
  return env.FINANCE_DB.prepare(`SELECT s.id session_id,s.merchant_id,s.user_id,s.platform_member_id,s.assurance_level,s.issued_via,s.csrf_hash,s.expires_at,
    u.email,u.display_name,u.phone_normalized,u.status,m.name merchant_name,m.status merchant_status,
    CASE WHEN m.id='demo_beef_noodle' THEN 1 ELSE 0 END official_demo,
    GROUP_CONCAT(DISTINCT p.permission_code) permissions,GROUP_CONCAT(DISTINCT r.code) roles
    FROM merchant_user_sessions s JOIN merchant_users u ON u.merchant_id=s.merchant_id AND u.id=s.user_id JOIN merchants m ON m.id=s.merchant_id
    LEFT JOIN merchant_user_roles ur ON ur.merchant_id=u.merchant_id AND ur.user_id=u.id LEFT JOIN merchant_roles r ON r.id=ur.role_id LEFT JOIN merchant_role_permissions p ON p.role_id=ur.role_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') AND u.status='active' GROUP BY s.id`).bind(await sha(token)).first();
}

export async function merchantOperationsAllowed(db, merchantId, allowExactStagingDemo = false) {
  if (merchantId === "demo_beef_noodle") {
    const demo = await db.prepare("SELECT enabled,official_demo,demo_contract_exemption FROM production_demo_merchants WHERE merchant_id='demo_beef_noodle'").first().catch(() => null);
    if (!demo && allowExactStagingDemo) return true;
    return Number(demo?.enabled) === 1 && Number(demo?.official_demo) === 1 && Number(demo?.demo_contract_exemption) === 1;
  }
  return Boolean(await db.prepare("SELECT id FROM merchant_contract_signatures WHERE merchant_id=? AND status='VALID' LIMIT 1").bind(merchantId).first());
}

export async function authorizeMerchant(request, env, permission = "") {
  const session = await authenticateMerchantSession(request, env);
  if (!session) return { ok: false, status: 401, error: "UNAUTHENTICATED" };
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const csrf = request.headers.get("x-csrf-token") || "";
    if (!csrf || !same(await sha(csrf), session.csrf_hash)) return { ok: false, status: 403, error: "CSRF_INVALID" };
  }
  const roles = String(session.roles || "").split(","), permissions = String(session.permissions || "").split(",");
  if (permission && !roles.includes("owner") && !permissions.includes(permission)) return { ok: false, status: 403, error: "PERMISSION_DENIED" };
  return { ok: true, status: 200, session };
}

async function consumeHourlyLimit(db, scope, rawKey, limit) {
  const bucket = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString(), key = await sha(`${scope}:${rawKey}`);
  await db.prepare("INSERT INTO merchant_auth_rate_limits(scope,rate_key_hash,bucket_start,attempt_count) VALUES(?,?,?,1) ON CONFLICT(scope,rate_key_hash,bucket_start) DO UPDATE SET attempt_count=attempt_count+1,last_attempt_at=CURRENT_TIMESTAMP").bind(scope, key, bucket).run();
  const row = await db.prepare("SELECT attempt_count FROM merchant_auth_rate_limits WHERE scope=? AND rate_key_hash=? AND bucket_start=?").bind(scope, key, bucket).first();
  return Number(row?.attempt_count || 0) <= limit;
}

async function credentialRows(db, phone) {
  const result = await db.prepare(`SELECT c.*,l.platform_member_id,l.phone_normalized,u.status user_status,u.display_name,u.email,m.name merchant_name,m.status merchant_status
    FROM merchant_owner_links l JOIN merchant_users u ON u.merchant_id=l.merchant_id AND u.id=l.merchant_user_id JOIN merchants m ON m.id=l.merchant_id
    LEFT JOIN merchant_login_credentials c ON c.merchant_id=l.merchant_id AND c.merchant_user_id=l.merchant_user_id AND c.credential_type='numeric_password_8'
    WHERE l.phone_normalized=? AND l.status='active'`).bind(phone).all();
  return resultRows(result);
}

async function issueMerchantSession(db, request, selected) {
  const raw = random(), csrf = random(), expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await db.prepare(`INSERT INTO merchant_user_sessions(id,merchant_id,user_id,token_hash,csrf_hash,expires_at,platform_member_id,assurance_level,issued_via,credential_assurance)
    VALUES(?,?,?,?,?,?,?,'trusted_existing_session','numeric_password_8','password_authenticated')`).bind(uid("mus"), selected.merchant_id, selected.merchant_user_id, await sha(raw), await sha(csrf), expires, selected.platform_member_id).run();
  await audit(db, request, "LOGIN_SUCCESS", selected, { assurance_level: "password_authenticated" });
  return { raw, csrf, expires };
}
async function successfulLogin(db, request, selected, cors) {
  const session = await issueMerchantSession(db, request, selected);
  return json({ user: { id: selected.merchant_user_id, merchant_id: selected.merchant_id, name: selected.display_name }, merchant: { id: selected.merchant_id, name: selected.merchant_name }, platform_member_id: selected.platform_member_id, merchant_resolution: { automatic: true, count: 1, requires_selection: false }, csrf_token: session.csrf, expires_at: session.expires, next_url: "/merchant/dashboard" }, 200, { ...cors, "set-cookie": sessionCookie(session.raw) });
}

async function login(request, db, input, cors) {
  const phone = normalizeTaiwanMobile(input.phone), password = String(input.password || "");
  const ipAllowed = await consumeHourlyLimit(db, "merchant_login_ip_hour", clientIp(request), 100), phoneAllowed = await consumeHourlyLimit(db, "merchant_login_phone_hour", phone || "invalid", 20);
  if (!ipAllowed || !phoneAllowed) return json({ code: "MERCHANT_LOGIN_RATE_LIMITED", error: "登入嘗試過多，請稍後再試。" }, 429, cors);
  const candidates = phone ? await credentialRows(db, phone) : [], fallbackSalt = "merchant-auth-constant-time-fallback-v1";
  if (!candidates.length) await deriveMerchantPassword(password || "invalid", fallbackSalt);
  const now = Date.now(), valid = [], locked = [];
  for (const candidate of candidates) {
    if (candidate.locked_until && Date.parse(candidate.locked_until) > now) { locked.push(candidate); continue; }
    const supplied = candidate.password_hash ? await deriveMerchantPassword(password, candidate.password_salt, Number(candidate.password_iterations || ITERATIONS)) : await deriveMerchantPassword(password || "invalid", fallbackSalt);
    if (candidate.password_hash && same(supplied, candidate.password_hash) && candidate.status === "active" && candidate.user_status === "active" && candidate.merchant_status === "active" && Number(candidate.reset_required || 0) === 0) valid.push(candidate);
  }
  if (locked.length && !valid.length) { await audit(db, request, "ACCOUNT_LOCKED", locked[0], { locked_until: locked[0].locked_until }); return json({ code: "MERCHANT_ACCOUNT_LOCKED", error: "登入嘗試過多，請於 15 分鐘後再試。" }, 429, cors); }
  if (!valid.length) {
    for (const candidate of candidates.filter((item) => item.id)) {
      const failures = Number(candidate.failed_attempts || 0) + 1, lockedUntil = failures >= 5 ? new Date(now + 15 * 60_000).toISOString() : null;
      await db.prepare("UPDATE merchant_login_credentials SET failed_attempts=?,locked_until=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(failures, lockedUntil, candidate.id).run();
      await audit(db, request, lockedUntil ? "ACCOUNT_LOCKED" : "LOGIN_FAILED", candidate, { failed_attempts: failures, locked_until: lockedUntil });
    }
    if (!candidates.length) await audit(db, request, "LOGIN_FAILED", {}, { phone_hash: await sha(`phone:${phone || "invalid"}`) });
    const delay = Math.min(750, Math.max(0, ...candidates.map((item) => Number(item.failed_attempts || 0))) * 150);
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    return json({ code: "MERCHANT_CREDENTIAL_INVALID", error: GENERIC_ERROR }, 401, cors);
  }
  for (const item of valid) await db.prepare("UPDATE merchant_login_credentials SET failed_attempts=0,locked_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(item.id).run();
  if (valid.length === 1) return successfulLogin(db, request, valid[0], cors);
  const token = random(), expires = new Date(now + 5 * 60_000).toISOString();
  await db.prepare("INSERT INTO merchant_login_selections(id,platform_member_id,token_hash,allowed_merchant_ids_json,expires_at) VALUES(?,?,?,?,?)").bind(uid("mls"), valid[0].platform_member_id, await sha(token), JSON.stringify(valid.map((item) => item.merchant_id)), expires).run();
  return json({ merchant_resolution: { automatic: false, count: valid.length, requires_selection: true, selection_token: token, merchants: valid.map((item) => ({ id: item.merchant_id, name: item.merchant_name })) } }, 200, cors);
}

async function selectMerchant(request, db, input, cors) {
  const token = String(input.selection_token || ""), merchantId = String(input.merchant_id || ""), selection = await db.prepare("SELECT * FROM merchant_login_selections WHERE token_hash=? AND used_at IS NULL AND datetime(expires_at)>datetime('now')").bind(await sha(token)).first();
  let allowed = []; try { allowed = JSON.parse(selection?.allowed_merchant_ids_json || "[]"); } catch {}
  if (!selection || !allowed.includes(merchantId)) return json({ error: "商家選擇已失效，請重新登入。" }, 401, cors);
  const selected = await db.prepare(`SELECT c.*,l.platform_member_id,u.display_name,m.name merchant_name FROM merchant_login_credentials c JOIN merchant_owner_links l ON l.merchant_id=c.merchant_id AND l.merchant_user_id=c.merchant_user_id JOIN merchant_users u ON u.id=c.merchant_user_id AND u.merchant_id=c.merchant_id JOIN merchants m ON m.id=c.merchant_id WHERE c.merchant_id=? AND l.platform_member_id=? AND c.status='active'`).bind(merchantId, selection.platform_member_id).first();
  if (!selected) return json({ error: "商家選擇已失效，請重新登入。" }, 401, cors);
  await db.prepare("UPDATE merchant_login_selections SET used_at=CURRENT_TIMESTAMP WHERE id=? AND used_at IS NULL").bind(selection.id).run();
  return successfulLogin(db, request, selected, cors);
}

async function upsertCredential(db, merchantId, userId, password) {
  const salt = random(24), hash = await deriveMerchantPassword(password, salt);
  return db.prepare(`INSERT INTO merchant_login_credentials(id,merchant_user_id,merchant_id,credential_type,password_hash,password_salt,password_algorithm,password_iterations,reset_required,password_updated_at)
    VALUES(?,?,?,?,?,?,?,600000,0,CURRENT_TIMESTAMP) ON CONFLICT(merchant_id,merchant_user_id,credential_type) DO UPDATE SET password_hash=excluded.password_hash,password_salt=excluded.password_salt,password_algorithm=excluded.password_algorithm,password_iterations=excluded.password_iterations,failed_attempts=0,locked_until=NULL,reset_required=0,status='active',password_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`).bind(uid("mlc"), userId, merchantId, PASSWORD_TYPE, hash, salt, ALGORITHM);
}

async function setPasswordWithToken(request, db, input, cors) {
  const token = String(input.token || ""), password = String(input.password || ""), confirm = String(input.password_confirm || "");
  const setup = await db.prepare(`SELECT t.*,l.phone_normalized FROM merchant_password_setup_tokens t JOIN merchant_owner_links l ON l.merchant_id=t.merchant_id AND l.merchant_user_id=t.merchant_user_id WHERE t.token_hash=? AND t.used_at IS NULL AND t.revoked_at IS NULL AND datetime(t.expires_at)>datetime('now')`).bind(await sha(token)).first();
  if (!setup) return json({ error: "設定連結已失效，請聯絡創百業客服。" }, 401, cors);
  if (password !== confirm) return json({ error: "兩次輸入的密碼不一致。" }, 422, cors);
  const validation = validateMerchantNumericPassword(password, setup.phone_normalized); if (!validation.ok) return json({ error: validation.error }, 422, cors);
  await db.batch([await upsertCredential(db, setup.merchant_id, setup.merchant_user_id, password), db.prepare("UPDATE merchant_password_setup_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=? AND used_at IS NULL").bind(setup.id), db.prepare("UPDATE merchant_user_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND user_id=? AND revoked_at IS NULL").bind(setup.merchant_id, setup.merchant_user_id)]);
  await audit(db, request, setup.purpose === "PASSWORD_SETUP" ? "PASSWORD_CHANGED" : "PASSWORD_RESET", setup, { setup_completed: true });
  return json({ ok: true, next_url: "/merchant/login" }, 200, cors);
}

async function changePassword(request, env, input, cors) {
  const authorization = await authorizeMerchant(request, env); if (!authorization.ok) return json({ error: authorization.error }, authorization.status, cors);
  const session = authorization.session, password = String(input.password || ""), confirm = String(input.password_confirm || "");
  if (password !== confirm) return json({ error: "兩次輸入的密碼不一致。" }, 422, cors);
  const validation = validateMerchantNumericPassword(password, session.phone_normalized); if (!validation.ok) return json({ error: validation.error }, 422, cors);
  const existing = await env.FINANCE_DB.prepare("SELECT * FROM merchant_login_credentials WHERE merchant_id=? AND merchant_user_id=? AND credential_type=? AND status='active'").bind(session.merchant_id, session.user_id, PASSWORD_TYPE).first();
  if (existing) { const current = await deriveMerchantPassword(String(input.current_password || ""), existing.password_salt, Number(existing.password_iterations)); if (!same(current, existing.password_hash)) return json({ error: GENERIC_ERROR }, 401, cors); }
  const db = env.FINANCE_DB;
  await db.batch([await upsertCredential(db, session.merchant_id, session.user_id, password), db.prepare("UPDATE merchant_user_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND user_id=? AND id<>? AND revoked_at IS NULL").bind(session.merchant_id, session.user_id, session.session_id)]);
  await audit(db, request, "PASSWORD_CHANGED", { merchant_id: session.merchant_id, user_id: session.user_id }, { other_sessions_revoked: true });
  return json({ ok: true, other_sessions_revoked: true }, 200, cors);
}

async function registerMerchant(request, db, input, cors) {
  const phone = normalizeTaiwanMobile(input.phone), password = String(input.password || ""), confirm = String(input.password_confirm || "");
  if (!phone) return json({ error: "手機號碼格式不正確。" }, 422, cors);
  if (password !== confirm) return json({ error: "兩次輸入的密碼不一致。" }, 422, cors);
  const validation = validateMerchantNumericPassword(password, phone); if (!validation.ok) return json({ error: validation.error }, 422, cors);
  if (input.privacy_consent !== true || input.terms_consent !== true) return json({ error: "請先同意隱私權政策與服務條款。" }, 422, cors);
  if (await db.prepare("SELECT id FROM merchant_registration_applications WHERE phone_normalized=?").bind(phone).first()) return json({ ok: true, status: "PENDING_IDENTITY_REVIEW", message: "商家註冊資料已送出，創百業將聯絡您完成身分與方案確認。" }, 202, cors);
  const prepared = await preparePlatformMembershipBatch(db, { phone, source: "phone", originVerified: false, privacyConsentVersion: "merchant-registration-privacy-v1", issueSession: false, couponIssuanceEnabled: false });
  const salt = random(24), hash = await deriveMerchantPassword(password, salt);
  await db.batch([...prepared.statements, db.prepare(`INSERT INTO merchant_registration_applications(id,platform_member_id,phone_normalized,password_hash,password_salt,password_algorithm,password_iterations,privacy_consent_version,terms_consent_version)
    VALUES(?,?,?,?,?,?,600000,'merchant-registration-privacy-v1','merchant-registration-terms-v1')`).bind(uid("mreg"), prepared.memberId, phone, hash, salt, ALGORITHM)]);
  await finalizePlatformMembershipBatch(db, prepared);
  await audit(db, request, "MERCHANT_REGISTRATION_SUBMITTED", {}, { member_id: prepared.memberId, phone_hash: await sha(`phone:${phone}`), phone_verified: false });
  return json({ ok: true, status: "PENDING_IDENTITY_REVIEW", platform_member_reused: prepared.existing, phone_verified: false, message: "商家註冊資料已送出，創百業將聯絡您完成身分與方案確認。" }, 201, cors);
}

export async function handleMerchantCredentialAdmin(request, env, url, cors = {}, adminSession = null) {
  const match = url.pathname.match(/^\/api\/admin\/merchant-credentials\/([^/]+)\/(setup|reset)$/); if (!match || request.method !== "POST") return null;
  const merchantId = decodeURIComponent(match[1]), purpose = match[2] === "setup" ? "PASSWORD_SETUP" : "PASSWORD_RESET", db = env.FINANCE_DB;
  const owner = await db.prepare(`SELECT l.merchant_user_id,l.platform_member_id,l.phone_normalized FROM merchant_owner_links l JOIN merchant_users u ON u.id=l.merchant_user_id AND u.merchant_id=l.merchant_id WHERE l.merchant_id=? AND l.status='active' AND u.status='active' ORDER BY l.created_at LIMIT 1`).bind(merchantId).first();
  if (!owner) return json({ error: "找不到可用的商家管理者。" }, 404, cors);
  const token = random(), expires = new Date(Date.now() + 30 * 60_000).toISOString();
  await db.batch([db.prepare("UPDATE merchant_password_setup_tokens SET revoked_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND merchant_user_id=? AND used_at IS NULL AND revoked_at IS NULL").bind(merchantId, owner.merchant_user_id), db.prepare("INSERT INTO merchant_password_setup_tokens(id,merchant_id,merchant_user_id,token_hash,purpose,expires_at,created_by_admin_id) VALUES(?,?,?,?,?,?,?)").bind(uid("mps"), merchantId, owner.merchant_user_id, await sha(token), purpose, expires, adminSession?.admin_user_id || null), db.prepare("UPDATE merchant_login_credentials SET reset_required=?,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND merchant_user_id=?").bind(purpose === "PASSWORD_RESET" ? 1 : 0, merchantId, owner.merchant_user_id), ...(purpose === "PASSWORD_RESET" ? [db.prepare("UPDATE merchant_user_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND user_id=? AND revoked_at IS NULL").bind(merchantId, owner.merchant_user_id)] : [])]);
  await audit(db, request, purpose, { merchant_id: merchantId, merchant_user_id: owner.merchant_user_id }, { initiated_by_admin: adminSession?.admin_user_id || null });
  return json({ ok: true, purpose, setup_token: token, setup_url: `https://baiyeconnect.com/#/merchant/password-setup?token=${encodeURIComponent(token)}`, expires_at: expires, display_once: true }, 201, cors);
}

export async function handleMerchantAuth(request, env, url, cors = {}) {
  const db = env.FINANCE_DB; if (!db) return json({ error: "商家登入服務暫時無法使用。" }, 503, cors);
  if (url.pathname === "/api/merchant-auth/login" && request.method === "POST") return login(request, db, await request.json().catch(() => ({})), cors);
  if (url.pathname === "/api/merchant-auth/select" && request.method === "POST") return selectMerchant(request, db, await request.json().catch(() => ({})), cors);
  if (url.pathname === "/api/merchant-auth/register" && request.method === "POST") return registerMerchant(request, db, await request.json().catch(() => ({})), cors);
  if (url.pathname === "/api/merchant-auth/password/setup" && request.method === "POST") return setPasswordWithToken(request, db, await request.json().catch(() => ({})), cors);
  if (url.pathname === "/api/merchant-auth/password" && request.method === "PATCH") return changePassword(request, env, await request.json().catch(() => ({})), cors);
  if (url.pathname === "/api/merchant-auth/session" && request.method === "GET") {
    const session = await getSession(request, env); if (!session) return json({ error: "未登入。" }, 401, cors);
    const csrf = random(); await db.prepare("UPDATE merchant_user_sessions SET csrf_hash=?,last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(await sha(csrf), session.session_id).run();
    return json({ user: { id: session.user_id, merchant_id: session.merchant_id, email: session.email, name: session.display_name, phone_masked: session.phone_normalized ? `${session.phone_normalized.slice(0,2)}** *** ${session.phone_normalized.slice(-3)}` : null, display_role: "管理者", internal_role: "merchant_owner" }, merchant: { id: session.merchant_id, name: session.merchant_name, official_demo: Number(session.official_demo) === 1 }, platform_member_id: session.platform_member_id || null, permissions: String(session.permissions || "").split(",").filter(Boolean), roles: String(session.roles || "").split(",").filter(Boolean), csrf_token: csrf, expires_at: session.expires_at, next_url: "/merchant/dashboard" }, 200, cors);
  }
  if (url.pathname === "/api/merchant-auth/logout" && request.method === "POST") { const result = await authorizeMerchant(request, env); if (!result.ok) return json({ error: result.error }, result.status, cors); await db.prepare("UPDATE merchant_user_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=?").bind(result.session.session_id).run(); return json({ ok: true }, 200, { ...cors, "set-cookie": sessionCookie("", 0) }); }
  return null;
}
