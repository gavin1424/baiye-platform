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

  if (url.pathname === "/api/merchant-admin/operations/reports" && request.method === "GET") {
    const period = clean(url.searchParams.get("period") || "today", 20);
    const days = period === "yesterday" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 0;
    const customFrom = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("from") || "") ? url.searchParams.get("from") : null;
    const customTo = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("to") || "") ? url.searchParams.get("to") : null;
    const where = customFrom && customTo
      ? "date(o.created_at,'+8 hours') BETWEEN date(?) AND date(?)"
      : period === "yesterday"
        ? "date(o.created_at,'+8 hours')=date('now','+8 hours','-1 day')"
        : days > 0 ? `date(o.created_at,'+8 hours')>=date('now','+8 hours','-${days - 1} days')` : "date(o.created_at,'+8 hours')=date('now','+8 hours')";
    const bind = (statement) => customFrom && customTo ? statement.bind(merchantId, customFrom, customTo) : statement.bind(merchantId);
    const active = "o.status<>'cancelled' AND o.demo_reset_at IS NULL";
    const [kpis, daily, hourly, products, sources, payments, types, members] = await Promise.all([
      bind(db.prepare(`SELECT COALESCE(SUM(o.total_minor),0) revenue_minor,COUNT(*) orders,COALESCE(AVG(o.total_minor),0) average_order_minor,SUM(CASE WHEN o.status IN('submitted','accepted','preparing','ready') THEN 1 ELSE 0 END) pending FROM merchant_food_orders o WHERE o.merchant_id=? AND ${active} AND ${where}`)).first(),
      bind(db.prepare(`SELECT date(o.created_at,'+8 hours') label,SUM(o.total_minor) value_minor,COUNT(*) count FROM merchant_food_orders o WHERE o.merchant_id=? AND ${active} AND ${where} GROUP BY label ORDER BY label`)).all(),
      bind(db.prepare(`SELECT strftime('%H:00',o.created_at,'+8 hours') label,SUM(o.total_minor) value_minor,COUNT(*) count FROM merchant_food_orders o WHERE o.merchant_id=? AND ${active} AND ${where} GROUP BY label ORDER BY label`)).all(),
      bind(db.prepare(`SELECT i.name_snapshot label,SUM(i.quantity) quantity,SUM(i.line_total_minor) value_minor FROM merchant_food_orders o JOIN merchant_food_order_items i ON i.order_id=o.id WHERE o.merchant_id=? AND ${active} AND ${where} GROUP BY i.name_snapshot ORDER BY quantity DESC,value_minor DESC LIMIT 10`)).all(),
      bind(db.prepare(`SELECT COALESCE(f.source,'QR') label,COUNT(*) count,SUM(o.total_minor) value_minor FROM merchant_food_orders o LEFT JOIN merchant_order_fulfillment f ON f.merchant_id=o.merchant_id AND f.order_id=o.id WHERE o.merchant_id=? AND ${active} AND ${where} GROUP BY label ORDER BY count DESC`)).all(),
      bind(db.prepare(`SELECT COALESCE(o.payment_method_v1,o.payment_method,'counter') label,COUNT(*) count,SUM(o.total_minor) value_minor FROM merchant_food_orders o WHERE o.merchant_id=? AND ${active} AND ${where} GROUP BY label ORDER BY count DESC`)).all(),
      bind(db.prepare(`SELECT o.order_type label,COUNT(*) count,SUM(o.total_minor) value_minor FROM merchant_food_orders o WHERE o.merchant_id=? AND ${active} AND ${where} GROUP BY label ORDER BY count DESC`)).all(),
      bind(db.prepare(`SELECT COUNT(DISTINCT o.membership_id) active_members,SUM(CASE WHEN m.order_count=1 THEN 1 ELSE 0 END) new_members,SUM(CASE WHEN m.order_count>1 THEN 1 ELSE 0 END) repeat_members FROM merchant_food_orders o JOIN merchant_ordering_memberships m ON m.merchant_id=o.merchant_id AND m.id=o.membership_id WHERE o.merchant_id=? AND ${active} AND ${where}`)).first(),
    ]);
    return json({ period, from: customFrom, to: customTo, kpis: { revenue_minor: Number(kpis?.revenue_minor || 0), orders: Number(kpis?.orders || 0), average_order_minor: Math.round(Number(kpis?.average_order_minor || 0)), pending: Number(kpis?.pending || 0), new_members: Number(members?.new_members || 0), repeat_members: Number(members?.repeat_members || 0) }, daily: daily.results || [], hourly: hourly.results || [], products: (products.results || []).map(({ label, value_minor, ...row }) => ({ ...row, name: label, revenue_minor: value_minor })), sources: sources.results || [], payments: payments.results || [], order_types: types.results || [] }, 200, cors);
  }

  if (url.pathname === "/api/merchant-admin/operations/promotions" && request.method === "GET") {
    const rows = await db.prepare("SELECT id,name,campaign_type,enabled,production_ready,discount_type,discount_value_minor,minimum_spend_minor,valid_days,starts_at,ends_at,terms_version FROM merchant_coupon_campaigns WHERE merchant_id=? ORDER BY datetime(created_at) DESC").bind(merchantId).all();
    const promotions = (rows.results || []).map((row) => ({ ...row, enabled: Boolean(row.enabled), production_ready: Boolean(row.production_ready) }));
    return json({ promotions, campaigns: promotions, supported_types: ["fixed_amount"], future_types: ["percentage","threshold","quantity","buy_n_get_m","takeaway","free_delivery"] }, 200, cors);
  }

  const memberDetail = url.pathname.match(/^\/api\/merchant-admin\/members\/([^/]+)$/);
  if (memberDetail && request.method === "GET") {
    const member = await db.prepare(`SELECT m.id,m.membership_no,m.status,m.visit_count,m.order_count,m.last_seen_at,m.created_at,c.display_name,c.phone_normalized FROM merchant_ordering_memberships m JOIN ordering_customers c ON c.id=m.customer_id WHERE m.merchant_id=? AND m.id=?`).bind(merchantId, memberDetail[1]).first();
    if (!member) return json({ error: "找不到此會員。" }, 404, cors);
    const [orders, coupons] = await Promise.all([
      db.prepare("SELECT order_code,status,payment_status,total_minor,created_at FROM merchant_food_orders WHERE merchant_id=? AND membership_id=? AND demo_reset_at IS NULL ORDER BY datetime(created_at) DESC LIMIT 100").bind(merchantId, member.id).all(),
      db.prepare(`SELECT c.id,c.status,c.issued_at,c.expires_at,p.name campaign_name,p.discount_value_minor FROM merchant_member_coupons c JOIN merchant_coupon_campaigns p ON p.id=c.campaign_id WHERE c.merchant_id=? AND c.membership_id=? ORDER BY datetime(c.issued_at) DESC`).bind(merchantId, member.id).all(),
    ]);
    return json({ member: { ...member, phone_masked: mask(member.phone_normalized), phone_normalized: undefined }, orders: orders.results || [], coupons: coupons.results || [], tags: [], notes: [], totals: { lifetime_spend_minor: (orders.results || []).filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + Number(order.total_minor || 0), 0) } }, 200, cors);
  }

  if (url.pathname === "/api/merchant-admin/operations/staff" && request.method === "GET") {
    const rows = await db.prepare(`SELECT u.id,u.display_name,u.status,GROUP_CONCAT(DISTINCT r.code) roles,GROUP_CONCAT(DISTINCT rp.permission_code) permissions FROM merchant_users u LEFT JOIN merchant_user_roles ur ON ur.merchant_id=u.merchant_id AND ur.user_id=u.id LEFT JOIN merchant_roles r ON r.id=ur.role_id LEFT JOIN merchant_role_permissions rp ON rp.role_id=r.id WHERE u.merchant_id=? GROUP BY u.id ORDER BY u.display_name`).bind(merchantId).all();
    return json({ staff: rows.results || [], role_catalog: ["OWNER","MANAGER","CASHIER","KITCHEN","STAFF"] }, 200, cors);
  }

  if (url.pathname === "/api/merchant-admin/operations/integrations" && request.method === "GET") {
    const [line, payments, deliveries, printers] = await Promise.all([
      db.prepare("SELECT enabled,basic_id,display_name,add_friend_url,integration_mode FROM merchant_line_integrations WHERE merchant_id=?").bind(merchantId).first(),
      db.prepare("SELECT provider,mode,enabled,production_ready,provider_status,display_name FROM merchant_payment_integrations WHERE merchant_id=?").bind(merchantId).all(),
      db.prepare("SELECT provider,display_name,enabled,production_ready,verified_status FROM merchant_delivery_links WHERE merchant_id=?").bind(merchantId).all(),
      db.prepare("SELECT id,name,model,enabled,last_seen_at FROM printers WHERE merchant_id=?").bind(merchantId).all(),
    ]);
    return json({ line: line ? { ...line, connected: Boolean(line.enabled) } : null, payments: payments.results || [], deliveries: deliveries.results || [], printers: printers.results || [], invoice: { status: "not_enabled", provider_ready: false }, google: { status: "needs_configuration" }, external: [{ provider: "uber_eats", status: "not_connected" }, { provider: "foodpanda", status: "not_connected" }], secrets_exposed: false }, 200, cors);
  }
  return null;
}
