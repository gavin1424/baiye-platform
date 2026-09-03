import { deriveMerchantPassword } from "./merchant-auth.js";
import { resetMerchantProductAssets } from "./merchant-assets.js";

export const PRODUCTION_DEMO_MERCHANT_ID = "demo_beef_noodle";
const E = new TextEncoder();
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
const sha = async (value) => b64(new Uint8Array(await crypto.subtle.digest("SHA-256", E.encode(String(value)))));
const shaHex = async (value) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", E.encode(String(value))))]
  .map((byte) => byte.toString(16).padStart(2, "0")).join("");
const same = (a, b) => { if (!a || !b || a.length !== b.length) return false; let result = 0; for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index); return result === 0; };
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;

export async function isProductionDemoMerchant(env, merchantId) {
  if (env.PRODUCTION_DEMO_ENABLED !== "true" || merchantId !== PRODUCTION_DEMO_MERCHANT_ID || !env.FINANCE_DB) return false;
  const row = await env.FINANCE_DB.prepare("SELECT enabled,official_demo,demo_contract_exemption FROM production_demo_merchants WHERE merchant_id='demo_beef_noodle'").first().catch(() => null);
  return Number(row?.enabled) === 1 && Number(row?.official_demo) === 1 && Number(row?.demo_contract_exemption) === 1;
}

async function audit(db, request, action, row, metadata = {}) {
  await db.prepare(`INSERT INTO production_demo_auth_events(id,merchant_id,platform_member_id,phone_hash,action,ip_hash,user_agent_hash,metadata_json)
    VALUES(?,'demo_beef_noodle',?,?,?,?,?,?)`).bind(uid("pdauth"), row?.platform_member_id || null,
    row?.phone_hash || await sha("phone:unknown"), action, await sha(`ip:${request.headers.get("cf-connecting-ip") || "unknown"}`),
    await sha(`ua:${request.headers.get("user-agent") || "unknown"}`), JSON.stringify(metadata)).run();
}

export async function handleProductionDemoLogin(request, env, url, cors = {}) {
  if (!["/api/merchant-auth/phone-login", "/api/production-demo/login"].includes(url.pathname) || request.method !== "POST") return null;
  if (env.PRODUCTION_DEMO_ENABLED !== "true") return json({ error: "Not found" }, 404, cors);
  const input = await request.json().catch(() => ({}));
  const phone = String(input.phone || "").replace(/[\s()-]/g, "");
  const code = String(input.verification_code || input.access_code || "").trim().slice(0, 256);
  const db = env.FINANCE_DB;
  const row = await db.prepare(`SELECT c.*,u.id merchant_user_id,u.status user_status,m.status merchant_status,d.enabled,d.official_demo,d.demo_contract_exemption
    FROM production_demo_access_credentials c JOIN production_demo_merchants d ON d.merchant_id=c.merchant_id
    JOIN merchant_owner_links l ON l.merchant_id=c.merchant_id AND l.platform_member_id=c.platform_member_id AND l.status='active'
    JOIN merchant_users u ON u.merchant_id=l.merchant_id AND u.id=l.merchant_user_id JOIN merchants m ON m.id=c.merchant_id
    WHERE c.merchant_id='demo_beef_noodle'`).first();
  const now = Date.now();
  if (row?.locked_until && Date.parse(row.locked_until) > now) {
    await audit(db, request, "login_rate_limited", row, { locked: true });
    return json({ code: "MERCHANT_LOGIN_RATE_LIMITED", error: "登入嘗試過多，請稍後再試。" }, 429, cors);
  }
  const expectedPhoneHash = await sha(`phone:${phone}`);
  const suppliedCodeHash = await deriveMerchantPassword(code || "invalid", row?.code_salt || "production-demo-fallback", Number(row?.code_iterations || 600000));
  const valid = Boolean(row && phone === "0900000026" && row.status === "active" && row.user_status === "active" && row.merchant_status === "active"
    && Number(row.enabled) === 1 && Number(row.official_demo) === 1 && Number(row.demo_contract_exemption) === 1
    && same(expectedPhoneHash, row.phone_hash) && same(suppliedCodeHash, row.code_hash));
  if (!valid) {
    if (row) {
      const failures = Number(row.failed_attempts || 0) + 1;
      const lockedUntil = failures >= 5 ? new Date(now + 15 * 60_000).toISOString() : null;
      await db.prepare("UPDATE production_demo_access_credentials SET failed_attempts=?,locked_until=?,updated_at=CURRENT_TIMESTAMP WHERE merchant_id='demo_beef_noodle'").bind(failures, lockedUntil).run();
      await audit(db, request, lockedUntil ? "login_rate_limited" : "login_failed", row, { failed_attempts: failures });
    }
    return json({ code: "MERCHANT_CREDENTIAL_INVALID", error: "手機號碼或管理者驗證碼不正確。" }, 401, cors);
  }
  const raw = random(), csrf = random(), memberToken = random();
  const expiresAt = new Date(now + 8 * 60 * 60_000).toISOString();
  const memberExpiresAt = new Date(now + 180 * 24 * 60 * 60_000).toISOString();
  await db.batch([
    db.prepare("UPDATE production_demo_access_credentials SET failed_attempts=0,locked_until=NULL,last_used_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE merchant_id='demo_beef_noodle'"),
    db.prepare("UPDATE merchant_user_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE merchant_id='demo_beef_noodle' AND user_id=? AND issued_via='production_demo_access' AND revoked_at IS NULL").bind(row.merchant_user_id),
    db.prepare(`INSERT INTO merchant_user_sessions(id,merchant_id,user_id,token_hash,csrf_hash,expires_at,platform_member_id,assurance_level,issued_via)
      VALUES(?,'demo_beef_noodle',?,?,?,?,?,'verified_phone','production_demo_access')`).bind(uid("mus"), row.merchant_user_id, await sha(raw), await sha(csrf), expiresAt, row.platform_member_id),
    db.prepare("INSERT INTO platform_member_sessions(id,member_id,token_hash,device_hash,expires_at) VALUES(?,?,?,?,?)").bind(uid("pmsess"), row.platform_member_id, await shaHex(memberToken), await shaHex(request.headers.get("x-device-id") || "production-demo"), memberExpiresAt),
  ]);
  await audit(db, request, "session_rotated", row, { merchant_user_id: row.merchant_user_id });
  await audit(db, request, "login_success", row, { display_role: "管理者" });
  return json({ code: "MERCHANT_PHONE_LOGIN_SUCCESS", merchant: { id: PRODUCTION_DEMO_MERCHANT_ID, name: "百工牛肉麵", status: "active" },
    administrator: { name: "百工牛肉麵｜管理者", display_role: "管理者", internal_role: "merchant_owner" },
    platform_member: { id: row.platform_member_id, relationship: "active" }, platform_session: { token: memberToken, expires_at: memberExpiresAt },
    merchant_resolution: { automatic: true, count: 1, requires_selection: false },
    csrf_token: csrf, expires_at: expiresAt, next_url: "/merchant/dashboard" }, 200,
  { ...cors, "set-cookie": `baiye_merchant_session=${raw}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=28800` });
}

