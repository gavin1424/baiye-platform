const encoder = new TextEncoder();
const COOKIE = "baiye_merchant_session";
const ITERATIONS = 600000;
const SEGMENT = 100000;
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const b64 = (array) => btoa(String.fromCharCode(...array)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
const sha = async (value) => b64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(value)))));
const same = (a, b) => { if (!a || !b || a.length !== b.length) return false; let result = 0; for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index); return result === 0; };
const cookie = (request, name) => String(request.headers.get("cookie") || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || "";
const sessionCookie = (value, age = 28800) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${age}`;

async function pbkdf2(input, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", input, "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations }, key, 256));
}

export async function deriveMerchantPassword(password, salt, iterations = ITERATIONS) {
  let material = encoder.encode(String(password));
  for (let index = 0; index < Math.ceil(iterations / SEGMENT); index += 1) {
    material = await pbkdf2(material, `${salt}:${index}`, Math.min(SEGMENT, iterations - index * SEGMENT));
  }
  return b64(material);
}

async function getSession(request, env) {
  const token = cookie(request, COOKIE);
  if (!token || !env.FINANCE_DB) return null;
  return env.FINANCE_DB.prepare(`
    SELECT s.id session_id,s.merchant_id,s.user_id,s.csrf_hash,s.expires_at,
           u.email,u.display_name,u.status,m.name merchant_name,
           GROUP_CONCAT(DISTINCT p.permission_code) permissions,
           GROUP_CONCAT(DISTINCT r.code) roles
    FROM merchant_user_sessions s
    JOIN merchant_users u ON u.merchant_id=s.merchant_id AND u.id=s.user_id
    JOIN merchants m ON m.id=s.merchant_id
    LEFT JOIN merchant_user_roles ur ON ur.merchant_id=u.merchant_id AND ur.user_id=u.id
    LEFT JOIN merchant_roles r ON r.id=ur.role_id
    LEFT JOIN merchant_role_permissions p ON p.role_id=ur.role_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') AND u.status='active'
    GROUP BY s.id
  `).bind(await sha(token)).first();
}

export async function authorizeMerchant(request, env, permission = "") {
  const session = await getSession(request, env);
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

// Contract onboarding is an additive gate.  Older Production schemas simply
// have no row and remain unchanged; a Soft-POS merchant with a locked row can
// view its portal but cannot create operational records.
export async function merchantOperationsAllowed(db, merchantId) {
  try {
    const state = await db.prepare("SELECT operation_locked,state FROM merchant_onboarding_states WHERE merchant_id=?").bind(merchantId).first();
    if (state && Number(state.operation_locked) === 1) return { ok: false, status: 423, error: "MERCHANT_CONTRACT_REQUIRED", state: state.state };
  } catch {
    // The query is deliberately compatible with installations predating 0020.
  }
  return { ok: true, status: 200 };
}

async function allowLogin(db, request, merchantId, email) {
  const bucket = new Date().toISOString().slice(0, 16);
  const key = await sha(`${merchantId}:${email}:${request.headers.get("cf-connecting-ip") || "unknown"}`);
  await db.prepare("INSERT OR IGNORE INTO merchant_auth_rate_limits(scope,rate_key_hash,bucket_start) VALUES('login',?,?)").bind(key, bucket).run();
  const result = await db.prepare("UPDATE merchant_auth_rate_limits SET attempt_count=attempt_count+1,last_attempt_at=CURRENT_TIMESTAMP WHERE scope='login' AND rate_key_hash=? AND bucket_start=? AND attempt_count<5").bind(key, bucket).run();
  return Boolean(result.meta?.changes);
}

export async function handleMerchantAuth(request, env, url, cors = {}) {
  const db = env.FINANCE_DB;
  if (!db) return json({ error: "商家登入服務暫時無法使用。" }, 503, cors);
  if (url.pathname === "/api/merchant-auth/login" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const merchantId = String(body.merchant_id || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    if (!await allowLogin(db, request, merchantId, email)) return json({ error: "登入嘗試過多，請稍後再試。" }, 429, cors);
    const user = await db.prepare("SELECT * FROM merchant_users WHERE merchant_id=? AND email=?").bind(merchantId, email).first();
    const supplied = user ? await deriveMerchantPassword(String(body.password || ""), user.password_salt, Number(user.password_iterations || ITERATIONS)) : random();
    if (!user || user.status !== "active" || !same(supplied, user.password_hash)) return json({ error: "帳號或密碼錯誤。" }, 401, cors);
    const raw = random(); const csrf = random(); const expires = new Date(Date.now() + 28800000).toISOString();
    await db.batch([
      db.prepare("INSERT INTO merchant_user_sessions(id,merchant_id,user_id,token_hash,csrf_hash,expires_at) VALUES(?,?,?,?,?,?)").bind(`mus_${crypto.randomUUID()}`, merchantId, user.id, await sha(raw), await sha(csrf), expires),
      db.prepare("INSERT INTO merchant_security_events(id,merchant_id,user_id,action) VALUES(?,?,?,'login_success')").bind(`mse_${crypto.randomUUID()}`, merchantId, user.id),
    ]);
    return json({ user: { id: user.id, merchant_id: merchantId, email: user.email, name: user.display_name }, csrf_token: csrf, expires_at: expires }, 200, { ...cors, "set-cookie": sessionCookie(raw) });
  }
  if (url.pathname === "/api/merchant-auth/session" && request.method === "GET") {
    const session = await getSession(request, env);
    if (!session) return json({ error: "未登入。" }, 401, cors);
    const csrf = random();
    await db.prepare("UPDATE merchant_user_sessions SET csrf_hash=?,last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(await sha(csrf), session.session_id).run();
    return json({ user: { id: session.user_id, merchant_id: session.merchant_id, email: session.email, name: session.display_name }, merchant: { id: session.merchant_id, name: session.merchant_name }, permissions: String(session.permissions || "").split(",").filter(Boolean), roles: String(session.roles || "").split(",").filter(Boolean), csrf_token: csrf, expires_at: session.expires_at }, 200, cors);
  }
  if (url.pathname === "/api/merchant-auth/logout" && request.method === "POST") {
    const result = await authorizeMerchant(request, env);
    if (!result.ok) return json({ error: result.error }, result.status, cors);
    await db.prepare("UPDATE merchant_user_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=?").bind(result.session.session_id).run();
    return json({ ok: true }, 200, { ...cors, "set-cookie": sessionCookie("", 0) });
  }
  return null;
}
