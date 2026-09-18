import { deriveAdminPassword } from "./admin-auth.js";

const E = new TextEncoder();
const COOKIE = "__Host-baiye_owner_session";
const SESSION_SECONDS = 4 * 60 * 60;
const PBKDF2_ITERATIONS = 400000;

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const random = (bytes = 32) => { const data = new Uint8Array(bytes); crypto.getRandomValues(data); return b64(data); };
const sha256 = async (value) => b64(await crypto.subtle.digest("SHA-256", E.encode(String(value))));
const same = (a, b) => { if (!a || !b || a.length !== b.length) return false; let result = 0; for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; };
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", ...headers } });
const cookie = (token, maxAge = SESSION_SECONDS) => `${COOKIE}=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAge}; Partitioned`;
const cookieValue = (request) => (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1] || "";
const requestMeta = (request) => ({ ip: request.headers.get("CF-Connecting-IP") || "unknown", user_agent: (request.headers.get("user-agent") || "").slice(0, 300) });

function decodeBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(value || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) { const index = alphabet.indexOf(char); if (index < 0) return new Uint8Array(); bits += index.toString(2).padStart(5, "0"); }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(bytes);
}

export async function ownerTotp(secret, at = Date.now()) {
  const keyBytes = decodeBase32(secret);
  if (!keyBytes.length) return "";
  const counter = Math.floor(at / 30000);
  const message = new Uint8Array(8);
  let value = BigInt(counter);
  for (let i = 7; i >= 0; i -= 1) { message[i] = Number(value & 255n); value >>= 8n; }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const hash = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = hash[hash.length - 1] & 15;
  const binary = ((hash[offset] & 127) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
  return String(binary % 1000000).padStart(6, "0");
}

async function verifyTotp(secret, supplied) {
  const code = String(supplied || "").replace(/\D/g, "");
  if (code.length !== 6 || !secret) return false;
  for (const offset of [-30000, 0, 30000]) if (same(await ownerTotp(secret, Date.now() + offset), code)) return true;
  return false;
}

async function audit(db, request, actorId, action, after = {}) {
  await db.prepare("INSERT INTO owner_audit_logs(id,actor_id,action,entity_type,entity_id,after_json,request_metadata_json) VALUES(?,?,?,?,?,?,?)")
    .bind(`oaud_${crypto.randomUUID()}`, actorId || "unknown", action, "owner_session", actorId || "unknown", JSON.stringify(after), JSON.stringify(requestMeta(request))).run();
}

async function rateLimited(db, request, email) {
  const bucket = new Date(Math.floor(Date.now() / 900000) * 900000).toISOString();
  const key = await sha256(`${requestMeta(request).ip}:${String(email || "").trim().toLowerCase()}`);
  await db.prepare("INSERT OR IGNORE INTO owner_login_attempts(rate_key,bucket_start) VALUES(?,?)").bind(key, bucket).run();
  const changed = await db.prepare("UPDATE owner_login_attempts SET attempt_count=attempt_count+1,last_attempt_at=CURRENT_TIMESTAMP WHERE rate_key=? AND bucket_start=? AND attempt_count<5").bind(key, bucket).run();
  return Number(changed.meta?.changes || 0) !== 1;
}

export async function getOwnerSession(request, env) {
  if (!env.FINANCE_DB) return null;
  const raw = cookieValue(request);
  if (!raw) return null;
  const session = await env.FINANCE_DB.prepare("SELECT s.id,s.admin_user_id,s.csrf_hash,s.reauth_at,s.expires_at,u.email,u.display_name,o.role,o.status FROM owner_admin_sessions s JOIN owner_admin_users o ON o.admin_user_id=s.admin_user_id JOIN admin_users u ON u.id=s.admin_user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') LIMIT 1").bind(await sha256(raw)).first();
  return session && session.status === "active" && session.role === "OWNER_ADMIN" ? session : null;
}

export async function requireOwner(request, env) {
  const session = await getOwnerSession(request, env);
  if (!session) return null;
  if (!['GET','HEAD','OPTIONS'].includes(request.method)) {
    const csrf = request.headers.get("x-csrf-token") || "";
    if (!csrf || !same(await sha256(csrf), session.csrf_hash)) return null;
  }
  return session;
}

export async function handleOwnerAuth(request, env, url, cors) {
  const db = env.FINANCE_DB;
  if (!db) return json({ error: "Owner 驗證服務暫時無法使用。" }, 503, cors);
  if (url.pathname === "/api/owner/auth/login" && request.method === "POST") {
    if (!env.OWNER_ADMIN_TOTP_SECRET) return json({ error: "Owner MFA 尚未完成 Production 設定。", code: "OWNER_MFA_NOT_CONFIGURED" }, 503, cors);
    let input = {}; try { input = await request.json(); } catch {}
    if (await rateLimited(db, request, input.email)) return json({ error: "登入嘗試次數過多，請稍後再試。" }, 429, cors);
    const email = String(input.email || "").trim().toLowerCase();
    const user = await db.prepare("SELECT u.*,o.role,o.status AS owner_status FROM admin_users u JOIN owner_admin_users o ON o.admin_user_id=u.id WHERE u.email=? COLLATE NOCASE LIMIT 1").bind(email).first();
    const supplied = user ? await deriveAdminPassword(String(input.password || ""), user.password_salt, Number(user.password_iterations || PBKDF2_ITERATIONS)) : random();
    const valid = user && user.status === "active" && user.owner_status === "active" && user.role === "OWNER_ADMIN" && same(supplied, user.password_hash) && await verifyTotp(env.OWNER_ADMIN_TOTP_SECRET, input.otp);
    if (!valid) { await audit(db, request, user?.id || "unknown", "OWNER_LOGIN_FAILED", { email_hash: await sha256(email) }); return json({ error: "Owner Email、密碼或驗證碼錯誤。" }, 401, cors); }
    const token = random(), csrf = random(), id = `owns_${crypto.randomUUID()}`, expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
    await db.batch([
      db.prepare("INSERT INTO owner_admin_sessions(id,admin_user_id,token_hash,csrf_hash,reauth_at,expires_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP,?)").bind(id,user.id,await sha256(token),await sha256(csrf),expires),
      db.prepare("UPDATE admin_users SET last_login_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(user.id),
    ]);
    await audit(db, request, user.id, "OWNER_LOGIN_SUCCESS", { session_id: id });
    return json({ user: { email:user.email,name:user.display_name,role:"OWNER_ADMIN" }, csrf_token:csrf, expires_at:expires }, 200, { ...cors, "set-cookie":cookie(token) });
  }
  if (url.pathname === "/api/owner/auth/session" && request.method === "GET") {
    const session = await getOwnerSession(request, env);
    if (!session) return json({ error:"Owner 登入已失效。" }, 401, cors);
    const csrf = random();
    await db.prepare("UPDATE owner_admin_sessions SET csrf_hash=?,last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(await sha256(csrf),session.id).run();
    return json({ user:{email:session.email,name:session.display_name,role:"OWNER_ADMIN"},csrf_token:csrf,expires_at:session.expires_at },200,cors);
  }
  if (url.pathname === "/api/owner/auth/reauth" && request.method === "POST") {
    const session = await requireOwner(request, env);
    if (!session) return json({ error:"Owner Session 或 CSRF 驗證失敗。" },401,cors);
    if (!env.OWNER_ADMIN_TOTP_SECRET) return json({ error:"Owner MFA 尚未完成 Production 設定。",code:"OWNER_MFA_NOT_CONFIGURED" },503,cors);
    let input={};try{input=await request.json();}catch{}
    const user=await db.prepare("SELECT * FROM admin_users WHERE id=? AND status='active'").bind(session.admin_user_id).first();
    const supplied=user?await deriveAdminPassword(String(input.password||""),user.password_salt,Number(user.password_iterations||PBKDF2_ITERATIONS)):random();
    if(!user||!same(supplied,user.password_hash)||!await verifyTotp(env.OWNER_ADMIN_TOTP_SECRET,input.otp)){await audit(db,request,session.admin_user_id,"OWNER_REAUTH_FAILED");return json({error:"重新驗證失敗。"},401,cors);}
    await db.prepare("UPDATE owner_admin_sessions SET reauth_at=CURRENT_TIMESTAMP,last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(session.id).run();
    await audit(db,request,session.admin_user_id,"OWNER_REAUTH_SUCCESS",{session_id:session.id});
    return json({ok:true,reauthenticated_at:new Date().toISOString()},200,cors);
  }
  if (url.pathname === "/api/owner/auth/logout" && request.method === "POST") {
    const session = await requireOwner(request, env);
    if (!session) return json({ error:"未授權。" },401,cors);
    await db.prepare("UPDATE owner_admin_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=?").bind(session.id).run();
    await audit(db,request,session.admin_user_id,"OWNER_LOGOUT",{session_id:session.id});
    return json({ok:true},200,{...cors,"set-cookie":cookie("",0)});
  }
  return null;
}
