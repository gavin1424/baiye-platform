import { couponOrderStateStatements, issueWelcomeCoupon, prepareCouponForOrder } from "./member-integrations.js";
import { authenticatePlatformMember, ensurePlatformMember, normalizeTaiwanMobile } from "./platform-membership.js";
export { normalizeTaiwanMobile } from "./platform-membership.js";

const E = new TextEncoder();
const SESSION_DAYS = 180;
const MAX_ORDER_LINES = 50;
const MAX_ITEM_QUANTITY = 20;
const CUSTOMER_ERROR = "掃碼會員與點餐系統目前暫時忙碌，請稍後再試或洽店家協助。";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=UTF-8",
    "cache-control": "no-store",
    ...headers,
  },
});
const uid = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const clean = (value, max = 200) => String(value ?? "").trim().slice(0, max);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const hash = async (value) => b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", E.encode(String(value)))));

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

function randomCode(length = 20) {
  const bytes = new Uint8Array(Math.ceil(length * 0.75) + 2);
  crypto.getRandomValues(bytes);
  return b64url(bytes).replace(/[^A-Za-z0-9_-]/g, "").slice(0, length);
}

function membershipNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `MBR-${date}-${randomCode(8).toUpperCase()}`;
}

function orderCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `BY-${date}-${randomCode(8).toUpperCase()}`;
}

function bearer(request) {
  return clean(request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), 300);
}

function validMerchantId(value) {
  const id = clean(value, 100);
  return /^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$/.test(id) ? id : "";
}

function maskPhone(phone) {
  return /^09\d{8}$/.test(phone) ? `${phone.slice(0, 4)}***${phone.slice(-3)}` : "";
}

