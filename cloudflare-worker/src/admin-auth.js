const E = new TextEncoder();
const D = new TextDecoder();
const COOKIE = "baiye_admin_session";
const ITERATIONS = 310000;
const SESSION_SECONDS = 8 * 60 * 60;

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const fromB64 = (value) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4)), (c) => c.charCodeAt(0));
const random = (bytes = 32) => { const data = new Uint8Array(bytes); crypto.getRandomValues(data); return b64(data); };
const sha256 = async (value) => b64(await crypto.subtle.digest("SHA-256", typeof value === "string" ? E.encode(value) : value));
const same = (a, b) => { if (!a || !b || a.length !== b.length) return false; let result = 0; for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; };
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", ...headers } });
const ip = (request) => request.headers.get("CF-Connecting-IP") || "unknown";
const cookieValue = (request) => (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1] || "";
const sessionCookie = (token, maxAge = SESSION_SECONDS) => `${COOKIE}=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAge}; Partitioned`;

export async function deriveAdminPassword(password, salt, iterations = ITERATIONS) {
  const material = await crypto.subtle.importKey("raw", E.encode(password), "PBKDF2", false, ["deriveBits"]);
  return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromB64(salt), iterations }, material, 256));
}

async function audit(db, request, actorId, action, metadata = {}) {
  await db.prepare("INSERT INTO audit_logs (id,actor_type,actor_id,action,entity_type,entity_id,metadata,ip_address) VALUES (?,?,?,?,?,?,?,?)")
    .bind(`audit_${crypto.randomUUID()}`, "admin", actorId, action, "admin_user", actorId || "unknown", JSON.stringify(metadata), ip(request)).run();
}

async function rateLimited(db, request, email) {
  const bucket = new Date(Math.floor(Date.now() / 900000) * 900000).toISOString();
  const key = await sha256(`${ip(request)}:${String(email || "").trim().toLowerCase()}`);
  await db.prepare("INSERT OR IGNORE INTO admin_login_attempts (rate_key,bucket_start) VALUES (?,?)").bind(key, bucket).run();
  const changed = await db.prepare("UPDATE admin_login_attempts SET attempt_count=attempt_count+1,last_attempt_at=CURRENT_TIMESTAMP WHERE rate_key=? AND bucket_start=? AND attempt_count<5").bind(key, bucket).run();
  return Number(changed.meta?.changes || 0) !== 1;
}

export async function getAdminSession(request, env) {
  if (!env.FINANCE_DB) return null;
  const token = cookieValue(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const session = await env.FINANCE_DB.prepare("SELECT s.id,s.admin_user_id,s.csrf_hash,s.expires_at,u.email,u.display_name,u.role,u.status FROM admin_sessions s JOIN admin_users u ON u.id=s.admin_user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') LIMIT 1").bind(tokenHash).first();
  if (!session || session.status !== "active") return null;
  return session;
}

export async function requireAdmin(request, env, roles = ["admin", "super_admin"]) {
  const session = await getAdminSession(request, env);
  if (!session || !roles.includes(session.role)) return null;
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const csrf = request.headers.get("x-csrf-token") || "";
    if (!csrf || !same(await sha256(csrf), session.csrf_hash)) return null;
  }
  return session;
}

export async function handleAdminAuth(request, env, url, cors) {
  if (!env.FINANCE_DB) return json({ error: "管理員驗證服務暫時無法使用。" }, 503, cors);
  const db = env.FINANCE_DB;
  if (url.pathname === "/api/admin/auth/login" && request.method === "POST") {
    let input = {}; try { input = await request.json(); } catch {}
    if (await rateLimited(db, request, input.email)) return json({ error: "登入嘗試次數過多，請稍後再試。" }, 429, cors);
    const email = String(input.email || "").trim().toLowerCase();
    const user = await db.prepare("SELECT * FROM admin_users WHERE email=? LIMIT 1").bind(email).first();
    const supplied = user ? await deriveAdminPassword(String(input.password || ""), user.password_salt, Number(user.password_iterations || ITERATIONS)) : random();
    if (!user || user.status !== "active" || !same(supplied, user.password_hash)) {
      await audit(db, request, user?.id || "unknown", "admin_login_failed", { email_hash: await sha256(email) });
      return json({ error: "Email 或密碼錯誤。" }, 401, cors);
    }
    const token = random(), csrf = random();
    const sessionId = `adms_${crypto.randomUUID()}`;
    const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
    await db.batch([
      db.prepare("INSERT INTO admin_sessions (id,admin_user_id,token_hash,csrf_hash,expires_at) VALUES (?,?,?,?,?)").bind(sessionId, user.id, await sha256(token), await sha256(csrf), expires),
      db.prepare("UPDATE admin_users SET last_login_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(user.id),
    ]);
    await audit(db, request, user.id, "admin_login_success", { session_id: sessionId });
    return json({ user: { email: user.email, name: user.display_name, role: user.role }, csrf_token: csrf, expires_at: expires }, 200, { ...cors, "set-cookie": sessionCookie(token) });
  }
  if (url.pathname === "/api/admin/auth/session" && request.method === "GET") {
    const session = await getAdminSession(request, env);
    if (!session) return json({ error: "管理員登入已失效。" }, 401, cors);
    const csrf = random();
    await db.prepare("UPDATE admin_sessions SET csrf_hash=?,last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(await sha256(csrf), session.id).run();
    return json({ user: { email: session.email, name: session.display_name, role: session.role }, csrf_token: csrf, expires_at: session.expires_at }, 200, cors);
  }
  if (url.pathname === "/api/admin/auth/logout" && request.method === "POST") {
    const session = await requireAdmin(request, env);
    if (!session) return json({ error: "未授權。" }, 401, cors);
    await db.prepare("UPDATE admin_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=?").bind(session.id).run();
    await audit(db, request, session.admin_user_id, "admin_logout", { session_id: session.id });
    return json({ ok: true }, 200, { ...cors, "set-cookie": sessionCookie("", 0) });
  }
  return null;
}
