import { couponOrderStateStatements, issueWelcomeCoupon, prepareCouponForOrder } from "./member-integrations.js";

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

export function normalizeTaiwanMobile(value) {
  let phone = String(value || "").replace(/[^0-9+]/g, "");
  if (phone.startsWith("+886")) phone = `0${phone.slice(4)}`;
  else if (phone.startsWith("886")) phone = `0${phone.slice(3)}`;
  return /^09\d{8}$/.test(phone) ? phone : "";
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
    qr: {
      id: row.id,
      code: row.code,
      label: row.label,
      purpose,
      table_label: row.table_label || "",
    },
    ordering_allowed: Boolean(row.enabled) && purpose !== "member_only",
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
    payment_method: row.payment_method,
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
    })),
  };
}

async function qrContext(db, code) {
  return db.prepare(`
    SELECT q.*,s.display_name,s.enabled,s.currency,s.dine_in_enabled,s.takeaway_enabled,
           s.require_member,s.consent_version
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
    JOIN merchant_memberships m ON m.merchant_id=s.merchant_id AND m.id=s.membership_id
    JOIN ordering_customers c ON c.id=m.customer_id
    WHERE s.token_hash=? AND s.merchant_id=? AND s.revoked_at IS NULL
      AND datetime(s.expires_at)>datetime('now') AND m.status='active'
    LIMIT 1
  `).bind(tokenHash, merchantId).first();
  if (!row) return null;
  await db.batch([
    db.prepare(`UPDATE merchant_member_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?`).bind(row.session_id),
    db.prepare(`UPDATE merchant_memberships SET last_seen_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(row.membership_id),
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
    SELECT name_snapshot,unit_price_minor,quantity,line_total_minor,note
    FROM merchant_food_order_items WHERE order_id=? ORDER BY created_at,id
  `).bind(row.id).all();
  const pricing = await db.prepare(`SELECT gross_subtotal_minor,coupon_discount_minor,payable_total_minor,coupon_id FROM merchant_order_pricing WHERE order_id=?`).bind(row.id).first();
  return { ...publicOrder(row, items.results || []), pricing: pricing || { gross_subtotal_minor: Number(row.subtotal_minor), coupon_discount_minor: 0, payable_total_minor: Number(row.total_minor), coupon_id: null } };
}

export function calculateOrderLines(requestItems, catalogItems) {
  if (!Array.isArray(requestItems) || requestItems.length < 1 || requestItems.length > MAX_ORDER_LINES) {
    return { ok: false, error: "請選擇至少一項餐點，單筆訂單最多 50 個品項。" };
  }
  const quantities = new Map();
  const notes = new Map();
  for (const input of requestItems) {
    const itemId = clean(input?.item_id, 120);
    const quantity = Number(input?.quantity);
    if (!itemId || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      return { ok: false, error: "餐點數量格式不正確，每個品項最多 20 份。" };
    }
    const next = Number(quantities.get(itemId) || 0) + quantity;
    if (next > MAX_ITEM_QUANTITY) return { ok: false, error: "同一品項最多 20 份。" };
    quantities.set(itemId, next);
    notes.set(itemId, clean(input?.note, 200));
  }
  const catalog = new Map((catalogItems || []).map((item) => [String(item.id), item]));
  if (catalog.size !== quantities.size) return { ok: false, error: "部分餐點已下架或暫停供應，請重新確認。" };
  let subtotal = 0;
  const lines = [];
  for (const [itemId, quantity] of quantities) {
    const item = catalog.get(itemId);
    const price = Number(item?.price_minor);
    if (!item || !Number.isSafeInteger(price) || price < 0) return { ok: false, error: "餐點價格資料異常。" };
    const lineTotal = price * quantity;
    subtotal += lineTotal;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(subtotal)) return { ok: false, error: "訂單金額超出系統處理範圍。" };
    lines.push({
      menu_item_id: itemId,
      name_snapshot: String(item.name),
      unit_price_minor: price,
      quantity,
      line_total_minor: lineTotal,
      note: notes.get(itemId) || null,
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
    ready: ["served", "completed", "cancelled"],
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
  const input = await request.json();
  const displayName = clean(input?.display_name, 80);
  const phone = normalizeTaiwanMobile(input?.phone);
  const email = validEmail(input?.email);
  if (!displayName || !phone) return json({ error: "請填寫姓名與正確的台灣手機號碼。" }, 400, cors);
  if (email === null) return json({ error: "Email 格式不正確。" }, 400, cors);
  if (input?.privacy_consent !== true || clean(input?.consent_version, 60) !== context.consent_version) {
    return json({ error: "請閱讀並同意會員與隱私權說明後再加入。" }, 400, cors);
  }

  const customer = await db.prepare(`
    INSERT INTO ordering_customers (id,display_name,phone_normalized,phone_display,email)
    VALUES (?,?,?,?,?)
    ON CONFLICT(phone_normalized) DO UPDATE SET
      display_name=excluded.display_name,
      phone_display=excluded.phone_display,
      email=COALESCE(excluded.email,ordering_customers.email),
      updated_at=CURRENT_TIMESTAMP
    RETURNING id,display_name,phone_normalized
  `).bind(uid("customer"), displayName, phone, phone, email || null).first();

  const previousMembership = await db.prepare(`SELECT m.id FROM merchant_memberships m JOIN ordering_customers c ON c.id=m.customer_id WHERE m.merchant_id=? AND c.phone_normalized=? LIMIT 1`).bind(context.merchant_id, phone).first();
  const membership = await db.prepare(`
    INSERT INTO merchant_memberships
      (id,merchant_id,customer_id,membership_no,status,joined_via_qr_id,consent_version,consented_at,visit_count,last_seen_at)
    VALUES (?,?,?,?, 'active',?,?,CURRENT_TIMESTAMP,1,CURRENT_TIMESTAMP)
    ON CONFLICT(merchant_id,customer_id) DO UPDATE SET
      status=CASE WHEN merchant_memberships.status='blocked' THEN 'blocked' ELSE 'active' END,
      joined_via_qr_id=excluded.joined_via_qr_id,
      consent_version=excluded.consent_version,
      consented_at=CURRENT_TIMESTAMP,
      visit_count=merchant_memberships.visit_count+1,
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
      display_name: customer.display_name,
      phone_masked: maskPhone(customer.phone_normalized),
    },
    session,
    coupon,
  }, 201, cors);
}

async function handleMenu(request, db, context, cors) {
  if (!context.enabled) return json({ error: "此商家的掃碼點餐尚未開放。" }, 409, cors);
  const session = await memberSession(db, request, context.merchant_id);
  if (context.require_member && !session) return json({ error: "請先加入會員或重新掃描 QR Code。", code: "MEMBER_REQUIRED" }, 401, cors);
  const [categories, items] = await Promise.all([
    db.prepare(`SELECT id,name,description,sort_order FROM merchant_menu_categories WHERE merchant_id=? AND active=1 ORDER BY sort_order,name`).bind(context.merchant_id).all(),
    db.prepare(`SELECT id,category_id,sku,name,description,price_minor,image_url,sort_order FROM merchant_menu_items WHERE merchant_id=? AND available=1 ORDER BY sort_order,name`).bind(context.merchant_id).all(),
  ]);
  return json({
    context: publicContext(context),
    member: session ? publicMember(session) : null,
    categories: categories.results || [],
    items: (items.results || []).map((item) => ({ ...item, price_minor: Number(item.price_minor) })),
  }, 200, cors);
}

async function handleCreateOrder(request, db, context, cors) {
  if (!context.enabled || context.purpose === "member_only") return json({ error: "此 QR Code 目前不提供點餐。" }, 409, cors);
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
  if (!requestedIds.length || requestedIds.length > MAX_ORDER_LINES) return json({ error: "請選擇至少一項餐點。" }, 400, cors);
  const placeholders = requestedIds.map(() => "?").join(",");
  const catalog = await db.prepare(`
    SELECT id,name,price_minor FROM merchant_menu_items
    WHERE merchant_id=? AND available=1 AND id IN (${placeholders})
  `).bind(context.merchant_id, ...requestedIds).all();
  const calculation = calculateOrderLines(input.items, catalog.results || []);
  if (!calculation.ok) return json({ error: calculation.error }, 409, cors);

  const orderId = uid("foodorder");
  const code = orderCode();
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
        (id,order_code,merchant_id,membership_id,qr_id,table_label,order_type,status,payment_status,payment_method,subtotal_minor,total_minor,customer_note,idempotency_key)
      VALUES (?,?,?,?,?,?,?,'submitted','unpaid','counter',?,?,?,?)
    `).bind(
      orderId, code, context.merchant_id, session.membership_id, context.id, tableLabel,
      orderType, calculation.subtotal_minor, calculation.total_minor, clean(input?.customer_note, 500) || null, idempotencyKey,
    ),
    ...calculation.lines.map((line) => db.prepare(`
      INSERT INTO merchant_food_order_items
        (id,order_id,menu_item_id,name_snapshot,unit_price_minor,quantity,line_total_minor,note)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(uid("fooditem"), orderId, line.menu_item_id, line.name_snapshot, line.unit_price_minor, line.quantity, line.line_total_minor, line.note)),
    ...couponPricing.statements,
    db.prepare(`INSERT INTO merchant_order_pricing(order_id,merchant_id,gross_subtotal_minor,coupon_discount_minor,payable_total_minor,coupon_id,merchant_funded_minor,platform_funded_minor) VALUES(?,?,?,?,?,?,?,0)`).bind(orderId, context.merchant_id, calculation.subtotal_minor, couponPricing.discount, Math.max(calculation.subtotal_minor - couponPricing.discount, 0), couponPricing.couponId, couponPricing.discount),
    db.prepare(`UPDATE merchant_memberships SET order_count=order_count+1,last_seen_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND id=?`).bind(context.merchant_id, session.membership_id),
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
    throw error;
  }

  const order = await orderWithItems(db, context.merchant_id, session.membership_id, code);
  return json({ message: "訂單已送出，請留意店家處理狀態。", order, replayed: false }, 201, cors);
}

async function handleGetOrder(request, db, orderCodeValue, cors) {
  const token = bearer(request);
  if (!token) return json({ error: "會員登入已失效。" }, 401, cors);
  const tokenHash = await hash(token);
  const session = await db.prepare(`
    SELECT s.merchant_id,s.membership_id
    FROM merchant_member_sessions s
    JOIN merchant_memberships m ON m.merchant_id=s.merchant_id AND m.id=s.membership_id
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
    const orderMatch = url.pathname.match(/^\/api\/ordering\/orders\/([^/]+)$/);
    if (orderMatch && request.method === "GET") return handleGetOrder(request, db, orderMatch[1], cors);
    return json({ error: "找不到此掃碼點餐服務。" }, 404, cors);
  } catch (error) {
    console.error(JSON.stringify({ service: "qr_ordering", path: url.pathname, error: error instanceof Error ? error.message : "unknown" }));
    return json({ error: CUSTOMER_ERROR }, 500, cors);
  }
}

async function adminOverview(db, merchantId) {
  const settings = await db.prepare(`SELECT * FROM merchant_ordering_settings WHERE merchant_id=?`).bind(merchantId).first();
  const [qrs, categories, items, orders, memberCount] = await Promise.all([
    db.prepare(`SELECT * FROM merchant_ordering_qr_codes WHERE merchant_id=? ORDER BY created_at DESC`).bind(merchantId).all(),
    db.prepare(`SELECT * FROM merchant_menu_categories WHERE merchant_id=? ORDER BY sort_order,name`).bind(merchantId).all(),
    db.prepare(`SELECT * FROM merchant_menu_items WHERE merchant_id=? ORDER BY sort_order,name`).bind(merchantId).all(),
    db.prepare(`
      SELECT o.*,c.display_name customer_name,c.phone_normalized
      FROM merchant_food_orders o
      JOIN merchant_memberships m ON m.merchant_id=o.merchant_id AND m.id=o.membership_id
      JOIN ordering_customers c ON c.id=m.customer_id
      WHERE o.merchant_id=? ORDER BY datetime(o.created_at) DESC LIMIT 200
    `).bind(merchantId).all(),
    db.prepare(`SELECT COUNT(*) total FROM merchant_memberships WHERE merchant_id=? AND status='active'`).bind(merchantId).first(),
  ]);
  const orderRows = orders.results || [];
  let orderItems = [];
  if (orderRows.length) {
    const ids = orderRows.map((order) => order.id);
    const placeholders = ids.map(() => "?").join(",");
    const result = await db.prepare(`SELECT order_id,name_snapshot,quantity,line_total_minor,note FROM merchant_food_order_items WHERE order_id IN (${placeholders}) ORDER BY created_at,id`).bind(...ids).all();
    orderItems = result.results || [];
  }
  const itemsByOrder = new Map();
  for (const item of orderItems) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push({ ...item, quantity: Number(item.quantity), line_total_minor: Number(item.line_total_minor) });
  }
  return {
    settings: settings ? {
      ...settings,
      enabled: Boolean(settings.enabled),
      dine_in_enabled: Boolean(settings.dine_in_enabled),
      takeaway_enabled: Boolean(settings.takeaway_enabled),
      require_member: Boolean(settings.require_member),
    } : null,
    qrs: (qrs.results || []).map((row) => ({ ...row, active: Boolean(row.active) })),
    categories: (categories.results || []).map((row) => ({ ...row, active: Boolean(row.active) })),
    items: (items.results || []).map((row) => ({ ...row, available: Boolean(row.available), price_minor: Number(row.price_minor) })),
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

export async function handleOrderingAdminRequest(request, env, url, cors = {}, adminAuthorized = false) {
  if (!env.FINANCE_DB) return json({ error: CUSTOMER_ERROR }, 503, cors);
  if (!adminAuthorized) return json({ error: "需要平台管理員授權。" }, 401, cors);
  const db = env.FINANCE_DB;
  const merchantId = validMerchantId(url.searchParams.get("merchant_id"));
  if (!merchantId) return json({ error: "請提供正確的 merchant_id。" }, 400, cors);

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
          (merchant_id,display_name,enabled,currency,dine_in_enabled,takeaway_enabled,require_member,consent_version)
        VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(merchant_id) DO UPDATE SET
          display_name=excluded.display_name,
          enabled=excluded.enabled,
          currency=excluded.currency,
          dine_in_enabled=excluded.dine_in_enabled,
          takeaway_enabled=excluded.takeaway_enabled,
          require_member=excluded.require_member,
          consent_version=excluded.consent_version,
          updated_at=CURRENT_TIMESTAMP
      `).bind(
        merchantId, displayName,
        boolValue(input, "enabled", current?.enabled),
        clean(input.currency ?? current?.currency ?? "TWD", 3).toUpperCase(),
        boolValue(input, "dine_in_enabled", current?.dine_in_enabled ?? true),
        boolValue(input, "takeaway_enabled", current?.takeaway_enabled ?? true),
        1,
        consentVersion,
      ).run();
      await audit(db, merchantId, "admin", "admin", "ordering_settings_saved", "settings", merchantId);
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
      await db.prepare(`UPDATE merchant_menu_categories SET name=?,description=?,sort_order=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND id=?`).bind(name, clean(input.description ?? current.description, 300) || null, Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : Number(current.sort_order), boolValue(input, "active", current.active), merchantId, current.id).run();
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
          (id,merchant_id,category_id,sku,name,description,price_minor,image_url,available,sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).bind(
        id, merchantId, categoryId, clean(input.sku, 80) || null, name,
        clean(input.description, 1000) || null, priceMinor, imageUrl || null,
        input.available === false ? 0 : 1,
        Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : 0,
      ).run();
      await audit(db, merchantId, "admin", "admin", "menu_item_created", "menu_item", id);
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
      await db.prepare(`
        UPDATE merchant_menu_items SET category_id=?,sku=?,name=?,description=?,price_minor=?,image_url=?,available=?,sort_order=?,updated_at=CURRENT_TIMESTAMP
        WHERE merchant_id=? AND id=?
      `).bind(
        categoryId, clean(input.sku ?? current.sku, 80) || null, name,
        clean(input.description ?? current.description, 1000) || null, priceMinor, imageUrl || null,
        boolValue(input, "available", current.available),
        Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : Number(current.sort_order),
        merchantId, current.id,
      ).run();
      await audit(db, merchantId, "admin", "admin", "menu_item_updated", "menu_item", current.id);
      return json({ ok: true }, 200, cors);
    }

    const orderStatusMatch = url.pathname.match(/^\/api\/admin\/ordering\/orders\/([^/]+)\/status$/);
    if (orderStatusMatch && request.method === "PATCH") {
      const current = await db.prepare(`SELECT * FROM merchant_food_orders WHERE merchant_id=? AND order_code=?`).bind(merchantId, clean(orderStatusMatch[1], 40)).first();
      if (!current) return json({ error: "找不到此訂單。" }, 404, cors);
      const input = await request.json();
      const nextStatus = clean(input.status ?? current.status, 30);
      const paymentStatus = clean(input.payment_status ?? current.payment_status, 20);
      if (!canTransitionOrderStatus(current.status, nextStatus)) return json({ error: `訂單無法由 ${current.status} 直接變更為 ${nextStatus}。` }, 409, cors);
      if (!["unpaid", "paid", "refunded"].includes(paymentStatus)) return json({ error: "付款狀態不正確。" }, 400, cors);
      const couponStatements = await couponOrderStateStatements(db, current, nextStatus, paymentStatus);
      await db.batch([db.prepare(`
        UPDATE merchant_food_orders SET
          status=?,payment_status=?,
          accepted_at=CASE WHEN ?='accepted' AND accepted_at IS NULL THEN CURRENT_TIMESTAMP ELSE accepted_at END,
          completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
          cancelled_at=CASE WHEN ?='cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
          updated_at=CURRENT_TIMESTAMP
        WHERE merchant_id=? AND id=?
      `).bind(nextStatus, paymentStatus, nextStatus, nextStatus, nextStatus, merchantId, current.id), ...couponStatements, db.prepare(`INSERT INTO merchant_ordering_audit_logs(id,merchant_id,actor_type,actor_id,action,resource_type,resource_id,metadata) VALUES(?,?,?,?,?,?,?,?)`).bind(uid("ordaudit"), merchantId, "admin", "admin", "order_status_updated", "order", current.id, JSON.stringify({ from: current.status, to: nextStatus, payment_status: paymentStatus }))]);
      return json({ ok: true, status: nextStatus, payment_status: paymentStatus }, 200, cors);
    }

    return json({ error: "找不到此掃碼點餐管理服務。" }, 404, cors);
  } catch (error) {
    console.error(JSON.stringify({ service: "qr_ordering_admin", merchant_id: merchantId, path: url.pathname, error: error instanceof Error ? error.message : "unknown" }));
    return json({ error: "掃碼會員與點餐管理服務暫時無法使用。" }, 500, cors);
  }
}
