import { passwordBlocklistCheck } from "./password-policy.js";

const encoder = new TextEncoder();
const COOKIE = "baiye_merchant_session";
const PRODUCTION_ITERATIONS = 600000;
const SEGMENT_ITERATIONS = 100000;
const LEGACY_ALGORITHM = "pbkdf2-sha256";
const CURRENT_ALGORITHM = "pbkdf2-sha256-segmented-v1";
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const b64 = (array) => btoa(String.fromCharCode(...array)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
const sha = async (value) => b64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(value)))));
const same = (a, b) => { if (!a || !b || a.length !== b.length) return false; let result = 0; for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index); return result === 0; };
const cookieValue = (request, name) => String(request.headers.get("cookie") || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || "";
const sessionCookie = (value, age = 28800) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${age}`;

export function configuredMerchantPasswordIterations(env = {}) {
  if (env.APP_MODE === "production" && env.AUTH_TEST_ITERATIONS) throw new Error("AUTH_TEST_ITERATIONS_FORBIDDEN");
  const testIterations = env.APP_MODE === "test" ? Number(env.AUTH_TEST_ITERATIONS || 0) : 0;
  return testIterations >= 1000 && testIterations <= SEGMENT_ITERATIONS ? testIterations : PRODUCTION_ITERATIONS;
}

async function pbkdf2(input, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", input, "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations }, key, 256));
}

export async function deriveMerchantPassword(password, salt, iterations = PRODUCTION_ITERATIONS, algorithm = iterations > SEGMENT_ITERATIONS ? CURRENT_ALGORITHM : LEGACY_ALGORITHM) {
  if (algorithm === LEGACY_ALGORITHM || iterations <= SEGMENT_ITERATIONS) return b64(await pbkdf2(encoder.encode(String(password)), String(salt), iterations));
  let material = encoder.encode(String(password));
  const segments = Math.ceil(iterations / SEGMENT_ITERATIONS);
  for (let index = 0; index < segments; index += 1) {
    material = await pbkdf2(material, `${salt}:${index}`, Math.min(SEGMENT_ITERATIONS, iterations - index * SEGMENT_ITERATIONS));
  }
  return b64(material);
}

async function securityEvent(db, merchantId, userId, action, metadata = {}) {
  await db.prepare("INSERT INTO merchant_security_events(id,merchant_id,user_id,action,metadata) VALUES(?,?,?,?,?)")
    .bind(`mse_${crypto.randomUUID()}`, merchantId || null, userId || null, action, JSON.stringify(metadata)).run();
}

async function rateLimitLogin(db, request, merchant, email) {
  const bucket = new Date().toISOString().slice(0, 16);
  const ipHash = await sha(request.headers.get("cf-connecting-ip") || "unknown-ip");
  const deviceHash = await sha(request.headers.get("user-agent") || "unknown-device");
  const accountHash = await sha(`${merchant}:${email}`);
  const entries = [["account_ip", await sha(`${accountHash}:${ipHash}`), 5], ["ip", ipHash, 30], ["device", deviceHash, 20]];
  for (const [scope, key, limit] of entries) {
    await db.prepare("INSERT OR IGNORE INTO merchant_auth_rate_limits(scope,rate_key_hash,bucket_start) VALUES(?,?,?)").bind(scope, key, bucket).run();
    const result = await db.prepare("UPDATE merchant_auth_rate_limits SET attempt_count=attempt_count+1,last_attempt_at=CURRENT_TIMESTAMP WHERE scope=? AND rate_key_hash=? AND bucket_start=? AND attempt_count<?").bind(scope, key, bucket, limit).run();
    if (!result.meta?.changes) return false;
  }
  return true;
}

export async function getMerchantSession(request, env) {
  const token = cookieValue(request, COOKIE);
  if (!token || !env.FINANCE_DB) return null;
  return env.FINANCE_DB.prepare(`SELECT s.id session_id,s.merchant_id,s.user_id,s.csrf_hash,s.expires_at,u.email,u.display_name,u.status,m.name merchant_name,GROUP_CONCAT(DISTINCT p.permission_code) permissions,GROUP_CONCAT(DISTINCT r.code) roles FROM merchant_user_sessions s JOIN merchant_users u ON u.merchant_id=s.merchant_id AND u.id=s.user_id JOIN merchants m ON m.id=s.merchant_id LEFT JOIN merchant_user_roles ur ON ur.merchant_id=u.merchant_id AND ur.user_id=u.id LEFT JOIN merchant_roles r ON r.id=ur.role_id LEFT JOIN merchant_role_permissions p ON p.role_id=ur.role_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') AND u.status='active' GROUP BY s.id`).bind(await sha(token)).first();
}

