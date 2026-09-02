import { deriveMerchantPassword, issueMerchantSession, merchantSessionCookie } from "./merchant-auth.js";

const DEMO_MERCHANT_ID = "demo_beef_noodle";
const E = new TextEncoder();
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const sha = async (value) => b64(new Uint8Array(await crypto.subtle.digest("SHA-256", E.encode(String(value)))));
const same = (a, b) => { if (!a || !b || a.length !== b.length) return false; let result = 0; for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index); return result === 0; };
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;

export async function isStagingDemoMerchant(env, merchantId) {
  if (String(env.DEMO_PASSWORD_LOGIN_ENABLED || "").toLowerCase() !== "true" || merchantId !== DEMO_MERCHANT_ID || !env.FINANCE_DB) return false;
  try {
    const row = await env.FINANCE_DB.prepare("SELECT enabled FROM staging_demo_merchants WHERE merchant_id=?").bind(merchantId).first();
    return Number(row?.enabled) === 1;
  } catch {
    return false;
  }
}

async function audit(db, request, action, merchantId, username, metadata = {}) {
  await db.prepare(`INSERT INTO staging_demo_auth_events(id,merchant_id,username_hash,action,ip_hash,user_agent_hash,metadata_json)
    VALUES(?,?,?,?,?,?,?)`).bind(
    uid("sdauth"), merchantId || null, await sha(`username:${username}`), action,
    await sha(`ip:${request.headers.get("cf-connecting-ip") || "unknown"}`),
    await sha(`ua:${request.headers.get("user-agent") || "unknown"}`), JSON.stringify(metadata),
  ).run();
}

export async function handleDemoMerchantLogin(request, env, url, cors = {}) {
  if (url.pathname !== "/api/merchant-demo/login" || request.method !== "POST") return null;
  if (String(env.DEMO_PASSWORD_LOGIN_ENABLED || "").toLowerCase() !== "true") return json({ error: "Not found" }, 404, cors);
  const db = env.FINANCE_DB;
  const input = await request.json().catch(() => ({}));
  const username = String(input.username || "").trim().toLowerCase().slice(0, 80);
  const password = String(input.password || "").slice(0, 256);
  const credential = await db.prepare(`SELECT c.*,u.status user_status,m.status merchant_status
    FROM staging_demo_password_credentials c
    JOIN merchant_users u ON u.id=c.merchant_user_id AND u.merchant_id=c.merchant_id
    JOIN merchants m ON m.id=c.merchant_id
    WHERE c.username=? AND c.merchant_id=?`).bind(username, DEMO_MERCHANT_ID).first();
  const now = Date.now();
  if (credential?.locked_until && Date.parse(credential.locked_until) > now) {
    await audit(db, request, "login_rate_limited", credential.merchant_id, username, { locked: true });
    return json({ code: "DEMO_LOGIN_RATE_LIMITED", error: "登入嘗試過多，請稍後再試。" }, 429, cors);
  }
  const fakeSalt = "staging-demo-constant-time-fallback";
  const supplied = await deriveMerchantPassword(password, credential?.password_salt || fakeSalt, Number(credential?.password_iterations || 600000));
  const valid = Boolean(credential && credential.status === "active" && credential.user_status === "active" && credential.merchant_status === "active" && same(supplied, credential.password_hash));
  if (!valid) {
    if (credential) {
      const failures = Number(credential.failed_attempts || 0) + 1;
      const lockedUntil = failures >= 5 ? new Date(now + 15 * 60_000).toISOString() : null;
      await db.prepare("UPDATE staging_demo_password_credentials SET failed_attempts=?,locked_until=?,updated_at=CURRENT_TIMESTAMP WHERE username=?").bind(failures, lockedUntil, username).run();
      await audit(db, request, lockedUntil ? "login_rate_limited" : "login_failed", credential.merchant_id, username, { failed_attempts: failures });
    } else {
      await audit(db, request, "login_failed", null, username || "missing", { credential_found: false });
    }
    return json({ code: "DEMO_CREDENTIAL_INVALID", error: "試用帳號或密碼錯誤。" }, 401, cors);
  }
  await db.batch([
    db.prepare("UPDATE staging_demo_password_credentials SET failed_attempts=0,locked_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE username=?").bind(username),
    db.prepare("UPDATE merchant_user_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND user_id=? AND issued_via='staging_demo_password' AND revoked_at IS NULL").bind(credential.merchant_id, credential.merchant_user_id),
  ]);
  const session = await issueMerchantSession(db, { merchantId: credential.merchant_id, userId: credential.merchant_user_id, platformMemberId: null, assuranceLevel: "trusted_existing_session", issuedVia: "staging_demo_password" });
  await audit(db, request, "session_rotated", credential.merchant_id, username, { session_id_hash: await sha(session.sessionId) });
  await audit(db, request, "login_success", credential.merchant_id, username, { display_role: "管理者" });
  return json({ code: "DEMO_LOGIN_SUCCESS", merchant: { id: credential.merchant_id, name: "百工牛肉麵" }, administrator: { name: "百工牛肉麵｜試用管理者", display_role: "管理者", internal_role: "merchant_owner" }, demo_environment: true, badge: "Demo 試用環境", csrf_token: session.csrf, expires_at: session.expiresAt, next_url: "/merchant/dashboard" }, 200, { ...cors, "set-cookie": merchantSessionCookie(session.raw) });
}