function validEmail(value) {
  const email = clean(value, 160);
  if (!email) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function validImageUrl(value) {
  const url = clean(value, 600);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function publicContext(row) {
  const purpose = row.purpose;
  return {
    merchant_id: row.merchant_id,
    display_name: row.display_name,
    enabled: Boolean(row.enabled),
    currency: row.currency,
    dine_in_enabled: Boolean(row.dine_in_enabled),
    takeaway_enabled: Boolean(row.takeaway_enabled),
    require_member: Boolean(row.require_member),
    consent_version: row.consent_version,
    ordering_open: Boolean(row.ordering_open ?? 1),
    accepting_orders: Boolean(row.accepting_orders),
    temporary_closed_message: row.temporary_closed_message || "店家目前暫停接單",
    estimated_prep_minutes: Number(row.estimated_prep_minutes || 20),
    show_sold_out_items: Boolean(row.show_sold_out_items ?? 1),
    customer_cancel_before_accept: Boolean(row.customer_cancel_before_accept ?? 1),
    qr: {
      id: row.id,
      code: row.code,
      label: row.label,
      purpose,
      table_label: row.table_label || "",
    },
    ordering_allowed: Boolean(row.enabled) && Boolean(row.ordering_open ?? 1) && purpose !== "member_only",
  };
}

function publicMember(row) {
  return {
    membership_id: row.membership_id,
    membership_no: row.membership_no,
    display_name: row.display_name,
    phone_masked: maskPhone(row.phone_normalized),
  };
}

function publicOrder(row, items = []) {
  return {
    order_code: row.order_code,
    merchant_id: row.merchant_id,
    table_label: row.table_label || "",
    order_type: row.order_type,
    status: row.status,
    payment_status: row.payment_status,
    payment_method: row.payment_method_v1 || row.payment_method,
    payment_reference: row.payment_reference || "",
    dining_session_id: row.dining_session_id || "",
    cancel_reason: row.cancel_reason || "",
    subtotal_minor: Number(row.subtotal_minor),
    total_minor: Number(row.total_minor),
    customer_note: row.customer_note || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
    items: items.map((item) => ({
      name: item.name_snapshot,
      unit_price_minor: Number(item.unit_price_minor),
      quantity: Number(item.quantity),
      line_total_minor: Number(item.line_total_minor),
      note: item.note || "",
      options: item.options || [],
    })),
  };
}

async function qrContext(db, code) {
  return db.prepare(`
    SELECT q.*,s.display_name,s.enabled,s.currency,s.dine_in_enabled,s.takeaway_enabled,
           s.require_member,s.consent_version,s.ordering_open,s.accepting_orders,
           s.temporary_closed_message,s.estimated_prep_minutes,s.show_sold_out_items,
           s.customer_cancel_before_accept,s.table_session_enabled,s.max_items_per_order,
           s.auto_accept_orders,s.last_order_time,s.timezone,s.order_number_prefix
    FROM merchant_ordering_qr_codes q
    JOIN merchant_ordering_settings s ON s.merchant_id=q.merchant_id
    WHERE q.code=? AND q.active=1
      AND (q.expires_at IS NULL OR datetime(q.expires_at)>datetime('now'))
    LIMIT 1
  `).bind(clean(code, 64)).first();
}

async function memberSession(db, request, merchantId) {
  const token = bearer(request);
  if (!token) return null;
  const tokenHash = await hash(token);
  const row = await db.prepare(`
    SELECT s.id session_id,s.membership_id,m.membership_no,m.status membership_status,
           c.id customer_id,c.display_name,c.phone_normalized
    FROM merchant_member_sessions s
    JOIN merchant_ordering_memberships m ON m.merchant_id=s.merchant_id AND m.id=s.membership_id
    JOIN ordering_customers c ON c.id=m.customer_id
    WHERE s.token_hash=? AND s.merchant_id=? AND s.revoked_at IS NULL
      AND datetime(s.expires_at)>datetime('now') AND m.status='active'
    LIMIT 1
  `).bind(tokenHash, merchantId).first();
  if (!row) return null;
  await db.batch([
    db.prepare(`UPDATE merchant_member_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?`).bind(row.session_id),
    db.prepare(`UPDATE merchant_ordering_memberships SET last_seen_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(row.membership_id),
  ]);
  return row;
}

async function audit(db, merchantId, actorType, actorId, action, resourceType, resourceId, metadata = {}) {
  await db.prepare(`
    INSERT INTO merchant_ordering_audit_logs
      (id,merchant_id,actor_type,actor_id,action,resource_type,resource_id,metadata)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(
    uid("ordaudit"), merchantId, actorType, actorId || null, action,
    resourceType, resourceId || null, JSON.stringify(metadata),
  ).run();
}

async function issueSession(db, merchantId, membershipId) {
  const rawToken = randomToken(32);
  const tokenHash = await hash(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await db.batch([
    db.prepare(`DELETE FROM merchant_member_sessions WHERE membership_id=? AND (revoked_at IS NOT NULL OR datetime(expires_at)<=datetime('now'))`).bind(membershipId),
    db.prepare(`UPDATE merchant_member_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE membership_id=? AND revoked_at IS NULL AND id NOT IN (SELECT id FROM merchant_member_sessions WHERE membership_id=? AND revoked_at IS NULL ORDER BY datetime(created_at) DESC LIMIT 4)`).bind(membershipId, membershipId),
    db.prepare(`INSERT INTO merchant_member_sessions (id,merchant_id,membership_id,token_hash,expires_at) VALUES (?,?,?,?,?)`).bind(uid("membersession"), merchantId, membershipId, tokenHash, expiresAt),
  ]);
  return { token: rawToken, expires_at: expiresAt };
}

async function orderWithItems(db, merchantId, membershipId, orderCodeValue) {
  const row = await db.prepare(`
    SELECT * FROM merchant_food_orders
    WHERE merchant_id=? AND membership_id=? AND order_code=?
    LIMIT 1
  `).bind(merchantId, membershipId, clean(orderCodeValue, 40)).first();
  if (!row) return null;
  const items = await db.prepare(`
    SELECT id,name_snapshot,unit_price_minor,quantity,line_total_minor,note,
           COALESCE(base_price_minor,unit_price_minor) base_price_minor,
           COALESCE(option_delta_minor,0) option_delta_minor
    FROM merchant_food_order_items WHERE order_id=? ORDER BY created_at,id
  `).bind(row.id).all();
  const optionRows = await db.prepare(`
    SELECT order_item_id,group_name_snapshot,value_name_snapshot,price_delta_minor
    FROM merchant_food_order_item_options WHERE merchant_id=? AND order_id=? ORDER BY created_at,id
  `).bind(merchantId, row.id).all();
  const optionsByItem = new Map();
  for (const option of optionRows.results || []) {
    if (!optionsByItem.has(option.order_item_id)) optionsByItem.set(option.order_item_id, []);
    optionsByItem.get(option.order_item_id).push({ group_name: option.group_name_snapshot, value_name: option.value_name_snapshot, price_delta_minor: Number(option.price_delta_minor) });
  }
  const itemRows = (items.results || []).map((item) => ({ ...item, options: optionsByItem.get(item.id) || [] }));
  const pricing = await db.prepare(`SELECT gross_subtotal_minor,coupon_discount_minor,payable_total_minor,coupon_id FROM merchant_order_pricing WHERE order_id=?`).bind(row.id).first();
  return { ...publicOrder(row, itemRows), pricing: pricing || { gross_subtotal_minor: Number(row.subtotal_minor), coupon_discount_minor: 0, payable_total_minor: Number(row.total_minor), coupon_id: null } };
}

async function publicRateLimit(db, request, merchantId, scope, limit = 30) {
  const bucket = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  const key = await hash(`${request.headers.get("cf-connecting-ip") || "unknown"}:${request.headers.get("user-agent") || "unknown"}`);
  await db.prepare("INSERT OR IGNORE INTO ordering_rate_limits(merchant_id,scope,rate_key_hash,bucket_start) VALUES(?,?,?,?)").bind(merchantId, scope, key, bucket).run();
  const result = await db.prepare("UPDATE ordering_rate_limits SET request_count=request_count+1,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND scope=? AND rate_key_hash=? AND bucket_start=? AND request_count<?").bind(merchantId, scope, key, bucket, limit).run();
  return Boolean(result.meta?.changes);
}

export function calculateOrderLines(requestItems, catalogItems, optionGroups = [], optionValues = [], itemGroupLinks = []) {
  if (!Array.isArray(requestItems) || requestItems.length < 1 || requestItems.length > MAX_ORDER_LINES) {
    return { ok: false, error: "請選擇至少一項餐點，單筆訂單最多 50 個品項。" };
  }
  const quantities = new Map();
  const requests = new Map();
  for (const input of requestItems) {
    const itemId = clean(input?.item_id, 120);
    const quantity = Number(input?.quantity);
    if (!itemId || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      return { ok: false, error: "餐點數量格式不正確，每個品項最多 20 份。" };
    }
    const next = Number(quantities.get(itemId) || 0) + quantity;
    if (next > MAX_ITEM_QUANTITY) return { ok: false, error: "同一品項最多 20 份。" };
    quantities.set(itemId, next);
    requests.set(itemId, { note: clean(input?.note, 200), option_ids: Array.isArray(input?.option_value_ids) ? input.option_value_ids.map((value) => clean(value, 120)).filter(Boolean) : [] });
  }
  const catalog = new Map((catalogItems || []).map((item) => [String(item.id), item]));
  if (catalog.size !== quantities.size) return { ok: false, error: "部分餐點已下架或暫停供應，請重新確認。" };
  let subtotal = 0;
  const lines = [];
  const groupMap = new Map((optionGroups || []).map((group) => [String(group.id), group]));
  const valueMap = new Map((optionValues || []).map((value) => [String(value.id), value]));
  const linksByItem = new Map();
  for (const link of itemGroupLinks || []) {
    if (!linksByItem.has(String(link.menu_item_id))) linksByItem.set(String(link.menu_item_id), []);
    linksByItem.get(String(link.menu_item_id)).push(String(link.option_group_id));
  }
  for (const [itemId, quantity] of quantities) {
    const item = catalog.get(itemId);
    const price = Number(item?.price_minor);
    if (!item || !Number.isSafeInteger(price) || price < 0) return { ok: false, error: "餐點價格資料異常。" };
    const requested = requests.get(itemId) || { note: "", option_ids: [] };
    if (item.allow_customer_note === 0 && requested.note) return { ok: false, error: `${item.name} 不接受品項備註。` };
    const linkedGroups = linksByItem.get(itemId) || [];
    const selectedValues = requested.option_ids.map((valueId) => valueMap.get(valueId)).filter(Boolean);
    if (selectedValues.length !== requested.option_ids.length) return { ok: false, error: "部分加料選項已停用，請重新確認。" };
    const selectionsByGroup = new Map();
    for (const value of selectedValues) {
      if (!linkedGroups.includes(String(value.group_id)) || Number(value.active) !== 1) return { ok: false, error: "所選加料不適用此品項。" };
      if (!selectionsByGroup.has(String(value.group_id))) selectionsByGroup.set(String(value.group_id), []);
      selectionsByGroup.get(String(value.group_id)).push(value);
    }
    for (const groupId of linkedGroups) {
      const group = groupMap.get(groupId);
      if (!group || Number(group.active) !== 1) continue;
      const count = (selectionsByGroup.get(groupId) || []).length;
      if (count < Number(group.min_select) || count > Number(group.max_select)) return { ok: false, error: `${group.name} 需選擇 ${group.min_select}～${group.max_select} 項。` };
    }
    const options = selectedValues.map((value) => ({ option_group_id: String(value.group_id), option_value_id: String(value.id), group_name_snapshot: String(groupMap.get(String(value.group_id))?.name || "選項"), value_name_snapshot: String(value.name), price_delta_minor: Number(value.price_delta_minor) }));
    const optionDelta = options.reduce((sum, option) => sum + option.price_delta_minor, 0);
    const unitTotal = price + optionDelta;
    const lineTotal = unitTotal * quantity;
    subtotal += lineTotal;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(subtotal)) return { ok: false, error: "訂單金額超出系統處理範圍。" };
    lines.push({
      menu_item_id: itemId,
      name_snapshot: String(item.name),
      base_price_minor: price,
      option_delta_minor: optionDelta,
      unit_price_minor: unitTotal,
      unit_total_minor: unitTotal,
      quantity,
      line_total_minor: lineTotal,
      note: requested.note || null,
      options,
    });
  }
  return { ok: true, lines, subtotal_minor: subtotal, total_minor: subtotal };
}

export function canTransitionOrderStatus(current, next) {
  if (current === next) return true;
  const transitions = {
    submitted: ["accepted", "cancelled"],
    accepted: ["preparing", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready: ["served", "cancelled"],
    served: ["completed"],
    completed: [],
    cancelled: [],
  };
  return Array.isArray(transitions[current]) && transitions[current].includes(next);
}

function resolveOrderType(context, input) {
  if (context.purpose === "dine_in") return context.dine_in_enabled ? "dine_in" : "";
  if (context.purpose === "takeaway") return context.takeaway_enabled ? "takeaway" : "";
  const requested = input === "takeaway" ? "takeaway" : "dine_in";
  if (requested === "dine_in" && context.dine_in_enabled) return requested;
  if (requested === "takeaway" && context.takeaway_enabled) return requested;
  return "";
}

async function handleContext(request, db, context, cors) {
  const session = await memberSession(db, request, context.merchant_id);
  return json({ context: publicContext(context), member: session ? publicMember(session) : null }, 200, cors);
}

async function handleJoin(request, db, context, cors) {
  if (!context.enabled) return json({ error: "此商家的掃碼會員服務尚未開放。" }, 409, cors);
  if (!await publicRateLimit(db, request, context.merchant_id, "join", 12)) return json({ error: "操作過於頻繁，請稍後再試。" }, 429, cors);
  const input = await request.json();
  const phone = normalizeTaiwanMobile(input?.phone);
  if (!phone) return json({ error: "請輸入正確的台灣手機號碼。", code: "INVALID_PHONE" }, 400, cors);
  if (input?.privacy_consent !== true || clean(input?.consent_version, 60) !== context.consent_version) {
    return json({ error: "請閱讀並同意會員與隱私權說明後再加入。" }, 400, cors);
  }
  const existingCustomer = await db.prepare("SELECT id FROM ordering_customers WHERE phone_normalized=?").bind(phone).first();
  const existingPlatformMember = existingCustomer ? await db.prepare("SELECT id FROM platform_members WHERE customer_id=?").bind(existingCustomer.id).first() : null;
  let authenticatedMember = null;
  if (existingPlatformMember) {
    authenticatedMember = await authenticatePlatformMember(db, request);
    if (!authenticatedMember || authenticatedMember.id !== existingPlatformMember.id) {
      return json({ error: "此手機已建立會員，請先完成手機或 LINE 身分驗證。", code: "MEMBER_VERIFICATION_REQUIRED" }, 409, cors);
    }
  }
  const platform = await ensurePlatformMember(db, {
    phone,
    source: "qr",
    privacyConsentVersion: context.consent_version,
    deviceId: clean(input?.device_id || request.headers.get("x-device-id"), 300),
    issueSession: !authenticatedMember,
  });
  const customer = platform.customer;

  const previousMembership = await db.prepare(`SELECT m.id FROM merchant_ordering_memberships m JOIN ordering_customers c ON c.id=m.customer_id WHERE m.merchant_id=? AND c.phone_normalized=? LIMIT 1`).bind(context.merchant_id, phone).first();
  const membership = await db.prepare(`
    INSERT INTO merchant_ordering_memberships
      (id,merchant_id,customer_id,membership_no,status,joined_via_qr_id,consent_version,consented_at,visit_count,last_seen_at)
    VALUES (?,?,?,?, 'active',?,?,CURRENT_TIMESTAMP,1,CURRENT_TIMESTAMP)
    ON CONFLICT(merchant_id,customer_id) DO UPDATE SET
      status=CASE WHEN merchant_ordering_memberships.status='blocked' THEN 'blocked' ELSE 'active' END,
      joined_via_qr_id=excluded.joined_via_qr_id,
      consent_version=excluded.consent_version,
      consented_at=CURRENT_TIMESTAMP,
      visit_count=merchant_ordering_memberships.visit_count+1,
      last_seen_at=CURRENT_TIMESTAMP,
      updated_at=CURRENT_TIMESTAMP
    RETURNING id membership_id,membership_no,status
  `).bind(
    uid("membership"), context.merchant_id, customer.id, membershipNumber(), context.id, context.consent_version,
  ).first();

  if (!membership || membership.status === "blocked") {
    return json({ error: "此會員狀態目前無法使用，請洽店家協助。" }, 403, cors);
  }
  const session = await issueSession(db, context.merchant_id, membership.membership_id);
  const coupon = await issueWelcomeCoupon(db, { merchantId: context.merchant_id, membershipId: membership.membership_id, phoneVerified: Boolean(customer.phone_verified), newlyCreated: !previousMembership });
  await audit(db, context.merchant_id, "customer", membership.membership_id, "member_joined_or_returned", "membership", membership.membership_id, { qr_id: context.id });
  return json({
    message: "加入會員成功，現在可以開始點餐。",
    member: {
      membership_id: membership.membership_id,
      membership_no: membership.membership_no,
      display_name: customer.display_name || "會員",
      phone_masked: maskPhone(customer.phone_normalized),
    },
    session,
    coupon,
    platform_membership: platform.member,
    platform_session: platform.session,
    welcome: platform.welcome,
  }, 201, cors);
}

async function handleMenu(request, db, context, cors) {
  if (!context.enabled) return json({ error: "此商家的掃碼點餐尚未開放。" }, 409, cors);
  const session = await memberSession(db, request, context.merchant_id);
  if (context.require_member && !session) return json({ error: "請先加入會員或重新掃描 QR Code。", code: "MEMBER_REQUIRED" }, 401, cors);
  const [categories, items, groups, values, links] = await Promise.all([
    db.prepare(`SELECT id,name,description,sort_order FROM merchant_menu_categories WHERE merchant_id=? AND active=1 ORDER BY sort_order,name`).bind(context.merchant_id).all(),
    db.prepare(`SELECT id,category_id,sku,name,description,price_minor,image_url,sort_order,status,allow_customer_note,daily_limit,daily_sold_count,daily_sold_date FROM merchant_menu_items WHERE merchant_id=? AND status IN('active','sold_out') AND (status='active' OR ?=1) ORDER BY sort_order,name`).bind(context.merchant_id, Number(context.show_sold_out_items ?? 1)).all(),
    db.prepare(`SELECT id,name,selection_type,required,min_select,max_select,sort_order FROM merchant_menu_option_groups WHERE merchant_id=? AND active=1 AND archived_at IS NULL ORDER BY sort_order,name`).bind(context.merchant_id).all(),
    db.prepare(`SELECT id,group_id,name,price_delta_minor,sort_order FROM merchant_menu_option_values WHERE merchant_id=? AND active=1 AND archived_at IS NULL ORDER BY sort_order,name`).bind(context.merchant_id).all(),
    db.prepare(`SELECT menu_item_id,option_group_id,sort_order FROM merchant_menu_item_option_groups WHERE merchant_id=? ORDER BY sort_order`).bind(context.merchant_id).all(),
  ]);
  return json({
    context: publicContext(context),
    member: session ? publicMember(session) : null,
    categories: categories.results || [],
    items: (items.results || []).map((item) => ({ ...item, price_minor: Number(item.price_minor) })),
    option_groups: (groups.results || []).map((group) => ({
      ...group,
      required: Boolean(group.required),
      active: true,
    })),
    option_values: (values.results || []).map((value) => ({
      ...value,
      price_delta_minor: Number(value.price_delta_minor),
      active: true,
    })),
    item_option_groups: (links.results || []).map((row) => ({
      item_id: row.menu_item_id,
      group_id: row.option_group_id,
      sort_order: Number(row.sort_order || 0),
    })),
  }, 200, cors);
}

async function handleCreateOrder(request, db, context, cors) {
  if (!context.enabled || context.purpose === "member_only") return json({ error: "此 QR Code 目前不提供點餐。" }, 409, cors);
  if (!context.ordering_open || !context.accepting_orders) return json({ error: context.temporary_closed_message || "店家目前暫停接單", code: "ORDERING_PAUSED" }, 409, cors);
  if (context.last_order_time) {
    const taipeiTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
    if (taipeiTime > context.last_order_time) return json({ error: `今日最後接單時間為 ${context.last_order_time}，目前已停止接單。`, code: "LAST_ORDER_TIME_PASSED" }, 409, cors);
  }
  if (!await publicRateLimit(db, request, context.merchant_id, "create_order", 20)) return json({ error: "送單過於頻繁，請稍後再試。" }, 429, cors);
  const session = await memberSession(db, request, context.merchant_id);
  if (!session) return json({ error: "會員登入已失效，請重新掃描 QR Code 加入會員。", code: "MEMBER_REQUIRED" }, 401, cors);
  const input = await request.json();
  const orderType = resolveOrderType(context, input?.order_type);
  if (!orderType) return json({ error: "此商家目前未開放所選的用餐方式。" }, 409, cors);
  const tableLabel = orderType === "dine_in" ? clean(context.table_label || input?.table_label, 80) : null;
  if (orderType === "dine_in" && !tableLabel) return json({ error: "請輸入桌號後再送出訂單。" }, 400, cors);
  const idempotencyKey = clean(request.headers.get("idempotency-key") || input?.idempotency_key, 80);
  if (!/^[A-Za-z0-9._:-]{8,80}$/.test(idempotencyKey)) return json({ error: "訂單識別碼格式不正確，請重新送出。" }, 400, cors);

  const existing = await db.prepare(`SELECT order_code FROM merchant_food_orders WHERE merchant_id=? AND membership_id=? AND idempotency_key=? LIMIT 1`).bind(context.merchant_id, session.membership_id, idempotencyKey).first();
  if (existing) {
    const order = await orderWithItems(db, context.merchant_id, session.membership_id, existing.order_code);
    return json({ message: "訂單已建立。", order, replayed: true }, 200, cors);
  }

  const requestedIds = [...new Set((Array.isArray(input?.items) ? input.items : []).map((item) => clean(item?.item_id, 120)).filter(Boolean))];
  if (!requestedIds.length || requestedIds.length > Math.min(MAX_ORDER_LINES, Number(context.max_items_per_order || MAX_ORDER_LINES))) return json({ error: "請選擇至少一項餐點，或減少單筆訂單品項。" }, 400, cors);
  const placeholders = requestedIds.map(() => "?").join(",");
  const catalog = await db.prepare(`
    SELECT id,name,price_minor,status,allow_customer_note,daily_limit,daily_sold_count,daily_sold_date FROM merchant_menu_items
    WHERE merchant_id=? AND status='active' AND id IN (${placeholders})
  `).bind(context.merchant_id, ...requestedIds).all();
  const [groupRows, valueRows, linkRows] = await Promise.all([
    db.prepare(`SELECT id,name,selection_type,required,min_select,max_select,active FROM merchant_menu_option_groups WHERE merchant_id=? AND active=1 AND archived_at IS NULL`).bind(context.merchant_id).all(),
    db.prepare(`SELECT id,group_id,name,price_delta_minor,active FROM merchant_menu_option_values WHERE merchant_id=? AND active=1 AND archived_at IS NULL`).bind(context.merchant_id).all(),
    db.prepare(`SELECT menu_item_id,option_group_id FROM merchant_menu_item_option_groups WHERE merchant_id=? AND menu_item_id IN (${placeholders})`).bind(context.merchant_id, ...requestedIds).all(),
  ]);
  const calculation = calculateOrderLines(input.items, catalog.results || [], groupRows.results || [], valueRows.results || [], linkRows.results || []);
  if (!calculation.ok) return json({ error: calculation.error }, 409, cors);

  const orderId = uid("foodorder");
  const initialStatus = Number(context.auto_accept_orders) === 1 ? "accepted" : "submitted";
  const code = `${clean(context.order_number_prefix || "BY", 8).replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "BY"}-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${randomCode(6).toUpperCase()}`;
  let diningSessionId = null;
  if (orderType === "dine_in" && Number(context.table_session_enabled ?? 1) === 1) {
    const candidate = uid("dining");
    await db.prepare("INSERT OR IGNORE INTO merchant_dining_sessions(id,merchant_id,table_label,status,last_order_at) VALUES(?,?,?,'open',CURRENT_TIMESTAMP)").bind(candidate, context.merchant_id, tableLabel).run();
    const dining = await db.prepare("SELECT id FROM merchant_dining_sessions WHERE merchant_id=? AND table_label=? AND status='open' LIMIT 1").bind(context.merchant_id, tableLabel).first();
    diningSessionId = dining?.id || null;
  }
  let couponPricing;
  try {
    couponPricing = await prepareCouponForOrder(db, { merchantId: context.merchant_id, membershipId: session.membership_id, couponId: clean(input?.coupon_id, 120), gross: calculation.subtotal_minor, orderId, idempotencyKey });
  } catch (error) {
    const messages = { COUPON_NOT_AVAILABLE: "此禮券目前無法使用。", COUPON_MINIMUM_NOT_MET: "此訂單尚未達到禮券最低消費。", PHONE_VERIFICATION_REQUIRED: "請先完成手機驗證再使用禮券。" };
    return json({ error: messages[error instanceof Error ? error.message : ""] || "禮券驗證失敗。" }, 409, cors);
  }
  const statements = [
    db.prepare(`
      INSERT INTO merchant_food_orders
        (id,order_code,merchant_id,membership_id,qr_id,table_label,order_type,status,payment_status,payment_method,payment_method_v1,subtotal_minor,total_minor,customer_note,idempotency_key,dining_session_id)
      VALUES (?,?,?,?,?,?,?,?,'unpaid','counter','counter',?,?,?,?,?)
    `).bind(
      orderId, code, context.merchant_id, session.membership_id, context.id, tableLabel,
      orderType, initialStatus, calculation.subtotal_minor, calculation.total_minor, clean(input?.customer_note, 500) || null, idempotencyKey, diningSessionId,
    ),
    ...calculation.lines.map((line) => {
      line.order_item_id = uid("fooditem");
      return db.prepare(`
      INSERT INTO merchant_food_order_items
        (id,order_id,menu_item_id,name_snapshot,unit_price_minor,quantity,line_total_minor,note,base_price_minor,option_delta_minor,unit_total_minor)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).bind(line.order_item_id, orderId, line.menu_item_id, line.name_snapshot, line.unit_price_minor, line.quantity, line.line_total_minor, line.note, line.base_price_minor, line.option_delta_minor, line.unit_total_minor);
    }),
    ...calculation.lines.flatMap((line) => line.options.map((option) => db.prepare(`
      INSERT INTO merchant_food_order_item_options
        (id,merchant_id,order_id,order_item_id,option_group_id,option_value_id,group_name_snapshot,value_name_snapshot,price_delta_minor)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(uid("foodoption"), context.merchant_id, orderId, line.order_item_id, option.option_group_id, option.option_value_id, option.group_name_snapshot, option.value_name_snapshot, option.price_delta_minor))),
    ...(initialStatus === "accepted" ? [db.prepare("UPDATE merchant_food_orders SET accepted_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?").bind(orderId, context.merchant_id)] : []),
    ...(diningSessionId ? [db.prepare("UPDATE merchant_dining_sessions SET last_order_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=? AND status='open'").bind(diningSessionId, context.merchant_id)] : []),
    ...couponPricing.statements,
    db.prepare(`INSERT INTO merchant_order_pricing(order_id,merchant_id,gross_subtotal_minor,coupon_discount_minor,payable_total_minor,coupon_id,merchant_funded_minor,platform_funded_minor) VALUES(?,?,?,?,?,?,?,0)`).bind(orderId, context.merchant_id, calculation.subtotal_minor, couponPricing.discount, Math.max(calculation.subtotal_minor - couponPricing.discount, 0), couponPricing.couponId, couponPricing.discount),
    db.prepare(`UPDATE merchant_ordering_memberships SET order_count=order_count+1,last_seen_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND id=?`).bind(context.merchant_id, session.membership_id),
    db.prepare(`
      INSERT INTO merchant_ordering_audit_logs
        (id,merchant_id,actor_type,actor_id,action,resource_type,resource_id,metadata)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(uid("ordaudit"), context.merchant_id, "customer", session.membership_id, "order_submitted", "order", orderId, JSON.stringify({ qr_id: context.id, order_type: orderType })),
  ];

  try {
    await db.batch(statements);
  } catch (error) {
    const replay = await db.prepare(`SELECT order_code FROM merchant_food_orders WHERE merchant_id=? AND membership_id=? AND idempotency_key=? LIMIT 1`).bind(context.merchant_id, session.membership_id, idempotencyKey).first();
    if (replay) {
      const order = await orderWithItems(db, context.merchant_id, session.membership_id, replay.order_code);
      return json({ message: "訂單已建立。", order, replayed: true }, 200, cors);
    }
    if (String(error instanceof Error ? error.message : error).includes("ORDERING_DAILY_LIMIT_REACHED")) return json({ error: "部分餐點今日限量已售完，請重新確認購物車。" }, 409, cors);
    throw error;
  }

  const order = await orderWithItems(db, context.merchant_id, session.membership_id, code);
  return json({ message: "訂單已送出，請留意店家處理狀態。", order, replayed: false }, 201, cors);
}

async function handleCustomerCancel(request, db, orderCodeValue, cors) {
  const token = bearer(request);
  if (!token) return json({ error: "會員登入已失效。" }, 401, cors);
  const tokenHash = await hash(token);
  const session = await db.prepare(`SELECT s.merchant_id,s.membership_id FROM merchant_member_sessions s JOIN merchant_ordering_memberships m ON m.merchant_id=s.merchant_id AND m.id=s.membership_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') AND m.status='active'`).bind(tokenHash).first();
  if (!session) return json({ error: "會員登入已失效。" }, 401, cors);
  const input = await request.json().catch(() => ({}));
  const reason = clean(input.reason, 300);
  if (!reason) return json({ error: "請填寫取消原因。" }, 400, cors);
  const order = await db.prepare(`SELECT o.*,s.customer_cancel_before_accept FROM merchant_food_orders o JOIN merchant_ordering_settings s ON s.merchant_id=o.merchant_id WHERE o.merchant_id=? AND o.membership_id=? AND o.order_code=?`).bind(session.merchant_id, session.membership_id, clean(orderCodeValue, 40)).first();
  if (!order) return json({ error: "找不到此訂單。" }, 404, cors);
  if (order.status !== "submitted" || Number(order.customer_cancel_before_accept) !== 1) return json({ error: "店家已接單，請直接聯絡店家協助取消。" }, 409, cors);
  const couponStatements = await couponOrderStateStatements(db, order, "cancelled", order.payment_status);
  await db.batch([
    db.prepare("UPDATE merchant_food_orders SET status='cancelled',cancel_reason=?,cancelled_by_type='customer',cancelled_by_id=?,cancelled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=? AND status='submitted'").bind(reason, session.membership_id, order.id, session.merchant_id),
    ...couponStatements,
    db.prepare("INSERT INTO merchant_ordering_audit_logs(id,merchant_id,actor_type,actor_id,action,resource_type,resource_id,metadata) VALUES(?,?,?,?,?,?,?,?)").bind(uid("ordaudit"), session.merchant_id, "customer", session.membership_id, "order_cancelled", "order", order.id, JSON.stringify({ reason })),
  ]);
  return json({ ok: true, status: "cancelled" }, 200, cors);
}

async function handleGetOrder(request, db, orderCodeValue, cors) {
  const token = bearer(request);
  if (!token) return json({ error: "會員登入已失效。" }, 401, cors);
  const tokenHash = await hash(token);
  const session = await db.prepare(`
    SELECT s.merchant_id,s.membership_id
    FROM merchant_member_sessions s
    JOIN merchant_ordering_memberships m ON m.merchant_id=s.merchant_id AND m.id=s.membership_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') AND m.status='active'
    LIMIT 1
  `).bind(tokenHash).first();
  if (!session) return json({ error: "會員登入已失效。" }, 401, cors);
  const order = await orderWithItems(db, session.merchant_id, session.membership_id, orderCodeValue);
  return order ? json({ order }, 200, cors) : json({ error: "找不到此訂單。" }, 404, cors);
}

export async function handleOrderingRequest(request, env, url, cors = {}) {
  if (!env.FINANCE_DB) return json({ error: CUSTOMER_ERROR }, 503, cors);
  const db = env.FINANCE_DB;
  try {
    const qrMatch = url.pathname.match(/^\/api\/ordering\/qr\/([A-Za-z0-9_-]{8,64})(?:\/(join|menu|orders))?$/);
    if (qrMatch) {
      const context = await qrContext(db, qrMatch[1]);
      if (!context) return json({ error: "此 QR Code 無效、已停用或已過期。" }, 404, cors);
      const action = qrMatch[2] || "context";
      if (request.method === "GET" && action === "context") return handleContext(request, db, context, cors);
      if (request.method === "POST" && action === "join") return handleJoin(request, db, context, cors);
      if (request.method === "GET" && action === "menu") return handleMenu(request, db, context, cors);
      if (request.method === "POST" && action === "orders") return handleCreateOrder(request, db, context, cors);
      return json({ error: "Method not allowed" }, 405, cors);
    }
    const orderMatch = url.pathname.match(/^\/api\/ordering\/orders\/([^/]+)(?:\/(cancel))?$/);
    if (orderMatch && request.method === "GET" && !orderMatch[2]) return handleGetOrder(request, db, orderMatch[1], cors);
    if (orderMatch && request.method === "POST" && orderMatch[2] === "cancel") return handleCustomerCancel(request, db, orderMatch[1], cors);
    return json({ error: "找不到此掃碼點餐服務。" }, 404, cors);
  } catch (error) {
    console.error(JSON.stringify({ service: "qr_ordering", path: url.pathname, error: error instanceof Error ? error.message : "unknown" }));
    return json({ error: CUSTOMER_ERROR }, 500, cors);
  }
}

async function adminOverview(db, merchantId) {
  const settings = await db.prepare(`SELECT * FROM merchant_ordering_settings WHERE merchant_id=?`).bind(merchantId).first();
  const [qrs, categories, items, groups, values, links, sessions, orders, memberCount] = await Promise.all([
    db.prepare(`SELECT * FROM merchant_ordering_qr_codes WHERE merchant_id=? ORDER BY created_at DESC`).bind(merchantId).all(),
    db.prepare(`SELECT * FROM merchant_menu_categories WHERE merchant_id=? ORDER BY sort_order,name`).bind(merchantId).all(),
    db.prepare(`SELECT * FROM merchant_menu_items WHERE merchant_id=? ORDER BY sort_order,name`).bind(merchantId).all(),
    db.prepare(`SELECT * FROM merchant_menu_option_groups WHERE merchant_id=? ORDER BY sort_order,name`).bind(merchantId).all(),
    db.prepare(`SELECT * FROM merchant_menu_option_values WHERE merchant_id=? ORDER BY group_id,sort_order,name`).bind(merchantId).all(),
    db.prepare(`SELECT * FROM merchant_menu_item_option_groups WHERE merchant_id=? ORDER BY sort_order`).bind(merchantId).all(),
    db.prepare(`SELECT * FROM merchant_dining_sessions WHERE merchant_id=? ORDER BY datetime(opened_at) DESC LIMIT 200`).bind(merchantId).all(),
    db.prepare(`
      SELECT o.*,c.display_name customer_name,c.phone_normalized
      FROM merchant_food_orders o
      JOIN merchant_ordering_memberships m ON m.merchant_id=o.merchant_id AND m.id=o.membership_id
      JOIN ordering_customers c ON c.id=m.customer_id
      WHERE o.merchant_id=? ORDER BY datetime(o.created_at) DESC LIMIT 200
    `).bind(merchantId).all(),
    db.prepare(`SELECT COUNT(*) total FROM merchant_ordering_memberships WHERE merchant_id=? AND status='active'`).bind(merchantId).first(),
  ]);
  const orderRows = orders.results || [];
  let orderItems = [];
  let orderOptions = [];
  if (orderRows.length) {
    const ids = orderRows.map((order) => order.id);
    const placeholders = ids.map(() => "?").join(",");
    const result = await db.prepare(`SELECT id,order_id,name_snapshot,quantity,line_total_minor,note FROM merchant_food_order_items WHERE order_id IN (${placeholders}) ORDER BY created_at,id`).bind(...ids).all();
    orderItems = result.results || [];
    const optionResult = await db.prepare(`SELECT order_item_id,group_name_snapshot,value_name_snapshot,price_delta_minor FROM merchant_food_order_item_options WHERE merchant_id=? AND order_id IN (${placeholders}) ORDER BY created_at,id`).bind(merchantId, ...ids).all();
    orderOptions = optionResult.results || [];
  }
  const optionsByOrderItem = new Map();
  for (const option of orderOptions) {
    if (!optionsByOrderItem.has(option.order_item_id)) optionsByOrderItem.set(option.order_item_id, []);
    optionsByOrderItem.get(option.order_item_id).push({ group_name: option.group_name_snapshot, value_name: option.value_name_snapshot, price_delta_minor: Number(option.price_delta_minor) });
  }
  const itemsByOrder = new Map();
  for (const item of orderItems) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push({ ...item, quantity: Number(item.quantity), line_total_minor: Number(item.line_total_minor), options: optionsByOrderItem.get(item.id) || [] });
  }
  return {
    settings: settings ? {
      ...settings,
      enabled: Boolean(settings.enabled),
      dine_in_enabled: Boolean(settings.dine_in_enabled),
      takeaway_enabled: Boolean(settings.takeaway_enabled),
      require_member: Boolean(settings.require_member),
      ordering_open: Boolean(settings.ordering_open),
      accepting_orders: Boolean(settings.accepting_orders),
      auto_accept_orders: Boolean(settings.auto_accept_orders),
      customer_cancel_before_accept: Boolean(settings.customer_cancel_before_accept),
      new_order_sound_enabled: Boolean(settings.new_order_sound_enabled),
      table_session_enabled: Boolean(settings.table_session_enabled),
      show_sold_out_items: Boolean(settings.show_sold_out_items),
    } : null,
    qrs: (qrs.results || []).map((row) => ({ ...row, active: Boolean(row.active) })),
    categories: (categories.results || []).map((row) => ({ ...row, active: Boolean(row.active) })),
    items: (items.results || []).map((row) => ({ ...row, available: Boolean(row.available), allow_customer_note: Boolean(row.allow_customer_note), price_minor: Number(row.price_minor) })),
    option_groups: (groups.results || []).map((row) => ({ ...row, required: Boolean(row.required), active: Boolean(row.active) })),
    option_values: (values.results || []).map((row) => ({ ...row, active: Boolean(row.active), price_delta_minor: Number(row.price_delta_minor) })),
    item_option_groups: (links.results || []).map((row) => ({
      item_id: row.menu_item_id,
      group_id: row.option_group_id,
      sort_order: Number(row.sort_order || 0),
    })),
    dining_sessions: sessions.results || [],
    orders: orderRows.map((row) => ({
      ...publicOrder(row, itemsByOrder.get(row.id) || []),
      customer_name: row.customer_name,
      phone_masked: maskPhone(row.phone_normalized),
    })),
    summary: {
      active_members: Number(memberCount?.total || 0),
      open_orders: orderRows.filter((row) => !["completed", "cancelled"].includes(row.status)).length,
      total_orders: orderRows.length,
    },
  };
}

async function requireSettings(db, merchantId) {
  return db.prepare(`SELECT * FROM merchant_ordering_settings WHERE merchant_id=?`).bind(merchantId).first();
}

function boolValue(input, key, fallback) {
  return hasOwn(input, key) ? (input[key] ? 1 : 0) : (fallback ? 1 : 0);
}

export async function handleOrderingAdminRequest(request, env, url, cors = {}, adminAuthorized = false, actor = {}) {
  if (!env.FINANCE_DB) return json({ error: CUSTOMER_ERROR }, 503, cors);
  if (!adminAuthorized) return json({ error: "需要平台管理員授權。" }, 401, cors);
  const db = env.FINANCE_DB;
  const merchantId = validMerchantId(url.searchParams.get("merchant_id"));
  if (!merchantId) return json({ error: "請提供正確的 merchant_id。" }, 400, cors);
  const actorType = "admin";
  const actorId = clean(actor.actor_id || "admin", 120);
  const actorRole = clean(actor.actor_role || (actor.actor_type === "merchant" ? "merchant" : "platform_admin"), 120);

  try {
    if (url.pathname === "/api/admin/ordering/overview" && request.method === "GET") {
      return json({ merchant_id: merchantId, ...(await adminOverview(db, merchantId)) }, 200, cors);
    }

    if (url.pathname === "/api/admin/ordering/settings" && request.method === "PATCH") {
      const input = await request.json();
      const current = await requireSettings(db, merchantId);
      const displayName = clean(input.display_name ?? current?.display_name, 120);
      const consentVersion = clean(input.consent_version ?? current?.consent_version ?? "2026-08-27", 60);
      if (!displayName || !consentVersion) return json({ error: "請填寫商家顯示名稱與同意書版本。" }, 400, cors);
      await db.prepare(`
        INSERT INTO merchant_ordering_settings
          (merchant_id,display_name,enabled,currency,dine_in_enabled,takeaway_enabled,require_member,consent_version,
           ordering_open,accepting_orders,temporary_closed_message,auto_accept_orders,order_number_prefix,
           max_items_per_order,customer_cancel_before_accept,estimated_prep_minutes,new_order_sound_enabled,
           table_session_enabled,show_sold_out_items,last_order_time,timezone)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(merchant_id) DO UPDATE SET
          display_name=excluded.display_name,
          enabled=excluded.enabled,
          currency=excluded.currency,
          dine_in_enabled=excluded.dine_in_enabled,
          takeaway_enabled=excluded.takeaway_enabled,
          require_member=excluded.require_member,
          consent_version=excluded.consent_version,
          ordering_open=excluded.ordering_open,
          accepting_orders=excluded.accepting_orders,
          temporary_closed_message=excluded.temporary_closed_message,
          auto_accept_orders=excluded.auto_accept_orders,
          order_number_prefix=excluded.order_number_prefix,
          max_items_per_order=excluded.max_items_per_order,
          customer_cancel_before_accept=excluded.customer_cancel_before_accept,
          estimated_prep_minutes=excluded.estimated_prep_minutes,
          new_order_sound_enabled=excluded.new_order_sound_enabled,
          table_session_enabled=excluded.table_session_enabled,
          show_sold_out_items=excluded.show_sold_out_items,
          last_order_time=excluded.last_order_time,
          timezone=excluded.timezone,
          updated_at=CURRENT_TIMESTAMP
      `).bind(
        merchantId, displayName,
        boolValue(input, "enabled", current?.enabled),
        clean(input.currency ?? current?.currency ?? "TWD", 3).toUpperCase(),
        boolValue(input, "dine_in_enabled", current?.dine_in_enabled ?? true),
        boolValue(input, "takeaway_enabled", current?.takeaway_enabled ?? true),
        1,
        consentVersion,
        boolValue(input, "ordering_open", current?.ordering_open ?? true),
        boolValue(input, "accepting_orders", current?.accepting_orders ?? false),
        clean(input.temporary_closed_message ?? current?.temporary_closed_message ?? "店家目前暫停接單", 200),
        boolValue(input, "auto_accept_orders", current?.auto_accept_orders ?? false),
        clean(input.order_number_prefix ?? current?.order_number_prefix ?? "BY", 8).replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "BY",
        Math.max(1, Math.min(200, Number(input.max_items_per_order ?? current?.max_items_per_order ?? 50))),
        boolValue(input, "customer_cancel_before_accept", current?.customer_cancel_before_accept ?? true),
        Math.max(1, Math.min(480, Number(input.estimated_prep_minutes ?? current?.estimated_prep_minutes ?? 20))),
        boolValue(input, "new_order_sound_enabled", current?.new_order_sound_enabled ?? true),
        boolValue(input, "table_session_enabled", current?.table_session_enabled ?? true),
        boolValue(input, "show_sold_out_items", current?.show_sold_out_items ?? true),
        clean(input.last_order_time ?? current?.last_order_time, 5) || null,
        "Asia/Taipei",
      ).run();
      await audit(db, merchantId, actorType, actorId, "ordering_settings_saved", "settings", merchantId, { actor_role: actorRole });
      return json({ ok: true }, current ? 200 : 201, cors);
    }

    if (url.pathname === "/api/admin/ordering/qrs" && request.method === "POST") {
      const settings = await requireSettings(db, merchantId);
      if (!settings) return json({ error: "請先儲存商家掃碼系統設定。" }, 409, cors);
      const input = await request.json();
      const purpose = clean(input.purpose, 20);
      const allowed = ["member_order", "member_only", "dine_in", "takeaway"];
      const label = clean(input.label, 120);
      const tableLabel = clean(input.table_label, 80) || null;
      if (!label || !allowed.includes(purpose)) return json({ error: "請填寫 QR 名稱並選擇正確用途。" }, 400, cors);
      if (purpose === "dine_in" && !tableLabel) return json({ error: "內用桌號 QR 必須填寫桌號。" }, 400, cors);
      let expiresAt = null;
      if (input.expires_at) {
        const date = new Date(input.expires_at);
        if (!Number.isFinite(date.getTime()) || date <= new Date()) return json({ error: "QR 到期時間格式不正確。" }, 400, cors);
        expiresAt = date.toISOString();
      }
      const row = { id: uid("orderqr"), code: randomCode(20) };
      await db.prepare(`
        INSERT INTO merchant_ordering_qr_codes (id,merchant_id,code,label,purpose,table_label,active,expires_at)
        VALUES (?,?,?,?,?,?,1,?)
      `).bind(row.id, merchantId, row.code, label, purpose, tableLabel, expiresAt).run();
      await audit(db, merchantId, "admin", "admin", "qr_created", "qr", row.id, { purpose, table_label: tableLabel });
      return json({ ok: true, qr: { ...row, merchant_id: merchantId, label, purpose, table_label: tableLabel, active: true, expires_at: expiresAt } }, 201, cors);
    }

    if (url.pathname === "/api/admin/ordering/qrs/batch" && request.method === "POST") {
      if (!(await requireSettings(db, merchantId))) return json({ error: "請先儲存商家掃碼系統設定。" }, 409, cors);
      const input = await request.json();
      const prefix = clean(input.prefix, 20);
      const suffix = clean(input.suffix, 20);
      const start = Number(input.start);
      const end = Number(input.end);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end - start + 1 > 100) return json({ error: "批次桌號範圍須為 1～100 張。" }, 400, cors);
      const rows = Array.from({ length: end - start + 1 }, (_, offset) => {
        const table = `${prefix}${start + offset}${suffix}`;
        return { id: uid("orderqr"), code: randomCode(24), table, label: `${table} 點餐` };
      });
      await db.batch([
        ...rows.map((row) => db.prepare("INSERT INTO merchant_ordering_qr_codes(id,merchant_id,code,label,purpose,table_label,active) VALUES(?,?,?,?,'dine_in',?,1)").bind(row.id, merchantId, row.code, row.label, row.table)),
        db.prepare("INSERT INTO merchant_ordering_audit_logs(id,merchant_id,actor_type,actor_id,actor_role,action,resource_type,resource_id,metadata) VALUES(?,?,?,?,?,'qr_batch_created','qr_batch',?,?)").bind(uid("ordaudit"), merchantId, actorType, actorId, actorRole, `${prefix}${start}-${end}${suffix}`, JSON.stringify({ count: rows.length })),
      ]);
      return json({ ok: true, items: rows }, 201, cors);
    }

    const qrRegenerate = url.pathname.match(/^\/api\/admin\/ordering\/qrs\/([^/]+)\/regenerate$/);
    if (qrRegenerate && request.method === "POST") {
      const current = await db.prepare("SELECT * FROM merchant_ordering_qr_codes WHERE merchant_id=? AND id=?").bind(merchantId, qrRegenerate[1]).first();
      if (!current) return json({ error: "找不到此 QR Code。" }, 404, cors);
      const nextCode = randomCode(24);
      await db.batch([
        db.prepare("UPDATE merchant_ordering_qr_codes SET code=?,previous_code_hash=?,regenerated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND id=?").bind(nextCode, await hash(current.code), merchantId, current.id),
        db.prepare("INSERT INTO merchant_ordering_audit_logs(id,merchant_id,actor_type,actor_id,actor_role,action,resource_type,resource_id) VALUES(?,?,?,?,?,'qr_regenerated','qr',?)").bind(uid("ordaudit"), merchantId, actorType, actorId, actorRole, current.id),
      ]);
      return json({ ok: true, qr: { ...current, code: nextCode } }, 200, cors);
    }

    const qrMatch = url.pathname.match(/^\/api\/admin\/ordering\/qrs\/([^/]+)$/);
    if (qrMatch && request.method === "PATCH") {
      const current = await db.prepare(`SELECT * FROM merchant_ordering_qr_codes WHERE merchant_id=? AND id=?`).bind(merchantId, qrMatch[1]).first();
      if (!current) return json({ error: "找不到此 QR Code。" }, 404, cors);
      const input = await request.json();
      const label = clean(input.label ?? current.label, 120);
      const tableLabel = clean(input.table_label ?? current.table_label, 80) || null;
      if (!label || (current.purpose === "dine_in" && !tableLabel)) return json({ error: "請填寫 QR 名稱與桌號。" }, 400, cors);
      let expiresAt = current.expires_at;
      if (hasOwn(input, "expires_at")) {
        if (!input.expires_at) expiresAt = null;
        else {
          const date = new Date(input.expires_at);
          if (!Number.isFinite(date.getTime())) return json({ error: "QR 到期時間格式不正確。" }, 400, cors);
          expiresAt = date.toISOString();
        }
      }
      await db.prepare(`UPDATE merchant_ordering_qr_codes SET label=?,table_label=?,active=?,expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND id=?`).bind(label, tableLabel, boolValue(input, "active", current.active), expiresAt, merchantId, current.id).run();
      await audit(db, merchantId, "admin", "admin", "qr_updated", "qr", current.id);
      return json({ ok: true }, 200, cors);
    }

    if (url.pathname === "/api/admin/ordering/categories" && request.method === "POST") {
      if (!(await requireSettings(db, merchantId))) return json({ error: "請先儲存商家掃碼系統設定。" }, 409, cors);
      const input = await request.json();
      const name = clean(input.name, 100);
      if (!name) return json({ error: "請填寫菜單分類名稱。" }, 400, cors);
      const id = uid("menucat");
      await db.prepare(`INSERT INTO merchant_menu_categories (id,merchant_id,name,description,sort_order,active) VALUES (?,?,?,?,?,1)`).bind(id, merchantId, name, clean(input.description, 300) || null, Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : 0).run();
      await audit(db, merchantId, "admin", "admin", "menu_category_created", "menu_category", id);
      return json({ ok: true, id }, 201, cors);
    }

    const categoryMatch = url.pathname.match(/^\/api\/admin\/ordering\/categories\/([^/]+)$/);
    if (categoryMatch && request.method === "PATCH") {
      const current = await db.prepare(`SELECT * FROM merchant_menu_categories WHERE merchant_id=? AND id=?`).bind(merchantId, categoryMatch[1]).first();
      if (!current) return json({ error: "找不到此菜單分類。" }, 404, cors);
      const input = await request.json();
      const name = clean(input.name ?? current.name, 100);
      if (!name) return json({ error: "分類名稱不可為空白。" }, 400, cors);
      const archived = input.archived === true;
      await db.prepare(`UPDATE merchant_menu_categories SET name=?,description=?,sort_order=?,active=?,archived_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP WHEN ?=0 THEN NULL ELSE archived_at END,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND id=?`).bind(name, clean(input.description ?? current.description, 300) || null, Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : Number(current.sort_order), archived ? 0 : boolValue(input, "active", current.active), hasOwn(input, "archived") ? (archived ? 1 : 0) : -1, hasOwn(input, "archived") ? (archived ? 1 : 0) : -1, merchantId, current.id).run();
      await audit(db, merchantId, actorType, actorId, archived ? "menu_category_archived" : "menu_category_updated", "menu_category", current.id, { actor_role: actorRole });
      return json({ ok: true }, 200, cors);
    }

    if (url.pathname === "/api/admin/ordering/items" && request.method === "POST") {
      const input = await request.json();
      const categoryId = clean(input.category_id, 120);
      const category = await db.prepare(`SELECT id FROM merchant_menu_categories WHERE merchant_id=? AND id=?`).bind(merchantId, categoryId).first();
      if (!category) return json({ error: "請選擇此商家的有效菜單分類。" }, 400, cors);
      const name = clean(input.name, 120);
      const priceMinor = Number(input.price_minor);
      const imageUrl = validImageUrl(input.image_url);
      if (!name || !Number.isInteger(priceMinor) || priceMinor < 0 || priceMinor > 10000000) return json({ error: "請填寫品項名稱與正確價格。" }, 400, cors);
      if (imageUrl === null) return json({ error: "圖片網址格式不正確。" }, 400, cors);
      const id = uid("menuitem");
      await db.prepare(`
        INSERT INTO merchant_menu_items
          (id,merchant_id,category_id,sku,name,description,price_minor,image_url,available,sort_order,status,allow_customer_note,daily_limit)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        id, merchantId, categoryId, clean(input.sku, 80) || null, name,
        clean(input.description, 1000) || null, priceMinor, imageUrl || null,
        input.available === false ? 0 : 1,
        Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : 0,
        input.status === "hidden" ? "hidden" : "active",
        input.allow_customer_note === false ? 0 : 1,
        input.daily_limit == null || input.daily_limit === "" ? null : Math.max(1, Math.min(100000, Number(input.daily_limit))),
      ).run();
      await audit(db, merchantId, "admin", "admin", "menu_item_created", "menu_item", id);
      return json({ ok: true, id }, 201, cors);
    }

    const duplicateItem = url.pathname.match(/^\/api\/admin\/ordering\/items\/([^/]+)\/duplicate$/);
    if (duplicateItem && request.method === "POST") {
      const current = await db.prepare("SELECT * FROM merchant_menu_items WHERE merchant_id=? AND id=?").bind(merchantId, duplicateItem[1]).first();
      if (!current) return json({ error: "找不到此菜單品項。" }, 404, cors);
      const id = uid("menuitem");
      await db.batch([
        db.prepare(`INSERT INTO merchant_menu_items(id,merchant_id,category_id,sku,name,description,price_minor,image_url,available,sort_order,status,allow_customer_note,daily_limit) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, merchantId, current.category_id, null, `${current.name}（複製）`, current.description, current.price_minor, current.image_url, 1, Number(current.sort_order) + 1, "hidden", current.allow_customer_note, current.daily_limit),
        db.prepare("INSERT INTO merchant_menu_item_option_groups(merchant_id,menu_item_id,option_group_id,sort_order) SELECT merchant_id,?,option_group_id,sort_order FROM merchant_menu_item_option_groups WHERE merchant_id=? AND menu_item_id=?").bind(id, merchantId, current.id),
      ]);
      await audit(db, merchantId, actorType, actorId, "menu_item_duplicated", "menu_item", id, { source_id: current.id, actor_role: actorRole });
      return json({ ok: true, id }, 201, cors);
    }

    const itemMatch = url.pathname.match(/^\/api\/admin\/ordering\/items\/([^/]+)$/);
    if (itemMatch && request.method === "PATCH") {
      const current = await db.prepare(`SELECT * FROM merchant_menu_items WHERE merchant_id=? AND id=?`).bind(merchantId, itemMatch[1]).first();
      if (!current) return json({ error: "找不到此菜單品項。" }, 404, cors);
      const input = await request.json();
      const categoryId = clean(input.category_id ?? current.category_id, 120);
      if (!(await db.prepare(`SELECT id FROM merchant_menu_categories WHERE merchant_id=? AND id=?`).bind(merchantId, categoryId).first())) return json({ error: "找不到此菜單分類。" }, 400, cors);
      const name = clean(input.name ?? current.name, 120);
      const priceMinor = hasOwn(input, "price_minor") ? Number(input.price_minor) : Number(current.price_minor);
      const imageUrl = validImageUrl(input.image_url ?? current.image_url);
      if (!name || !Number.isInteger(priceMinor) || priceMinor < 0 || priceMinor > 10000000) return json({ error: "請填寫品項名稱與正確價格。" }, 400, cors);
      if (imageUrl === null) return json({ error: "圖片網址格式不正確。" }, 400, cors);
      const status = ["active", "sold_out", "hidden", "archived"].includes(input.status) ? input.status : (hasOwn(input, "available") ? (input.available ? "active" : "hidden") : current.status);
      const dailyLimit = hasOwn(input, "daily_limit") ? (input.daily_limit == null || input.daily_limit === "" ? null : Number(input.daily_limit)) : current.daily_limit;
      if (dailyLimit !== null && (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 100000)) return json({ error: "每日限量須為正整數。" }, 400, cors);
      await db.prepare(`
        UPDATE merchant_menu_items SET category_id=?,sku=?,name=?,description=?,price_minor=?,image_url=?,available=?,sort_order=?,status=?,allow_customer_note=?,daily_limit=?,archived_at=CASE WHEN ?='archived' THEN COALESCE(archived_at,CURRENT_TIMESTAMP) ELSE NULL END,updated_at=CURRENT_TIMESTAMP
        WHERE merchant_id=? AND id=?
      `).bind(
        categoryId, clean(input.sku ?? current.sku, 80) || null, name,
        clean(input.description ?? current.description, 1000) || null, priceMinor, imageUrl || null,
        status === "active" ? 1 : 0,
        Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : Number(current.sort_order),
        status,
        boolValue(input, "allow_customer_note", current.allow_customer_note),
        dailyLimit,
        status,
        merchantId, current.id,
      ).run();
      await audit(db, merchantId, "admin", "admin", "menu_item_updated", "menu_item", current.id);
      return json({ ok: true }, 200, cors);
    }

    if (url.pathname === "/api/admin/ordering/option-groups" && request.method === "POST") {
      const input = await request.json();
      const name = clean(input.name, 100);
      const selectionType = input.selection_type === "multiple" ? "multiple" : "single";
      const min = Number(input.min_select ?? (input.required ? 1 : 0));
      const max = selectionType === "single" ? 1 : Number(input.max_select ?? 1);
      if (!name || !Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 1 || min > max) return json({ error: "加料群組設定不正確。" }, 400, cors);
      const id = uid("optiongroup");
      await db.prepare("INSERT INTO merchant_menu_option_groups(id,merchant_id,name,selection_type,required,min_select,max_select,sort_order,active) VALUES(?,?,?,?,?,?,?,?,1)").bind(id, merchantId, name, selectionType, min > 0 ? 1 : 0, min, max, Number(input.sort_order || 0)).run();
      await audit(db, merchantId, actorType, actorId, "option_group_created", "option_group", id, { actor_role: actorRole });
      return json({ ok: true, id }, 201, cors);
    }

    const optionGroupMatch = url.pathname.match(/^\/api\/admin\/ordering\/option-groups\/([^/]+)$/);
    if (optionGroupMatch && request.method === "PATCH") {
      const current = await db.prepare("SELECT * FROM merchant_menu_option_groups WHERE merchant_id=? AND id=?").bind(merchantId, optionGroupMatch[1]).first();
      if (!current) return json({ error: "找不到此加料群組。" }, 404, cors);
      const input = await request.json();
      const selectionType = input.selection_type === "multiple" ? "multiple" : (input.selection_type === "single" ? "single" : current.selection_type);
      const min = hasOwn(input, "min_select") ? Number(input.min_select) : Number(current.min_select);
      const max = selectionType === "single" ? 1 : (hasOwn(input, "max_select") ? Number(input.max_select) : Number(current.max_select));
      if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 1 || min > max) return json({ error: "加料選擇數量不正確。" }, 400, cors);
      const active = input.archived === true ? 0 : boolValue(input, "active", current.active);
      await db.prepare("UPDATE merchant_menu_option_groups SET name=?,selection_type=?,required=?,min_select=?,max_select=?,sort_order=?,active=?,archived_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND id=?").bind(clean(input.name ?? current.name, 100), selectionType, min > 0 ? 1 : 0, min, max, Number(input.sort_order ?? current.sort_order), active, input.archived === true ? 1 : 0, merchantId, current.id).run();
      return json({ ok: true }, 200, cors);
    }

    const optionValueCreate = url.pathname.match(/^\/api\/admin\/ordering\/option-groups\/([^/]+)\/values$/);
    if (optionValueCreate && request.method === "POST") {
      const group = await db.prepare("SELECT id FROM merchant_menu_option_groups WHERE merchant_id=? AND id=? AND archived_at IS NULL").bind(merchantId, optionValueCreate[1]).first();
      if (!group) return json({ error: "找不到此加料群組。" }, 404, cors);
      const input = await request.json(); const name = clean(input.name, 100); const delta = Number(input.price_delta_minor || 0);
      if (!name || !Number.isInteger(delta) || delta < 0 || delta > 10000000) return json({ error: "加料名稱或價格不正確。" }, 400, cors);
      const id = uid("optionvalue");
      await db.prepare("INSERT INTO merchant_menu_option_values(id,merchant_id,group_id,name,price_delta_minor,sort_order,active) VALUES(?,?,?,?,?,?,1)").bind(id, merchantId, group.id, name, delta, Number(input.sort_order || 0)).run();
      return json({ ok: true, id }, 201, cors);
    }

    const optionValueMatch = url.pathname.match(/^\/api\/admin\/ordering\/option-values\/([^/]+)$/);
    if (optionValueMatch && request.method === "PATCH") {
      const current = await db.prepare("SELECT * FROM merchant_menu_option_values WHERE merchant_id=? AND id=?").bind(merchantId, optionValueMatch[1]).first();
      if (!current) return json({ error: "找不到此加料選項。" }, 404, cors);
      const input = await request.json(); const delta = hasOwn(input, "price_delta_minor") ? Number(input.price_delta_minor) : Number(current.price_delta_minor);
      if (!Number.isInteger(delta) || delta < 0 || delta > 10000000) return json({ error: "加料金額不正確。" }, 400, cors);
      await db.prepare("UPDATE merchant_menu_option_values SET name=?,price_delta_minor=?,sort_order=?,active=?,archived_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND id=?").bind(clean(input.name ?? current.name, 100), delta, Number(input.sort_order ?? current.sort_order), input.archived === true ? 0 : boolValue(input, "active", current.active), input.archived === true ? 1 : 0, merchantId, current.id).run();
      return json({ ok: true }, 200, cors);
    }

    const itemGroups = url.pathname.match(/^\/api\/admin\/ordering\/items\/([^/]+)\/option-groups$/);
    if (itemGroups && request.method === "PUT") {
      if (!await db.prepare("SELECT id FROM merchant_menu_items WHERE merchant_id=? AND id=?").bind(merchantId, itemGroups[1]).first()) return json({ error: "找不到此菜單品項。" }, 404, cors);
      const input = await request.json(); const groupIds = [...new Set((Array.isArray(input.group_ids) ? input.group_ids : []).map((id) => clean(id, 120)).filter(Boolean))];
      if (groupIds.length) {
        const placeholders = groupIds.map(() => "?").join(",");
        const found = await db.prepare(`SELECT COUNT(*) count FROM merchant_menu_option_groups WHERE merchant_id=? AND id IN (${placeholders}) AND archived_at IS NULL`).bind(merchantId, ...groupIds).first();
        if (Number(found.count) !== groupIds.length) return json({ error: "部分加料群組不屬於此商家。" }, 400, cors);
      }
      await db.batch([db.prepare("DELETE FROM merchant_menu_item_option_groups WHERE merchant_id=? AND menu_item_id=?").bind(merchantId, itemGroups[1]), ...groupIds.map((id, index) => db.prepare("INSERT INTO merchant_menu_item_option_groups(merchant_id,menu_item_id,option_group_id,sort_order) VALUES(?,?,?,?)").bind(merchantId, itemGroups[1], id, index))]);
      return json({ ok: true }, 200, cors);
    }

    const closeSession = url.pathname.match(/^\/api\/admin\/ordering\/dining-sessions\/([^/]+)\/close$/);
    if (closeSession && request.method === "POST") {
      const result = await db.prepare("UPDATE merchant_dining_sessions SET status='closed',closed_at=CURRENT_TIMESTAMP,closed_by=? WHERE merchant_id=? AND id=? AND status='open'").bind(actorId, merchantId, closeSession[1]).run();
      if (!result.meta?.changes) return json({ error: "找不到可清桌的桌位 Session。" }, 404, cors);
      await audit(db, merchantId, actorType, actorId, "dining_session_closed", "dining_session", closeSession[1], { actor_role: actorRole });
      return json({ ok: true }, 200, cors);
    }

    const paymentAction = url.pathname.match(/^\/api\/admin\/ordering\/orders\/([^/]+)\/payment$/);
    if (paymentAction && request.method === "POST") {
      const order = await db.prepare("SELECT * FROM merchant_food_orders WHERE merchant_id=? AND order_code=?").bind(merchantId, paymentAction[1]).first();
      if (!order) return json({ error: "找不到此訂單。" }, 404, cors);
      const input = await request.json(); const action = input.action === "refund" ? "refunded" : "confirmed";
      const method = ["counter", "cash", "card", "line_pay", "easycard_terminal", "other"].includes(input.payment_method) ? input.payment_method : "counter";
      const key = clean(request.headers.get("idempotency-key") || input.idempotency_key, 100);
      if (!key) return json({ error: "付款操作需要 Idempotency-Key。" }, 400, cors);
      const existing = await db.prepare("SELECT action FROM merchant_order_payment_events WHERE merchant_id=? AND order_id=? AND idempotency_key=?").bind(merchantId, order.id, key).first();
      if (existing) return json({ ok: true, replayed: true, payment_status: existing.action === "confirmed" ? "paid" : "refunded" }, 200, cors);
      const next = action === "confirmed" ? "paid" : "refunded";
      await db.batch([
        db.prepare("INSERT INTO merchant_order_payment_events(id,merchant_id,order_id,action,payment_method,reference,actor_type,actor_id,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?)").bind(uid("payevent"), merchantId, order.id, action, method, clean(input.reference, 120) || null, actor.actor_type === "merchant" ? "merchant" : "admin", actorId, key),
        db.prepare("UPDATE merchant_food_orders SET payment_status=?,payment_method_v1=?,payment_reference=?,payment_confirmed_at=CASE WHEN ?='paid' THEN CURRENT_TIMESTAMP ELSE payment_confirmed_at END,payment_confirmed_by=?,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND id=?").bind(next, method, clean(input.reference, 120) || null, next, actorId, merchantId, order.id),
      ]);
      await audit(db, merchantId, actorType, actorId, `order_payment_${action}`, "order", order.id, { method, actor_role: actorRole });
      return json({ ok: true, payment_status: next }, 200, cors);
    }

    const orderStatusMatch = url.pathname.match(/^\/api\/admin\/ordering\/orders\/([^/]+)\/status$/);
    if (orderStatusMatch && request.method === "PATCH") {
      const current = await db.prepare(`SELECT * FROM merchant_food_orders WHERE merchant_id=? AND order_code=?`).bind(merchantId, clean(orderStatusMatch[1], 40)).first();
      if (!current) return json({ error: "找不到此訂單。" }, 404, cors);
      const input = await request.json();
      const nextStatus = clean(input.status ?? current.status, 30);
      // Payment state has a dedicated, permissioned and idempotent endpoint.
      // Never let the general order-state mutation smuggle a payment change.
      const paymentStatus = current.payment_status;
      const override = actor.actor_type !== "merchant" && input.admin_override === true && input.confirm_override === true;
      if (!canTransitionOrderStatus(current.status, nextStatus) && !override) return json({ error: `訂單無法由 ${current.status} 直接變更為 ${nextStatus}。` }, 409, cors);
      const cancelReason = clean(input.cancel_reason, 300);
      if (nextStatus === "cancelled" && !cancelReason) return json({ error: "取消訂單必須填寫原因。" }, 400, cors);
      if (!["unpaid", "paid", "refunded"].includes(paymentStatus)) return json({ error: "付款狀態不正確。" }, 400, cors);
      const couponStatements = await couponOrderStateStatements(db, current, nextStatus, paymentStatus);
      await db.batch([db.prepare(`
        UPDATE merchant_food_orders SET
          status=?,payment_status=?,
          accepted_at=CASE WHEN ?='accepted' AND accepted_at IS NULL THEN CURRENT_TIMESTAMP ELSE accepted_at END,
          preparing_at=CASE WHEN ?='preparing' AND preparing_at IS NULL THEN CURRENT_TIMESTAMP ELSE preparing_at END,
          ready_at=CASE WHEN ?='ready' AND ready_at IS NULL THEN CURRENT_TIMESTAMP ELSE ready_at END,
          served_at=CASE WHEN ?='served' AND served_at IS NULL THEN CURRENT_TIMESTAMP ELSE served_at END,
          completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
          cancelled_at=CASE WHEN ?='cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
          cancel_reason=CASE WHEN ?='cancelled' THEN ? ELSE cancel_reason END,
          cancelled_by_type=CASE WHEN ?='cancelled' THEN ? ELSE cancelled_by_type END,
          cancelled_by_id=CASE WHEN ?='cancelled' THEN ? ELSE cancelled_by_id END,
          admin_override=CASE WHEN ?=1 THEN 1 ELSE admin_override END,
          updated_at=CURRENT_TIMESTAMP
        WHERE merchant_id=? AND id=?
      `).bind(nextStatus, paymentStatus, nextStatus, nextStatus, nextStatus, nextStatus, nextStatus, nextStatus, nextStatus, cancelReason || null, nextStatus, actor.actor_type === "merchant" ? "merchant" : "admin", nextStatus, actorId, override ? 1 : 0, merchantId, current.id), ...couponStatements, db.prepare(`INSERT INTO merchant_ordering_audit_logs(id,merchant_id,actor_type,actor_id,actor_role,action,resource_type,resource_id,metadata) VALUES(?,?,?,?,?,?,?,?,?)`).bind(uid("ordaudit"), merchantId, actorType, actorId, actorRole, "order_status_updated", "order", current.id, JSON.stringify({ from: current.status, to: nextStatus, payment_status: paymentStatus, cancel_reason: cancelReason || null, admin_override: override }))]);
      return json({ ok: true, status: nextStatus, payment_status: paymentStatus }, 200, cors);
    }

    return json({ error: "找不到此掃碼點餐管理服務。" }, 404, cors);
  } catch (error) {
    console.error(JSON.stringify({ service: "qr_ordering_admin", merchant_id: merchantId, path: url.pathname, error: error instanceof Error ? error.message : "unknown" }));
    return json({ error: "掃碼會員與點餐管理服務暫時無法使用。" }, 500, cors);
  }
}
