import { resetMerchantProductAssets } from "./merchant-assets.js";

export const PRODUCTION_DEMO_MERCHANT_ID = "demo_beef_noodle";
const E = new TextEncoder();
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const sha = async (value) => b64(new Uint8Array(await crypto.subtle.digest("SHA-256", E.encode(String(value)))));
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;

export async function isProductionDemoMerchant(env, merchantId) {
  if (env.PRODUCTION_DEMO_ENABLED !== "true" || merchantId !== PRODUCTION_DEMO_MERCHANT_ID || !env.FINANCE_DB) return false;
  if (env.APP_MODE === "staging") return true;
  const row = await env.FINANCE_DB.prepare("SELECT enabled,official_demo,demo_contract_exemption FROM production_demo_merchants WHERE merchant_id='demo_beef_noodle'").first().catch(() => null);
  return Number(row?.enabled) === 1 && Number(row?.official_demo) === 1 && Number(row?.demo_contract_exemption) === 1;
}

async function audit(db, request, action, row, metadata = {}) {
  await db.prepare(`INSERT INTO production_demo_auth_events(id,merchant_id,platform_member_id,phone_hash,action,ip_hash,user_agent_hash,metadata_json)
    VALUES(?,'demo_beef_noodle',?,?,?,?,?,?)`).bind(uid("pdauth"), row?.platform_member_id || null,
    row?.phone_hash || await sha("phone:unknown"), action, await sha(`ip:${request.headers.get("cf-connecting-ip") || "unknown"}`),
    await sha(`ua:${request.headers.get("user-agent") || "unknown"}`), JSON.stringify(metadata)).run();
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