export async function resetBeefNoodleDemo(db, request, session) {
  if (session.merchant_id !== DEMO_MERCHANT_ID) return json({ code: "DEMO_RESET_FORBIDDEN", error: "此功能只限百工牛肉麵試用環境。" }, 403);
  const statements = [
    db.prepare("DROP TRIGGER IF EXISTS trg_ordering_item_option_immutable_delete"),
    db.prepare("DROP TRIGGER IF EXISTS trg_food_order_items_no_delete"),
    db.prepare("DROP TRIGGER IF EXISTS trg_order_pricing_no_delete"),
    db.prepare("DROP TRIGGER IF EXISTS trg_invoices_document_immutable_delete"),
    db.prepare("DELETE FROM invoice_events WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM invoice_allowances WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE merchant_id=?)").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM invoices WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM invoice_requests WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_order_invoice_preferences WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_payment_domain_events WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_order_inventory_reservations WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_checkout_payment_events WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_checkout_payment_transactions WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_checkout_payment_intents WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM payment_events WHERE payment_id IN (SELECT id FROM payments WHERE merchant_id=? AND note LIKE 'qr_order:%')").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE merchant_id=? AND note LIKE 'qr_order:%')").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM payments WHERE merchant_id=? AND note LIKE 'qr_order:%'").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_food_order_item_options WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_order_payment_events WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_order_payment_intents WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_order_pricing WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_food_order_items WHERE order_id IN (SELECT id FROM merchant_food_orders WHERE merchant_id=?)").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_food_orders WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_dining_sessions WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_member_sessions WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_ordering_memberships WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_bookings WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_menu_item_option_groups WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_menu_option_values WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_menu_option_groups WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_menu_items WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_menu_categories WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("INSERT INTO merchant_menu_categories SELECT * FROM staging_demo_golden_menu_categories WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("INSERT INTO merchant_menu_items SELECT * FROM staging_demo_golden_menu_items WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("INSERT INTO merchant_menu_option_groups SELECT * FROM staging_demo_golden_option_groups WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("INSERT INTO merchant_menu_option_values SELECT * FROM staging_demo_golden_option_values WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("INSERT INTO merchant_menu_item_option_groups SELECT * FROM staging_demo_golden_item_option_groups WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_ordering_qr_codes WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare(`UPDATE merchant_ordering_settings SET
      display_name=(SELECT display_name FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      enabled=(SELECT enabled FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      currency=(SELECT currency FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      dine_in_enabled=(SELECT dine_in_enabled FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      takeaway_enabled=(SELECT takeaway_enabled FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      require_member=(SELECT require_member FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      consent_version=(SELECT consent_version FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      ordering_open=(SELECT ordering_open FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      accepting_orders=(SELECT accepting_orders FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      temporary_closed_message=(SELECT temporary_closed_message FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      auto_accept_orders=(SELECT auto_accept_orders FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      order_number_prefix=(SELECT order_number_prefix FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      max_items_per_order=(SELECT max_items_per_order FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      customer_cancel_before_accept=(SELECT customer_cancel_before_accept FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      estimated_prep_minutes=(SELECT estimated_prep_minutes FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      new_order_sound_enabled=(SELECT new_order_sound_enabled FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      table_session_enabled=(SELECT table_session_enabled FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      show_sold_out_items=(SELECT show_sold_out_items FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      last_order_time=(SELECT last_order_time FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),
      timezone=(SELECT timezone FROM staging_demo_golden_ordering_settings WHERE merchant_id=?),updated_at=CURRENT_TIMESTAMP
      WHERE merchant_id=?`).bind(...Array(21).fill(DEMO_MERCHANT_ID)),
    db.prepare("INSERT INTO merchant_ordering_qr_codes SELECT * FROM staging_demo_golden_qr_codes WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("DELETE FROM merchant_admin_profiles WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("INSERT INTO merchant_admin_profiles SELECT * FROM staging_demo_golden_admin_profile WHERE merchant_id=?").bind(DEMO_MERCHANT_ID),
    db.prepare("CREATE TRIGGER trg_ordering_item_option_immutable_delete BEFORE DELETE ON merchant_food_order_item_options BEGIN SELECT RAISE(ABORT,'ORDER_OPTION_IMMUTABLE'); END"),
    db.prepare("CREATE TRIGGER trg_food_order_items_no_delete BEFORE DELETE ON merchant_food_order_items BEGIN SELECT RAISE(ABORT,'submitted order items are immutable'); END"),
    db.prepare("CREATE TRIGGER trg_order_pricing_no_delete BEFORE DELETE ON merchant_order_pricing BEGIN SELECT RAISE(ABORT,'order pricing is immutable'); END"),
    db.prepare("CREATE TRIGGER trg_invoices_document_immutable_delete BEFORE DELETE ON invoices FOR EACH ROW BEGIN SELECT RAISE(ABORT,'issued invoices cannot be deleted'); END"),
  ];
  await db.batch(statements);
  await db.prepare("INSERT INTO staging_demo_auth_events(id,merchant_id,username_hash,action,ip_hash,user_agent_hash,metadata_json) VALUES(?,?,?,?,?,?,?)").bind(uid("sdauth"), DEMO_MERCHANT_ID, await sha("username:baiye-beef-demo"), "demo_reset", await sha(`ip:${request.headers.get("cf-connecting-ip") || "unknown"}`), await sha(`ua:${request.headers.get("user-agent") || "unknown"}`), JSON.stringify({ actor_user_id: session.user_id, golden_restored: true })).run();
  return json({ ok: true, merchant_id: DEMO_MERCHANT_ID, golden_restored: true, preserved: ["merchant", "credentials", "contract_evidence", "audit"] }, 200);
}
