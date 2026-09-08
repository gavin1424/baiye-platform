import { paymentReadiness } from "./commerce-ai-contract.js";
import { merchantPlanEntitlements } from "./merchant-plan-catalog.js";
import { isProductionDemoMerchant as isStagingDemoMerchant } from "./demo-merchant.js";

const PERMISSIONS = Object.freeze([
  "merchant.profile.read","merchant.content.read",
  "merchant.products.read","merchant.bookings.read","merchant.bookings.write",
  "merchant.members.read","merchant.orders.read","merchant.orders.write","merchant.google_booking.read",
  "merchant.google_booking.apply","merchant.line.read","merchant.contract.read","merchant.contract.download",
  "merchant.settings.read","merchant.settings.write",
]);

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", ...headers } });
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const maskedPhone = (phone) => phone ? `${phone.slice(0,2)}** *** ${phone.slice(-3)}` : null;
const safeJson = (value) => JSON.stringify(value ?? null);

async function lifecycle(db, merchantId, env) {
  const [onboarding, signature] = await Promise.all([
    db.prepare("SELECT state,operation_locked,commercial_terms_id,contract_signed_at FROM merchant_onboarding_states WHERE merchant_id=?").bind(merchantId).first(),
    db.prepare("SELECT id,public_id,contract_version_id,signed_at FROM merchant_contract_signatures WHERE merchant_id=? AND status='VALID' ORDER BY signed_at DESC LIMIT 1").bind(merchantId).first(),
  ]);
  const demoEnvironment = await isStagingDemoMerchant(env, merchantId);
  const active = demoEnvironment || (Boolean(signature) && onboarding && Number(onboarding.operation_locked) === 0 && onboarding.state === "active");
  return { active, demoEnvironment, administrator_status: active ? "ACTIVE" : "PENDING_ACTIVATION", account_status: demoEnvironment ? "試用環境已啟用" : active ? "已啟用" : signature ? "待啟用" : "待簽約", onboarding, signature };
}

async function requireActive(db, merchantId, env) {
  const state = await lifecycle(db, merchantId, env);
  return state.active ? null : json({ code: "MERCHANT_ACTIVATION_REQUIRED", error: "完成商家契約與啟用流程後，才能使用管理者營運功能。", administrator_status: state.administrator_status }, 423);
}

async function audit(db, session, action, resourceType, resourceId, before, after) {
  await db.prepare(`INSERT INTO merchant_admin_audit_logs(id,actor_member_id,merchant_id,role,action,resource_type,resource_id,before_json,after_json)
    VALUES(?,?,?,?,?,?,?,?,?)`).bind(uid("maudit"), session.platform_member_id || null, session.merchant_id, "merchant_owner", action, resourceType, resourceId || null, safeJson(before), safeJson(after)).run();
}

function rejectForeignMerchant(input, merchantId) {
  return input && Object.hasOwn(input, "merchant_id") && String(input.merchant_id) !== merchantId;
}