export async function authorizeMerchant(request, env, permission = "") {
  const session = await getMerchantSession(request, env);
  if (!session) return { ok: false, status: 401, error: "UNAUTHENTICATED" };
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const csrf = request.headers.get("x-csrf-token") || "";
    if (!csrf || !same(await sha(csrf), session.csrf_hash)) return { ok: false, status: 403, error: "CSRF_INVALID" };
  }
  const roles = String(session.roles || "").split(",");
  const permissions = String(session.permissions || "").split(",");
  if (permission && !roles.includes("owner") && !permissions.includes(permission)) return { ok: false, status: 403, error: "PERMISSION_DENIED" };
  return { ok: true, status: 200, session };
}

export async function requireMerchant(request, env, permission = "") {
  const result = await authorizeMerchant(request, env, permission);
  return result.ok ? result.session : null;
}

export async function handleMerchantAuth(request, env, url, cors = {}) {
  const db = env.FINANCE_DB;
  if (!db) return json({ error: "Merchant auth unavailable" }, 503, cors);

  if (url.pathname === "/api/merchant-auth/login" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const merchant = String(body.merchant_id || "").trim();
    if (!await rateLimitLogin(db, request, merchant, email)) return json({ error: "登入嘗試過多" }, 429, cors);
    const user = await db.prepare("SELECT * FROM merchant_users WHERE merchant_id=? AND email=?").bind(merchant, email).first();
    const supplied = user ? await deriveMerchantPassword(String(body.password || ""), user.password_salt, Number(user.password_iterations), user.password_algorithm || LEGACY_ALGORITHM) : random();
    if (!user || user.status !== "active" || !same(supplied, user.password_hash)) {
      await securityEvent(db, merchant, user?.id, "login_failed");
      return json({ error: "帳號或密碼錯誤" }, 401, cors);
    }
    const currentIterations = configuredMerchantPasswordIterations(env);
    if (Number(user.password_iterations) < currentIterations || user.password_algorithm !== CURRENT_ALGORITHM) {
      const salt = random();
      const upgraded = await deriveMerchantPassword(String(body.password), salt, currentIterations, CURRENT_ALGORITHM);
      await db.prepare("UPDATE merchant_users SET password_hash=?,password_salt=?,password_iterations=?,password_algorithm=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?").bind(upgraded, salt, currentIterations, CURRENT_ALGORITHM, user.id, merchant).run();
      await securityEvent(db, merchant, user.id, "password_hash_upgraded", { from_iterations: user.password_iterations, to_iterations: currentIterations });
    }
    const token = random(); const csrf = random(); const expires = new Date(Date.now() + 28800000).toISOString();
    await db.batch([
      db.prepare("INSERT INTO merchant_user_sessions(id,merchant_id,user_id,token_hash,csrf_hash,expires_at) VALUES(?,?,?,?,?,?)").bind(`mus_${crypto.randomUUID()}`, merchant, user.id, await sha(token), await sha(csrf), expires),
      db.prepare("INSERT INTO merchant_security_events(id,merchant_id,user_id,action) VALUES(?,?,?,'login_success')").bind(`mse_${crypto.randomUUID()}`, merchant, user.id),
    ]);
    return json({ user: { id: user.id, merchant_id: merchant, email: user.email, name: user.display_name }, csrf_token: csrf, expires_at: expires }, 200, { ...cors, "set-cookie": sessionCookie(token) });
  }

  if (url.pathname === "/api/merchant-auth/session" && request.method === "GET") {
    const session = await getMerchantSession(request, env);
    if (!session) return json({ error: "未登入" }, 401, cors);
    const csrf = random();
    await db.prepare("UPDATE merchant_user_sessions SET csrf_hash=?,last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(await sha(csrf), session.session_id).run();
    return json({ user: { id: session.user_id, merchant_id: session.merchant_id, email: session.email, name: session.display_name }, merchant: { id: session.merchant_id, name: session.merchant_name }, permissions: String(session.permissions || "").split(",").filter(Boolean), roles: String(session.roles || "").split(",").filter(Boolean), csrf_token: csrf, expires_at: session.expires_at }, 200, cors);
  }

  if (url.pathname === "/api/merchant-auth/request-password-reset" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const merchant = String(body.merchant_id || "").trim(); const email = String(body.email || "").trim().toLowerCase();
    const user = await db.prepare("SELECT id FROM merchant_users WHERE merchant_id=? AND email=? AND status='active'").bind(merchant, email).first();
    let debugToken;
    if (user) {
      const token = random(); debugToken = env.APP_MODE === "test" ? token : undefined;
      await db.batch([
        db.prepare("UPDATE merchant_password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND user_id=? AND used_at IS NULL").bind(merchant, user.id),
        db.prepare("INSERT INTO merchant_password_reset_tokens(id,merchant_id,user_id,token_hash,expires_at) VALUES(?,?,?,?,?)").bind(`mpr_${crypto.randomUUID()}`, merchant, user.id, await sha(token), new Date(Date.now() + 1800000).toISOString()),
        db.prepare("INSERT INTO merchant_security_events(id,merchant_id,user_id,action) VALUES(?,?,?,'password_reset_requested')").bind(`mse_${crypto.randomUUID()}`, merchant, user.id),
      ]);
    }
    return json({ ok: true, ...(debugToken ? { reset_token: debugToken } : {}) }, 202, cors);
  }

  if (url.pathname === "/api/merchant-auth/reset-password" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const policy = await passwordBlocklistCheck(body.new_password, env);
    if (!policy.ok) return json({ error: policy.error }, 400, cors);
    const tokenHash = await sha(body.token || ""); const salt = random(); const iterations = configuredMerchantPasswordIterations(env);
    const passwordHash = await deriveMerchantPassword(body.new_password, salt, iterations, CURRENT_ALGORITHM);
    const result = await db.prepare("UPDATE merchant_password_reset_tokens SET pending_password_hash=?,pending_password_salt=?,pending_password_iterations=?,pending_password_algorithm=?,used_at=CURRENT_TIMESTAMP WHERE token_hash=? AND used_at IS NULL AND datetime(expires_at)>datetime('now')").bind(passwordHash, salt, iterations, CURRENT_ALGORITHM, tokenHash).run();
    if (!result.meta?.changes) return json({ error: "RESET_TOKEN_INVALID" }, 400, cors);
    const reset = await db.prepare("SELECT merchant_id,user_id FROM merchant_password_reset_tokens WHERE token_hash=?").bind(tokenHash).first();
    await securityEvent(db, reset.merchant_id, reset.user_id, "password_reset_completed");
    return json({ ok: true }, 200, cors);
  }

  if (url.pathname === "/api/merchant-auth/logout" && request.method === "POST") {
    const authorization = await authorizeMerchant(request, env);
    if (!authorization.ok) return json({ error: authorization.error }, authorization.status, cors);
    const session = authorization.session;
    await db.batch([
      db.prepare("UPDATE merchant_user_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=?").bind(session.session_id),
      db.prepare("INSERT INTO merchant_security_events(id,merchant_id,user_id,action) VALUES(?,?,?,'logout')").bind(`mse_${crypto.randomUUID()}`, session.merchant_id, session.user_id),
    ]);
    return json({ ok: true }, 200, { ...cors, "set-cookie": sessionCookie("", 0) });
  }
  return null;
}