export async function resetBeefNoodleDemo(env, request, session, cors = {}) {
  if (session.merchant_id !== PRODUCTION_DEMO_MERCHANT_ID || !await isProductionDemoMerchant(env, session.merchant_id)) return json({ code: "DEMO_RESET_FORBIDDEN", error: "此功能只限百工牛肉麵官方示範店。" }, 403, cors);
  const db = env.FINANCE_DB;
  await resetMerchantProductAssets(env, PRODUCTION_DEMO_MERCHANT_ID);
  await db.batch([
    db.prepare("UPDATE merchant_inventory_items SET stock_on_hand=0,inventory_enabled=0,reset_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE merchant_id='demo_beef_noodle' AND reset_at IS NULL"),
    db.prepare("UPDATE merchant_food_orders SET demo_reset_at=CURRENT_TIMESTAMP WHERE merchant_id='demo_beef_noodle' AND demo_reset_at IS NULL"),
    db.prepare("UPDATE merchant_bookings SET status='cancelled',cancelled_at=COALESCE(cancelled_at,CURRENT_TIMESTAMP),cancellation_reason=COALESCE(cancellation_reason,'official_demo_reset'),demo_reset_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE merchant_id='demo_beef_noodle' AND demo_reset_at IS NULL"),
    db.prepare(`UPDATE merchant_menu_items SET category_id=(SELECT category_id FROM production_demo_golden_menu_items g WHERE g.id=merchant_menu_items.id),
      name=(SELECT name FROM production_demo_golden_menu_items g WHERE g.id=merchant_menu_items.id),description=(SELECT description FROM production_demo_golden_menu_items g WHERE g.id=merchant_menu_items.id),
      price_minor=(SELECT price_minor FROM production_demo_golden_menu_items g WHERE g.id=merchant_menu_items.id),image_url=(SELECT image_url FROM production_demo_golden_menu_items g WHERE g.id=merchant_menu_items.id),
      available=1,status='active',archived_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE merchant_id='demo_beef_noodle' AND id IN(SELECT id FROM production_demo_golden_menu_items)`),
    db.prepare("UPDATE merchant_menu_items SET status='archived',available=0,archived_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE merchant_id='demo_beef_noodle' AND id NOT IN(SELECT id FROM production_demo_golden_menu_items)"),
    db.prepare("UPDATE production_demo_merchants SET reset_generation=reset_generation+1,last_reset_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE merchant_id='demo_beef_noodle'"),
  ]);
  const row = await db.prepare("SELECT platform_member_id,phone_hash FROM production_demo_access_credentials WHERE merchant_id='demo_beef_noodle'").first();
  await audit(db, request, "demo_reset", row, { actor_user_id: session.user_id, inventory_reset: "blank", orders_hidden: true, bookings_hidden: true });
  return json({ ok: true, merchant_id: PRODUCTION_DEMO_MERCHANT_ID, golden_restored: true, inventory_reset: "blank", preserved: ["platform_member", "owner_link", "contract_evidence", "global_config", "audit"] }, 200, cors);
}
