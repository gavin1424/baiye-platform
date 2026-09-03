import { isProductionDemoMerchant } from "./demo-merchant.js";
import { inventorySummary } from "./inventory.js";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const safe = (value) => JSON.stringify(value ?? null);
const mask = (phone) => phone ? `${phone.slice(0, 2)}** *** ${phone.slice(-3)}` : null;

async function demoGate(env, merchantId, cors) {
  return await isProductionDemoMerchant(env, merchantId) ? null : json({ code: "MERCHANT_ACTIVATION_REQUIRED", error: "必須完成正式商家契約與啟用流程。" }, 423, cors);
}

async function audit(db, session, action, type, id, before, after) {
  await db.prepare(`INSERT INTO merchant_admin_audit_logs(id,actor_member_id,merchant_id,role,action,resource_type,resource_id,before_json,after_json)
    VALUES(?,?,?,?,?,?,?,?,?)`).bind(uid("maudit"), session.platform_member_id || null, session.merchant_id, "merchant_owner", action, type, id || null, safe(before), safe(after)).run();
}

export async function handleMerchantAdmin(request, env, url, cors, authorization) {
  const db = env.FINANCE_DB, session = authorization.session, merchantId = session.merchant_id;
  const denied = await demoGate(env, merchantId, cors); if (denied) return denied;
  if (url.pathname === "/api/merchant-admin/dashboard" && request.method === "GET") {
    const [profile, counts, relationship, inventory] = await Promise.all([
      db.prepare("SELECT * FROM merchant_admin_profiles WHERE merchant_id=?").bind(merchantId).first(),
      db.prepare(`SELECT (SELECT COUNT(*) FROM merchant_menu_items WHERE merchant_id=? AND status<>'archived') products,
        (SELECT COUNT(*) FROM merchant_bookings WHERE merchant_id=? AND demo_reset_at IS NULL) bookings,
        (SELECT COUNT(*) FROM merchant_ordering_memberships WHERE merchant_id=? AND status='active') members,
        (SELECT COUNT(*) FROM merchant_food_orders WHERE merchant_id=? AND demo_reset_at IS NULL) orders`).bind(merchantId, merchantId, merchantId, merchantId).first(),
      db.prepare("SELECT id,status FROM merchant_ordering_memberships WHERE merchant_id=? AND customer_id=(SELECT customer_id FROM platform_members WHERE id=?)").bind(merchantId, session.platform_member_id || "").first(),
      inventorySummary(db, merchantId),
    ]);
    return json({ merchant: { id: merchantId, name: profile?.brand_name || "百工牛肉麵", status: "active" }, administrator: { display_role: "管理者", internal_role: "merchant_owner", phone_masked: mask(session.phone_normalized), status: "ACTIVE" },
      membership: { platform_member: Boolean(session.platform_member_id), platform_member_id: session.platform_member_id || null, merchant_relationship: relationship?.status === "active", relationship_id: relationship?.id || null },
      account_status: "正式試用已啟用", contract: { status: "demo_exempt", exemption_merchant_id: "demo_beef_noodle" },
      plan: { plan_code: "demo_beef_noodle_full_trial", plan_name: "百工牛肉麵完整功能試用", discount_price_minor: 0 },
      entitlements: { merchant_content_editable: true, merchant_product_editable: true, ordering_enabled: true, kds_enabled: true, inventory_enabled: true },
      payment_readiness: { production_payment_enabled: false, manual_counter_demo: true }, profile, counts, inventory,
      operation_locked: false, demo_environment: true, official_demo: true, demo_badge: "百工官方示範" }, 200, cors);
  }
  if (url.pathname === "/api/merchant-admin/profile" && request.method === "GET") {
    const profile = await db.prepare("SELECT m.id,m.name,m.contact_name,m.phone,m.email,m.status,p.* FROM merchants m LEFT JOIN merchant_admin_profiles p ON p.merchant_id=m.id WHERE m.id=?").bind(merchantId).first();
    return json({ profile, entitlements: { merchant_content_editable: true, merchant_product_editable: true }, legal_fields_locked: true, official_demo: true }, 200, cors);
  }
  if (url.pathname === "/api/merchant-admin/profile" && request.method === "PATCH") {
    const input = await request.json().catch(() => ({}));
    if (Object.hasOwn(input, "merchant_id") && input.merchant_id !== merchantId) return json({ code: "MERCHANT_CROSS_ACCESS_DENIED" }, 403, cors);
    const before = await db.prepare("SELECT * FROM merchant_admin_profiles WHERE merchant_id=?").bind(merchantId).first();
    const next = { brand_name: clean(input.brand_name ?? before?.brand_name, 120), business_description: clean(input.business_description ?? before?.business_description, 2000), homepage_notice: clean(input.homepage_notice ?? before?.homepage_notice, 500) };
    await db.prepare("UPDATE merchant_admin_profiles SET brand_name=?,business_description=?,homepage_notice=?,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=?").bind(next.brand_name, next.business_description, next.homepage_notice, merchantId).run();
    await audit(db, session, "merchant.profile.updated", "merchant_profile", merchantId, before, next); return json({ ok: true, profile: next }, 200, cors);
  }
  if (url.pathname === "/api/merchant-admin/members" && request.method === "GET") {
    const rows = await db.prepare(`SELECT m.id,m.membership_no,m.status,m.visit_count,m.order_count,m.last_seen_at,c.display_name,c.phone_normalized
      FROM merchant_ordering_memberships m JOIN ordering_customers c ON c.id=m.customer_id WHERE m.merchant_id=? ORDER BY datetime(m.last_seen_at) DESC LIMIT 300`).bind(merchantId).all();
    return json({ members: (rows.results || []).map(({ phone_normalized, ...row }) => ({ ...row, phone_masked: mask(phone_normalized) })) }, 200, cors);
  }
  if (url.pathname === "/api/merchant-admin/bookings" && request.method === "GET") {
    const rows = await db.prepare(`SELECT b.id,b.booking_code,b.customer_name,b.customer_phone,b.start_at,b.end_at,b.status,s.name service_name,st.display_name staff_name
      FROM merchant_bookings b JOIN merchant_booking_services s ON s.id=b.service_id AND s.merchant_id=b.merchant_id JOIN merchant_booking_staff st ON st.id=b.staff_id AND st.merchant_id=b.merchant_id
      WHERE b.merchant_id=? AND b.demo_reset_at IS NULL ORDER BY datetime(b.start_at) DESC LIMIT 300`).bind(merchantId).all();
    return json({ bookings: (rows.results || []).map(({ customer_phone, ...row }) => ({ ...row, phone_masked: mask(customer_phone) })) }, 200, cors);
  }
  const booking = url.pathname.match(/^\/api\/merchant-admin\/bookings\/([^/]+)$/);
  if (booking && request.method === "PATCH") {
    const input = await request.json().catch(() => ({}));
    if (Object.hasOwn(input, "merchant_id") && input.merchant_id !== merchantId) return json({ code: "MERCHANT_CROSS_ACCESS_DENIED" }, 403, cors);
    const before = await db.prepare("SELECT id,status FROM merchant_bookings WHERE merchant_id=? AND id=? AND demo_reset_at IS NULL").bind(merchantId, booking[1]).first();
    if (!before) return json({ error: "找不到此預約。" }, 404, cors);
    const status = clean(input.status, 30); if (!["pending","confirmed","completed","cancelled","no_show"].includes(status)) return json({ error: "預約狀態不正確。" }, 422, cors);
    await db.prepare("UPDATE merchant_bookings SET status=?,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND id=?").bind(status, merchantId, before.id).run();
    await audit(db, session, "merchant.booking.updated", "booking", before.id, before, { ...before, status }); return json({ ok: true }, 200, cors);
  }
  if (url.pathname === "/api/merchant-admin/line" && request.method === "GET") {
    const row = await db.prepare("SELECT enabled,basic_id,display_name,add_friend_url,integration_mode FROM merchant_line_integrations WHERE merchant_id=?").bind(merchantId).first();
    return json({ integration: row && Number(row.enabled) === 1 ? row : null, status_text: "尚未設定 LINE 官方帳號", secrets_exposed: false }, 200, cors);
  }
  if (url.pathname === "/api/merchant-admin/account" && request.method === "GET") {
    const [member, relationship, sessions, merchant, credential] = await Promise.all([
      db.prepare("SELECT id,status FROM platform_members WHERE id=?").bind(session.platform_member_id || "").first(),
      db.prepare("SELECT id,status FROM merchant_ordering_memberships WHERE merchant_id=? AND customer_id=(SELECT customer_id FROM platform_members WHERE id=?)").bind(merchantId, session.platform_member_id || "").first(),
      db.prepare("SELECT id,issued_via,assurance_level,created_at,last_seen_at,expires_at FROM merchant_user_sessions WHERE merchant_id=? AND user_id=? AND revoked_at IS NULL AND datetime(expires_at)>datetime('now') ORDER BY datetime(created_at) DESC").bind(merchantId, session.user_id).all(),
      db.prepare("SELECT id,name,status,CASE WHEN id='demo_beef_noodle' THEN 1 ELSE 0 END official_demo FROM merchants WHERE id=?").bind(merchantId).first(),
      db.prepare("SELECT id,password_updated_at FROM merchant_login_credentials WHERE merchant_id=? AND merchant_user_id=? AND credential_type='numeric_password_8' AND status='active'").bind(merchantId, session.user_id).first(),
    ]);
    return json({ status: "ACTIVE", phone_masked: mask(session.phone_normalized), platform_member: { established: Boolean(member), id: member?.id || null, status: member?.status || null }, merchant_membership: { joined: relationship?.status === "active", id: relationship?.id || null }, merchant, credential: { established: Boolean(credential), password_updated_at: credential?.password_updated_at || null }, sessions: sessions.results || [], role: { display: "管理者", internal: "merchant_owner" } }, 200, cors);
  }
  if (url.pathname === "/api/merchant-admin/logout-all" && request.method === "POST") {
    await db.prepare("UPDATE merchant_user_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND user_id=? AND revoked_at IS NULL").bind(merchantId, session.user_id).run();
    await audit(db, session, "merchant.sessions.revoked_all", "merchant_user", session.user_id, null, { revoked: true });
    return json({ ok: true }, 200, { ...cors, "set-cookie": "baiye_merchant_session=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0" });
  }
  if (url.pathname === "/api/merchant-admin/audit" && request.method === "GET") {
    const rows = await db.prepare("SELECT id,role,action,resource_type,resource_id,before_json,after_json,created_at FROM merchant_admin_audit_logs WHERE merchant_id=? ORDER BY datetime(created_at) DESC LIMIT 100").bind(merchantId).all();
    return json({ items: rows.results || [] }, 200, cors);
  }
  return null;
}
