const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const clean = (value, max = 200) => String(value || "").trim().slice(0, max);
const uid = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const tokenHash = async (value) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)))))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const bearer = (request) => String(request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] || "";
const providerGates = Object.freeze({ payments: ["ecpay", "newebpay", "line_pay", "tappay", "gmo", "paypal", "easywallet", "easycard_terminal"], shipping: ["chunghwa_post", "black_cat", "ecpay_cvs", "seven_eleven_b2c_frozen", "paynow", "ezship"], invoice: ["ezpay_invoice", "ecpay_invoice"] });

export function calculateCart(lines) {
  let subtotal = 0;
  for (const line of lines) {
    const quantity = Math.trunc(Number(line.quantity));
    if (quantity < 1 || quantity > 999 || Number(line.price_minor) < 0) throw new Error("INVALID_CART_LINE");
    subtotal += Number(line.price_minor) * quantity;
  }
  return { subtotal_minor: subtotal, discount_minor: 0, shipping_minor: 0, tax_minor: 0, total_minor: subtotal };
}

export async function hasEntitlement(db, merchant, module) {
  const result = await db.prepare(`SELECT COALESCE(o.enabled,e.enabled,0) enabled FROM merchant_subscriptions s LEFT JOIN plan_entitlements e ON e.plan_id=s.plan_id AND e.module_code=? LEFT JOIN merchant_module_overrides o ON o.merchant_id=s.merchant_id AND o.module_code=? AND (o.expires_at IS NULL OR datetime(o.expires_at)>datetime('now')) WHERE s.merchant_id=? AND s.status IN('trial','active')`).bind(module, module, merchant).first();
  return Boolean(result?.enabled);
}

async function authorizedCart(db, merchantId, cartId, request, allowConverted = false) {
  const token = bearer(request);
  if (!token) return null;
  return db.prepare(`SELECT * FROM commerce_carts WHERE id=? AND merchant_id=? AND guest_token_hash=? AND status ${allowConverted ? "IN('active','converted')" : "='active'"} AND datetime(expires_at)>datetime('now')`).bind(cartId, merchantId, await tokenHash(token)).first();
}

export async function transitionStockReservations(db, merchantId, orderId, status) {
  if (!['consumed', 'released', 'expired'].includes(status)) throw new Error("INVALID_RESERVATION_STATUS");
  return db.prepare("UPDATE commerce_stock_reservations SET status=? WHERE merchant_id=? AND order_id=? AND status='active'").bind(status, merchantId, orderId).run();
}