export async function handleMerchantAdmin(request, env, url, cors, authorization) {
  const db = env.FINANCE_DB, session = authorization.session, merchantId = session.merchant_id;
  if (!db) return json({ error: "商家管理服務暫時無法使用。" }, 503, cors);

  if (url.pathname === "/api/merchant-admin/dashboard" && request.method === "GET") {
    const [state, profile, terms, counts, entitlements, payment, membership] = await Promise.all([
      lifecycle(db, merchantId, env),
      db.prepare("SELECT * FROM merchant_admin_profiles WHERE merchant_id=?").bind(merchantId).first(),
      db.prepare(`SELECT t.plan_code,t.plan_name,t.discount_price_minor,t.contract_term_months,t.payment_plan
        FROM merchant_contract_commercial_terms t JOIN merchant_onboarding_states o ON o.commercial_terms_id=t.id WHERE o.merchant_id=?`).bind(merchantId).first(),
      db.prepare(`SELECT
        (SELECT COUNT(*) FROM merchant_menu_items WHERE merchant_id=? AND status<>'archived') products,
        (SELECT COUNT(*) FROM merchant_bookings WHERE merchant_id=?) bookings,
        (SELECT COUNT(*) FROM merchant_ordering_memberships WHERE merchant_id=? AND status='active') members,
        (SELECT COUNT(*) FROM merchant_food_orders WHERE merchant_id=?) orders`).bind(merchantId, merchantId, merchantId, merchantId).first(),
      isStagingDemoMerchant(env, merchantId).then((demo) => demo ? { plan_id: "demo_beef_noodle_full_trial", merchant_content_editable: true, merchant_product_editable: true, merchant_product_edit: true, commerce_full: true, cart: true, cart_enabled: true, softpos_enabled: true, ordering_enabled: true, kds_enabled: true, base_product_limit: 0 } : merchantPlanEntitlements(db, merchantId)),
      paymentReadiness(db, merchantId),
      db.prepare(`SELECT p.id platform_member_id,m.id relationship_id,m.status relationship_status
        FROM platform_members p JOIN merchant_ordering_memberships m ON m.customer_id=p.customer_id AND m.merchant_id=?
        WHERE p.id=?`).bind(merchantId, session.platform_member_id || "").first(),
    ]);
    const plan = state.demoEnvironment ? { plan_code: "demo_beef_noodle_full_trial", plan_name: "百工牛肉麵完整商家試用", discount_price_minor: 0, contract_term_months: 0 } : terms || { plan_code: "baiye_standard_18000_addons", plan_name: "NT$18,000 標準方案", discount_price_minor: 1800000, contract_term_months: 24 };
    return json({ merchant: { id: merchantId, name: profile?.brand_name || session.merchant_name, status: session.merchant_status }, administrator: { display_role: "管理者", internal_role: "merchant_owner", phone_masked: maskedPhone(session.phone_normalized), status: state.administrator_status }, membership: { platform_member: Boolean(session.platform_member_id), merchant_relationship: membership?.relationship_status === "active", platform_member_id: session.platform_member_id || null, relationship_id: membership?.relationship_id || null }, account_status: state.account_status, contract: { status: state.demoEnvironment ? "demo_exempt" : state.signature ? "signed" : "contract_required", signature: state.signature }, plan: { ...plan, code: plan.plan_code, merchant_content_editable: entitlements?.merchant_content_editable === true, base_product_limit: plan.plan_code === "baiye_standard_18000_addons" ? 20 : null }, entitlements, payment_readiness: payment, profile, counts, permissions: PERMISSIONS, operation_locked: !state.active, demo_environment: state.demoEnvironment, demo_badge: state.demoEnvironment ? "Demo 試用環境" : null }, 200, cors);
  }

  if (url.pathname === "/api/merchant-admin/commerce" && request.method === "GET") {
    const [entitlements, payment] = await Promise.all([merchantPlanEntitlements(db, merchantId), paymentReadiness(db, merchantId)]);
    return json({ entitlements, payment_readiness: payment, paid: false, payment_state_source: "provider_readiness_only" }, 200, cors);
  }

  if (url.pathname === "/api/merchant-admin/account" && request.method === "GET") {
    const state = await lifecycle(db, merchantId, env);
    const [sessions, profile, relationship] = await Promise.all([
      db.prepare("SELECT id,issued_via,assurance_level,last_seen_at,created_at,expires_at FROM merchant_user_sessions WHERE merchant_id=? AND user_id=? AND revoked_at IS NULL AND datetime(expires_at)>datetime('now') ORDER BY datetime(last_seen_at) DESC").bind(merchantId, session.user_id).all(),
      db.prepare("SELECT brand_name FROM merchant_admin_profiles WHERE merchant_id=?").bind(merchantId).first(),
      db.prepare("SELECT m.id,m.status FROM merchant_ordering_memberships m JOIN platform_members p ON p.customer_id=m.customer_id WHERE m.merchant_id=? AND p.id=?").bind(merchantId, session.platform_member_id || "").first(),
    ]);
    return json({ display_role: "管理者", internal_role: "merchant_owner", phone_masked: maskedPhone(session.phone_normalized), platform_member: { established: Boolean(session.platform_member_id), id: session.platform_member_id || null }, merchant_membership: { joined: relationship?.status === "active", id: relationship?.id || null }, merchant: { id: merchantId, name: profile?.brand_name || session.merchant_name }, status: state.administrator_status, sessions: sessions.results || [], demo_environment: state.demoEnvironment }, 200, cors);
  }

  if (url.pathname === "/api/merchant-admin/logout-all" && request.method === "POST") {
    await db.prepare("UPDATE merchant_user_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND user_id=? AND revoked_at IS NULL").bind(merchantId, session.user_id).run();
    await audit(db, session, "merchant.sessions_revoked", "session", null, null, { all_devices: true });
    return json({ ok: true }, 200, { ...cors, "set-cookie": "baiye_merchant_session=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0" });
  }

  if (url.pathname === "/api/merchant-admin/profile" && request.method === "GET") {
    const [row, entitlements] = await Promise.all([
      db.prepare(`SELECT m.id,m.name,m.contact_name,m.phone,m.email,m.status,p.* FROM merchants m LEFT JOIN merchant_admin_profiles p ON p.merchant_id=m.id WHERE m.id=?`).bind(merchantId).first(),
      isStagingDemoMerchant(env, merchantId).then((demo) => demo ? { merchant_content_editable: true, merchant_product_editable: true, merchant_product_edit: true } : merchantPlanEntitlements(db, merchantId)),
    ]);
    return json({ profile: row, entitlements, legal_fields_locked: Boolean((await lifecycle(db, merchantId, env)).signature), demo_environment: await isStagingDemoMerchant(env, merchantId) }, 200, cors);
  }

  if (url.pathname === "/api/merchant-admin/profile" && request.method === "PATCH") {
    const entitlements = await isStagingDemoMerchant(env, merchantId) ? { merchant_content_editable: true } : await merchantPlanEntitlements(db, merchantId);
    if (!entitlements.merchant_content_editable) return json({ code: "MERCHANT_CONTENT_EDIT_DISABLED", error: "NT$18,000 標準方案由百工協助修改網站與商品內容，請使用「申請內容修改」。", merchant_content_editable: false }, 403, cors);
    const gate = await requireActive(db, merchantId, env); if (gate) return new Response(gate.body, { status: gate.status, headers: { ...Object.fromEntries(gate.headers), ...cors } });
    const input = await request.json().catch(() => ({}));
    if (rejectForeignMerchant(input, merchantId)) return json({ code: "MERCHANT_CROSS_ACCESS_DENIED", error: "無法存取其他商家資料。" }, 403, cors);
    if (["legal_name","tax_id","legal_representative","contract_signer"].some((key) => Object.hasOwn(input, key))) return json({ code: "LEGAL_PROFILE_CHANGE_REQUIRED", error: "法定資料須由百工管理員依正式變更流程處理。" }, 409, cors);
    const before = await db.prepare("SELECT * FROM merchant_admin_profiles WHERE merchant_id=?").bind(merchantId).first();
    const next = { brand_name: clean(input.brand_name ?? before?.brand_name,120), business_description: clean(input.business_description ?? before?.business_description,2000), support_phone: clean(input.support_phone ?? before?.support_phone,30), support_email: clean(input.support_email ?? before?.support_email,160), business_address: clean(input.business_address ?? before?.business_address,300), business_hours: clean(input.business_hours ?? before?.business_hours,1000), transportation_info: clean(input.transportation_info ?? before?.transportation_info,1000), social_links_json: safeJson(input.social_links ?? JSON.parse(before?.social_links_json || "{}")), homepage_notice: clean(input.homepage_notice ?? before?.homepage_notice,500) };
    await db.prepare(`INSERT INTO merchant_admin_profiles(merchant_id,brand_name,business_description,support_phone,support_email,business_address,business_hours,transportation_info,social_links_json,homepage_notice)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(merchant_id) DO UPDATE SET brand_name=excluded.brand_name,business_description=excluded.business_description,support_phone=excluded.support_phone,support_email=excluded.support_email,business_address=excluded.business_address,business_hours=excluded.business_hours,transportation_info=excluded.transportation_info,social_links_json=excluded.social_links_json,homepage_notice=excluded.homepage_notice,updated_at=CURRENT_TIMESTAMP`)
      .bind(merchantId,next.brand_name,next.business_description,next.support_phone,next.support_email,next.business_address,next.business_hours,next.transportation_info,next.social_links_json,next.homepage_notice).run();
    await audit(db, session, "merchant.profile.updated", "merchant_profile", merchantId, before, next);
    return json({ ok: true, profile: next }, 200, cors);
  }

  if (url.pathname === "/api/merchant-admin/members" && request.method === "GET") {
    const gate = await requireActive(db, merchantId, env); if (gate) return new Response(gate.body, { status: gate.status, headers: { ...Object.fromEntries(gate.headers), ...cors } });
    const rows = await db.prepare(`SELECT m.id,m.membership_no,m.status,m.visit_count,m.order_count,m.last_seen_at,c.display_name,c.phone_normalized,
      (SELECT COUNT(*) FROM merchant_bookings b WHERE b.merchant_id=m.merchant_id AND b.platform_member_id=p.id) booking_count
      FROM merchant_ordering_memberships m JOIN ordering_customers c ON c.id=m.customer_id LEFT JOIN platform_members p ON p.customer_id=c.id WHERE m.merchant_id=? ORDER BY datetime(m.last_seen_at) DESC LIMIT 300`).bind(merchantId).all();
    return json({ members: (rows.results || []).map(({ phone_normalized, ...row }) => ({ ...row, phone_masked: maskedPhone(phone_normalized) })) }, 200, cors);
  }

  if (url.pathname === "/api/merchant-admin/bookings" && request.method === "GET") {
    const gate = await requireActive(db, merchantId, env); if (gate) return new Response(gate.body, { status: gate.status, headers: { ...Object.fromEntries(gate.headers), ...cors } });
    const rows = await db.prepare(`SELECT b.id,b.booking_code,b.customer_name,b.customer_phone,b.start_at,b.end_at,b.status,b.booking_source,s.name service_name,st.display_name staff_name FROM merchant_bookings b JOIN merchant_booking_services s ON s.id=b.service_id AND s.merchant_id=b.merchant_id JOIN merchant_booking_staff st ON st.id=b.staff_id AND st.merchant_id=b.merchant_id WHERE b.merchant_id=? ORDER BY datetime(b.start_at) DESC LIMIT 300`).bind(merchantId).all();
    return json({ bookings: (rows.results || []).map(({ customer_phone, ...row }) => ({ ...row, phone_masked: maskedPhone(customer_phone) })) }, 200, cors);
  }

  const bookingMatch = url.pathname.match(/^\/api\/merchant-admin\/bookings\/([^/]+)$/);
  if (bookingMatch && request.method === "PATCH") {
    const gate = await requireActive(db, merchantId, env); if (gate) return new Response(gate.body, { status: gate.status, headers: { ...Object.fromEntries(gate.headers), ...cors } });
    const input = await request.json().catch(() => ({})); if (rejectForeignMerchant(input, merchantId)) return json({ code: "MERCHANT_CROSS_ACCESS_DENIED" }, 403, cors);
    const current = await db.prepare("SELECT id,status,start_at,end_at FROM merchant_bookings WHERE merchant_id=? AND id=?").bind(merchantId, bookingMatch[1]).first(); if (!current) return json({ error: "找不到此預約。" }, 404, cors);
    const status = clean(input.status,30); if (!["pending","confirmed","completed","cancelled","no_show"].includes(status)) return json({ error: "預約狀態不正確。" }, 422, cors);
    if (status === "cancelled" && input.confirm !== true) return json({ code: "CONFIRMATION_REQUIRED", error: "取消預約前必須再次確認。" }, 409, cors);
    await db.prepare("UPDATE merchant_bookings SET status=?,cancelled_at=CASE WHEN ?='cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND id=?").bind(status,status,merchantId,current.id).run();
    await audit(db, session, "merchant.booking.updated", "booking", current.id, current, { ...current, status }); return json({ ok: true }, 200, cors);
  }

  if (url.pathname === "/api/merchant-admin/line" && request.method === "GET") {
    const gate = await requireActive(db, merchantId, env); if (gate) return new Response(gate.body, { status: gate.status, headers: { ...Object.fromEntries(gate.headers), ...cors } });
    const row = await db.prepare("SELECT enabled,basic_id,display_name,add_friend_url,integration_mode,created_at,updated_at FROM merchant_line_integrations WHERE merchant_id=?").bind(merchantId).first().catch(() => null);
    return json({ integration: row || null, secrets_exposed: false }, 200, cors);
  }

  if (url.pathname === "/api/merchant-admin/pricing" && request.method === "GET") {
    const rows = await db.prepare("SELECT code,label,amount_minor,currency FROM platform_pricing_config WHERE enabled=1 ORDER BY amount_minor").all(); return json({ items: rows.results || [] }, 200, cors);
  }

  if (url.pathname === "/api/merchant-admin/audit" && request.method === "GET") {
    const rows = await db.prepare("SELECT id,role,action,resource_type,resource_id,before_json,after_json,created_at FROM merchant_admin_audit_logs WHERE merchant_id=? ORDER BY datetime(created_at) DESC LIMIT 100").bind(merchantId).all(); return json({ items: rows.results || [] }, 200, cors);
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