export async function handleCommerce(request, env, url, cors = {}, session = null) {
  const db = env.FINANCE_DB;
  if (!db) return json({ error: "Commerce unavailable" }, 503, cors);
  const cmsResponse = await handleCms(request, env, url, cors, session);
  if (cmsResponse) return cmsResponse;
  const publicRoute = url.pathname.startsWith("/api/commerce/public/");
  if (!publicRoute && !session) return json({ error: "需要商家登入" }, 401, cors);
  const merchant = publicRoute ? clean(url.pathname.split("/")[4], 100) : session.merchant_id;

  if (url.pathname === "/api/commerce/dashboard" && request.method === "GET") {
    const [products, orders, customers, entitlements] = await Promise.all([
      db.prepare("SELECT COUNT(*) n FROM commerce_products WHERE merchant_id=?").bind(merchant).first(),
      db.prepare("SELECT COUNT(*) n,COALESCE(SUM(total_minor),0) revenue FROM commerce_orders WHERE merchant_id=? AND status NOT IN('draft','cancelled')").bind(merchant).first(),
      db.prepare("SELECT COUNT(*) n FROM merchant_customer_profiles WHERE merchant_id=?").bind(merchant).first(),
      db.prepare(`SELECT pm.code module_code,COALESCE(o.enabled,pe.enabled,0) enabled FROM platform_modules pm LEFT JOIN merchant_subscriptions s ON s.merchant_id=? AND s.status IN('trial','active') LEFT JOIN plan_entitlements pe ON pe.plan_id=s.plan_id AND pe.module_code=pm.code LEFT JOIN merchant_module_overrides o ON o.merchant_id=? AND o.module_code=pm.code AND (o.expires_at IS NULL OR datetime(o.expires_at)>datetime('now'))`).bind(merchant, merchant).all(),
    ]);
    return json({ products: products.n, orders: orders.n, revenue_minor: orders.revenue, customers: customers.n, modules: Object.fromEntries((entitlements.results || []).map((item) => [item.module_code, Boolean(item.enabled)])) }, 200, cors);
  }

  if (url.pathname === "/api/commerce/pages" && request.method === "GET") {
    const result = await db.prepare("SELECT * FROM merchant_site_pages WHERE merchant_id=? ORDER BY updated_at DESC").bind(merchant).all();
    return json({ items: result.results || [] }, 200, cors);
  }
  if (url.pathname === "/api/commerce/pages" && request.method === "POST") {
    if (!await hasEntitlement(db, merchant, "cms")) return json({ error: "MODULE_NOT_ENTITLED" }, 403, cors);
    const body = await request.json(); const id = uid("page"); const site = await db.prepare("SELECT id FROM merchant_sites WHERE merchant_id=?").bind(merchant).first();
    if (!site) return json({ error: "Site not configured" }, 409, cors);
    await db.batch([
      db.prepare("INSERT INTO merchant_site_pages(id,merchant_id,site_id,slug,title,page_type,status) VALUES(?,?,?,?,?,?,'draft')").bind(id, merchant, site.id, clean(body.slug, 120), clean(body.title, 160), clean(body.page_type, 30) || "standard"),
      db.prepare("INSERT INTO merchant_page_versions(id,merchant_id,page_id,version_no,content_hash,created_by) VALUES(?,?,?,1,?,?)").bind(uid("pagever"), merchant, id, clean(body.content_hash, 100) || "empty", session.user_id),
    ]);
    return json({ id, status: "draft" }, 201, cors);
  }
  const publish = url.pathname.match(/^\/api\/commerce\/pages\/([^/]+)\/publish$/);
  if (publish && request.method === "POST") {
    const body = await request.json().catch(() => ({})); const page = await db.prepare("SELECT * FROM merchant_site_pages WHERE id=? AND merchant_id=?").bind(publish[1], merchant).first();
    if (!page) return json({ error: "Not found" }, 404, cors);
    const version = await db.prepare("SELECT id FROM merchant_page_versions WHERE page_id=? ORDER BY version_no DESC LIMIT 1").bind(page.id).first();
    await db.batch([
      db.prepare("UPDATE merchant_site_pages SET status=?,publish_at=?,unpublish_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?").bind(body.publish_at && new Date(body.publish_at) > new Date() ? "scheduled" : "published", body.publish_at || new Date().toISOString(), body.unpublish_at || null, page.id, merchant),
      db.prepare("INSERT INTO merchant_site_publications(id,merchant_id,page_id,version_id,published_at,created_by) VALUES(?,?,?,?,?,?)").bind(uid("publication"), merchant, page.id, version.id, body.publish_at || new Date().toISOString(), session.user_id),
    ]);
    return json({ ok: true }, 200, cors);
  }

  if (url.pathname === "/api/commerce/products" && request.method === "GET") {
    const result = await db.prepare("SELECT p.*,COUNT(v.id) variant_count FROM commerce_products p LEFT JOIN commerce_product_variants v ON v.product_id=p.id WHERE p.merchant_id=? GROUP BY p.id ORDER BY p.updated_at DESC").bind(merchant).all();
    return json({ items: result.results || [] }, 200, cors);
  }
  if (url.pathname === "/api/commerce/products" && request.method === "POST") {
    if (!await hasEntitlement(db, merchant, "catalog")) return json({ error: "MODULE_NOT_ENTITLED" }, 403, cors);
    const body = await request.json(); const id = uid("product"); const variantId = uid("variant"); const price = Math.trunc(Number(body.price_minor));
    if (!clean(body.title) || !clean(body.slug) || price < 0) return json({ error: "Invalid product" }, 400, cors);
    await db.batch([
      db.prepare("INSERT INTO commerce_products(id,merchant_id,title,slug,product_type,status,description) VALUES(?,?,?,?,?,'draft',?)").bind(id, merchant, clean(body.title, 160), clean(body.slug, 120), clean(body.product_type, 30) || "physical", clean(body.description, 2000) || null),
      db.prepare("INSERT INTO commerce_product_variants(id,merchant_id,product_id,sku,title,price_minor,active) VALUES(?,?,?,?,?,?,0)").bind(variantId, merchant, id, clean(body.sku, 100) || null, clean(body.variant_title, 160) || "預設", price),
    ]);
    return json({ id, variant_id: variantId, status: "draft" }, 201, cors);
  }

  if (url.pathname === "/api/commerce/inventory/movements" && request.method === "POST") {
    const body = await request.json(); const key = request.headers.get("idempotency-key") || "";
    if (key.length < 8) return json({ error: "Idempotency-Key required" }, 400, cors);
    const item = await db.prepare("SELECT * FROM commerce_inventory_items WHERE id=? AND merchant_id=?").bind(clean(body.inventory_item_id, 120), merchant).first();
    if (!item) return json({ error: "Not found" }, 404, cors);
    const quantity = Math.trunc(Number(body.quantity));
    if (!quantity || Number(item.on_hand) + quantity < Number(item.reserved)) return json({ error: "Invalid inventory movement" }, 409, cors);
    await db.batch([
      db.prepare("INSERT INTO commerce_inventory_movements(id,merchant_id,inventory_item_id,movement_type,quantity,reference_type,reference_id,idempotency_key,created_by) VALUES(?,?,?,?,?,?,?,?,?)").bind(uid("movement"), merchant, item.id, clean(body.movement_type, 30), quantity, clean(body.reference_type, 30) || null, clean(body.reference_id, 120) || null, key, session.user_id),
      db.prepare("UPDATE commerce_inventory_items SET on_hand=on_hand+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?").bind(quantity, item.id, merchant),
    ]);
    return json({ ok: true }, 201, cors);
  }

  const createCart = url.pathname.match(/^\/api\/commerce\/public\/([^/]+)\/carts$/);
  if (createCart && request.method === "POST") {
    const id = uid("cart"); const token = crypto.randomUUID();
    await db.prepare("INSERT INTO commerce_carts(id,merchant_id,guest_token_hash,status,expires_at) VALUES(?,?,?,'active',datetime('now','+7 days'))").bind(id, merchant, await tokenHash(token)).run();
    return json({ id, guest_token: token }, 201, cors);
  }
  const cartPath = url.pathname.match(/^\/api\/commerce\/public\/([^/]+)\/carts\/([^/]+)$/);
  if (cartPath && request.method === "GET") {
    const cart = await authorizedCart(db, merchant, cartPath[2], request, true);
    if (!cart) return json({ error: "CART_TOKEN_INVALID" }, 401, cors);
    const lines = await db.prepare("SELECT i.id,i.variant_id,i.quantity,v.title,v.price_minor FROM commerce_cart_items i JOIN commerce_product_variants v ON v.id=i.variant_id AND v.merchant_id=i.merchant_id WHERE i.cart_id=? AND i.merchant_id=? ORDER BY i.created_at").bind(cart.id, merchant).all();
    return json({ cart, items: lines.results || [] }, 200, cors);
  }
  const itemCollection = url.pathname.match(/^\/api\/commerce\/public\/([^/]+)\/carts\/([^/]+)\/items$/);
  if (itemCollection && request.method === "POST") {
    const cart = await authorizedCart(db, merchant, itemCollection[2], request);
    if (!cart) return json({ error: "CART_TOKEN_INVALID" }, 401, cors);
    const body = await request.json(); const quantity = Math.trunc(Number(body.quantity));
    if (quantity < 1 || quantity > 999) return json({ error: "INVALID_QUANTITY" }, 400, cors);
    const variant = await db.prepare("SELECT id FROM commerce_product_variants WHERE id=? AND merchant_id=? AND active=1").bind(clean(body.variant_id, 120), merchant).first();
    if (!variant) return json({ error: "Product unavailable" }, 409, cors);
    await db.prepare("INSERT INTO commerce_cart_items(id,merchant_id,cart_id,variant_id,quantity) VALUES(?,?,?,?,?) ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=excluded.quantity,updated_at=CURRENT_TIMESTAMP").bind(uid("cartitem"), merchant, cart.id, variant.id, quantity).run();
    return json({ ok: true }, 200, cors);
  }
  const cartItem = url.pathname.match(/^\/api\/commerce\/public\/([^/]+)\/carts\/([^/]+)\/items\/([^/]+)$/);
  if (cartItem && ["PATCH", "DELETE"].includes(request.method)) {
    const cart = await authorizedCart(db, merchant, cartItem[2], request);
    if (!cart) return json({ error: "CART_TOKEN_INVALID" }, 401, cors);
    if (request.method === "DELETE") await db.prepare("DELETE FROM commerce_cart_items WHERE id=? AND cart_id=? AND merchant_id=?").bind(cartItem[3], cart.id, merchant).run();
    else {
      const body = await request.json(); const quantity = Math.trunc(Number(body.quantity));
      if (quantity < 1 || quantity > 999) return json({ error: "INVALID_QUANTITY" }, 400, cors);
      await db.prepare("UPDATE commerce_cart_items SET quantity=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND cart_id=? AND merchant_id=?").bind(quantity, cartItem[3], cart.id, merchant).run();
    }
    return json({ ok: true }, 200, cors);
  }

  const checkout = url.pathname.match(/^\/api\/commerce\/public\/([^/]+)\/checkout$/);
  if (checkout && request.method === "POST") {
    const body = await request.json(); const key = request.headers.get("idempotency-key") || "";
    if (key.length < 8 || body.terms_consent !== true) return json({ error: "Idempotency and consent required" }, 400, cors);
    const cart = await authorizedCart(db, merchant, clean(body.cart_id, 120), request, true);
    if (!cart) return json({ error: "CART_TOKEN_INVALID" }, 401, cors);
    const replay = await db.prepare("SELECT id,order_no,total_minor,status FROM commerce_orders WHERE merchant_id=? AND idempotency_key=?").bind(merchant, key).first();
    if (replay) return json({ order: replay, replayed: true }, 200, cors);
    if (cart.status !== "active") return json({ error: "CART_NOT_ACTIVE" }, 409, cors);
    const rows = (await db.prepare(`SELECT i.variant_id,i.quantity,v.product_id,v.sku,v.title,v.price_minor,v.active,p.product_type,p.status product_status,p.publish_at,p.unpublish_at,(SELECT ii.id FROM commerce_inventory_items ii WHERE ii.variant_id=i.variant_id AND ii.merchant_id=i.merchant_id ORDER BY ii.id LIMIT 1) inventory_item_id FROM commerce_cart_items i JOIN commerce_product_variants v ON v.id=i.variant_id AND v.merchant_id=i.merchant_id JOIN commerce_products p ON p.id=v.product_id AND p.merchant_id=v.merchant_id WHERE i.cart_id=? AND i.merchant_id=?`).bind(cart.id, merchant).all()).results || [];
    const now = new Date();
    if (!rows.length || rows.some((row) => !row.active || !["active", "published"].includes(row.product_status) || (row.publish_at && new Date(row.publish_at) > now) || (row.unpublish_at && new Date(row.unpublish_at) <= now))) return json({ error: "Cart unavailable" }, 409, cors);
    if (rows.some((row) => row.product_type === "physical" && !row.inventory_item_id)) return json({ error: "INVENTORY_NOT_CONFIGURED" }, 409, cors);
    const pricing = calculateCart(rows.map((row) => ({ quantity: row.quantity, price_minor: row.price_minor })));
    const orderId = uid("order"); const orderNo = `CO-${Date.now().toString(36).toUpperCase()}`;
    const statements = [
      ...rows.filter((row) => row.inventory_item_id).map((row) => db.prepare("INSERT INTO commerce_stock_reservations(id,merchant_id,inventory_item_id,cart_id,order_id,quantity,status,expires_at,idempotency_key) VALUES(?,?,?,?,?,?,'active',datetime('now','+30 minutes'),?)").bind(uid("reservation"), merchant, row.inventory_item_id, cart.id, orderId, row.quantity, `${key}:${row.variant_id}`)),
      db.prepare("INSERT INTO commerce_orders(id,merchant_id,order_no,channel,status,currency,subtotal_minor,discount_minor,shipping_minor,tax_minor,total_minor,idempotency_key) VALUES(?,?,?,'web','pending_payment','TWD',?,?,?,?,?,?)").bind(orderId, merchant, orderNo, pricing.subtotal_minor, pricing.discount_minor, pricing.shipping_minor, pricing.tax_minor, pricing.total_minor, key),
      ...rows.map((row) => db.prepare("INSERT INTO commerce_order_items(id,merchant_id,order_id,product_id,variant_id,sku_snapshot,title_snapshot,unit_price_minor,quantity,line_total_minor) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(uid("orderitem"), merchant, orderId, row.product_id, row.variant_id, row.sku, row.title, row.price_minor, row.quantity, row.price_minor * row.quantity)),
      db.prepare("INSERT INTO commerce_order_pricing_snapshots(order_id,merchant_id,pricing_json,calculation_version,content_hash) VALUES(?,?,?,'commerce-v1',?)").bind(orderId, merchant, JSON.stringify(pricing), key),
      db.prepare("UPDATE commerce_carts SET status='converted',updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=? AND status='active'").bind(cart.id, merchant),
    ];
    try { await db.batch(statements); }
    catch (error) { if (String(error?.message || error).includes("INSUFFICIENT_STOCK")) return json({ error: "INSUFFICIENT_STOCK" }, 409, cors); throw error; }
    return json({ order: { id: orderId, order_no: orderNo, ...pricing, status: "pending_payment" } }, 201, cors);
  }

  if (url.pathname === "/api/commerce/events" && request.method === "POST") {
    const body = await request.json(); const key = request.headers.get("idempotency-key") || "";
    if (key.length < 8) return json({ error: "Idempotency-Key required" }, 400, cors);
    await db.prepare("INSERT OR IGNORE INTO commerce_events(id,merchant_id,event_type,session_id,anonymous_id_hash,page_path,entity_type,entity_id,idempotency_key,occurred_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(uid("event"), merchant, clean(body.event_type, 50), clean(body.session_id, 120) || null, clean(body.anonymous_id_hash, 120) || null, clean(body.page_path, 300) || null, clean(body.entity_type, 50) || null, clean(body.entity_id, 120) || null, key, body.occurred_at || new Date().toISOString()).run();
    return json({ ok: true }, 202, cors);
  }
  if (url.pathname === "/api/commerce/provider-status" && request.method === "GET") return json({ payments: providerGates.payments.map((provider) => ({ provider, status: "disabled" })), shipping: providerGates.shipping.map((provider) => ({ provider, status: "disabled" })), invoice: providerGates.invoice.map((provider) => ({ provider, status: "disabled" })), shopee_import: "disabled", two_factor: "disabled" }, 200, cors);
  return json({ error: "Not found" }, 404, cors);
}
import { handleCms } from "./cms-core.js";
