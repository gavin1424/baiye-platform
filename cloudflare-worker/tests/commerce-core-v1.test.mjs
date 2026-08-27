import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { handleCommerce, calculateCart, hasEntitlement, transitionStockReservations } from "../src/commerce-core.js";
import { PAYMENT_PROVIDERS, SHIPPING_PROVIDERS, INVOICE_PROVIDERS, assertProviderEnabled } from "../src/commerce-providers.js";

class D1Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  first() { return this.db.prepare(this.sql).get(...this.values) || null; }
  all() { return { results: this.db.prepare(this.sql).all(...this.values) }; }
  run() { const result = this.db.prepare(this.sql).run(...this.values); return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; }
}

class D1Database {
  constructor(db) { this.db = db; }
  prepare(sql) { return new D1Statement(this.db, sql); }
  batch(statements) {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = statements.map((statement) => statement.run()); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
}

function migrationFiles() {
  const root = path.resolve("cloudflare-worker/migrations");
  return fs.readdirSync(root).filter((file) => /^\d+.*\.sql$/.test(file)).sort().map((file) => path.join(root, file));
}

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const file of migrationFiles()) sqlite.exec(fs.readFileSync(file, "utf8"));
  sqlite.exec(`
    INSERT INTO merchants(id,merchant_code,name,status) VALUES
      ('merchant_a','COMMERCEA','Commerce A','active'),
      ('merchant_b','COMMERCEB','Commerce B','active');
    INSERT INTO platform_plans(id,code,name,status) VALUES('plan_v1','commerce_v1','Commerce V1','active');
    INSERT INTO platform_modules(code,name) VALUES
      ('cms','CMS'),('catalog','Catalog'),('inventory','Inventory'),('orders','Orders');
    INSERT INTO plan_entitlements(plan_id,module_code,enabled) SELECT 'plan_v1',code,1 FROM platform_modules;
    INSERT INTO merchant_subscriptions(id,merchant_id,plan_id,status,starts_at) VALUES
      ('sub_a','merchant_a','plan_v1','active',CURRENT_TIMESTAMP),
      ('sub_b','merchant_b','plan_v1','active',CURRENT_TIMESTAMP);
    INSERT INTO merchant_sites(id,merchant_id,name,status) VALUES
      ('site_a','merchant_a','Site A','draft'),('site_b','merchant_b','Site B','draft');
  `);
  return { sqlite, d1: new D1Database(sqlite) };
}

function request(pathname, method = "GET", body, headers = {}) {
  return new Request(`https://commerce.test${pathname}`, { method, headers: { origin: "https://commerce.test", "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function call(db, pathname, method = "GET", body, merchant = "merchant_a", headers = {}) {
  const req = request(pathname, method, body, headers);
  const response = await handleCommerce(req, { FINANCE_DB: db }, new URL(req.url), {}, pathname.includes("/public/") ? null : { merchant_id: merchant, user_id: `user_${merchant}` });
  return { response, body: await response.json() };
}

test("all commerce migrations apply to a foreign-key enabled D1-compatible database", () => {
  const { sqlite } = database();
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'commerce_%'").all();
  assert.ok(tables.length >= 25);
  assert.equal(sqlite.prepare("PRAGMA foreign_key_check").all().length, 0);
});

test("cart pricing uses integer minor units and rejects invalid lines", () => {
  assert.deepEqual(calculateCart([{ price_minor: 9900, quantity: 2 }]), { subtotal_minor: 19800, discount_minor: 0, shipping_minor: 0, tax_minor: 0, total_minor: 19800 });
  assert.throws(() => calculateCart([{ price_minor: -1, quantity: 1 }]), /INVALID_CART_LINE/);
});

test("entitlements are resolved server-side per merchant", async () => {
  const { d1, sqlite } = database();
  assert.equal(await hasEntitlement(d1, "merchant_a", "catalog"), true);
  sqlite.prepare("UPDATE plan_entitlements SET enabled=0 WHERE plan_id='plan_v1' AND module_code='catalog'").run();
  assert.equal(await hasEntitlement(d1, "merchant_a", "catalog"), false);
});

test("merchant product and page APIs isolate tenants", async () => {
  const { d1 } = database();
  const product = await call(d1, "/api/commerce/products", "POST", { title: "A 商品", slug: "a-product", price_minor: 15000 });
  assert.equal(product.response.status, 201);
  const a = await call(d1, "/api/commerce/products", "GET", undefined, "merchant_a");
  const b = await call(d1, "/api/commerce/products", "GET", undefined, "merchant_b");
  assert.equal(a.body.items.length, 1);
  assert.equal(b.body.items.length, 0);
  const page = await call(d1, "/api/commerce/pages", "POST", { title: "一頁式", slug: "landing", content_hash: "sha256-content" });
  assert.equal(page.response.status, 201);
  const denied = await call(d1, `/api/commerce/pages/${page.body.id}/publish`, "POST", {}, "merchant_b");
  assert.equal(denied.response.status, 404);
});

test("checkout recalculates price from variants and replays idempotently", async () => {
  const { d1, sqlite } = database();
  const product = await call(d1, "/api/commerce/products", "POST", { title: "正式商品", slug: "real-price", product_type: "digital", price_minor: 12345 });
  sqlite.prepare("UPDATE commerce_product_variants SET active=1 WHERE id=?").run(product.body.variant_id);
  sqlite.prepare("UPDATE commerce_products SET status='active' WHERE id=?").run(product.body.id);
  const cart = await call(d1, "/api/commerce/public/merchant_a/carts", "POST", {});
  const auth = { authorization: `Bearer ${cart.body.guest_token}` };
  const denied = await call(d1, `/api/commerce/public/merchant_a/carts/${cart.body.id}/items`, "POST", { variant_id: product.body.variant_id, quantity: 2 });
  assert.equal(denied.response.status, 401);
  await call(d1, `/api/commerce/public/merchant_a/carts/${cart.body.id}/items`, "POST", { variant_id: product.body.variant_id, quantity: 2 }, "merchant_a", auth);
  const payload = { cart_id: cart.body.id, terms_consent: true, total_minor: 1 };
  const first = await call(d1, "/api/commerce/public/merchant_a/checkout", "POST", payload, "merchant_a", { ...auth, "idempotency-key": "checkout-test-0001" });
  const replay = await call(d1, "/api/commerce/public/merchant_a/checkout", "POST", payload, "merchant_a", { ...auth, "idempotency-key": "checkout-test-0001" });
  assert.equal(first.response.status, 201);
  assert.equal(first.body.order.total_minor, 24690);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM commerce_orders").get().n, 1);
});

test("inventory movement is idempotent and immutable", async () => {
  const { d1, sqlite } = database();
  const product = await call(d1, "/api/commerce/products", "POST", { title: "庫存商品", slug: "stock", price_minor: 5000 });
  sqlite.prepare("INSERT INTO commerce_inventory_locations(id,merchant_id,name,active) VALUES('loc_a','merchant_a','倉庫',1)").run();
  sqlite.prepare("INSERT INTO commerce_inventory_items(id,merchant_id,variant_id,location_id,on_hand,reserved) VALUES('inv_a','merchant_a',?,'loc_a',0,0)").run(product.body.variant_id);
  const first = await call(d1, "/api/commerce/inventory/movements", "POST", { inventory_item_id: "inv_a", movement_type: "receive", quantity: 10 }, "merchant_a", { "idempotency-key": "stock-move-0001" });
  assert.equal(first.response.status, 201);
  await assert.rejects(() => call(d1, "/api/commerce/inventory/movements", "POST", { inventory_item_id: "inv_a", movement_type: "receive", quantity: 10 }, "merchant_a", { "idempotency-key": "stock-move-0001" }));
  assert.throws(() => sqlite.prepare("UPDATE commerce_inventory_movements SET quantity=20 WHERE id=(SELECT id FROM commerce_inventory_movements LIMIT 1)").run(), /immutable/i);
});

test("analytics event is idempotent and stores no submitted customer PII", async () => {
  const { d1, sqlite } = database();
  const event = { merchant_id: "merchant_a", event_type: "product_view", page_path: "/p/item", email: "must-not-store@example.com" };
  await call(d1, "/api/commerce/events", "POST", event, "merchant_a", { "idempotency-key": "event-test-0001" });
  await call(d1, "/api/commerce/events", "POST", event, "merchant_a", { "idempotency-key": "event-test-0001" });
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM commerce_events").get().n, 1);
  assert.equal(JSON.stringify(sqlite.prepare("SELECT * FROM commerce_events").get()).includes("must-not-store"), false);
});

test("every external provider remains disabled until reviewed credentials exist", () => {
  for (const provider of [...PAYMENT_PROVIDERS, ...SHIPPING_PROVIDERS, ...INVOICE_PROVIDERS]) {
    assert.equal(provider.enabled, false);
    assert.equal(provider.productionReady, false);
    assert.throws(() => assertProviderEnabled(provider), /PROVIDER_NOT_READY/);
  }
});

test("two carts racing for the last physical unit produce one order and one stock conflict", async () => {
  const { d1, sqlite } = database();
  const product = await call(d1, "/api/commerce/products", "POST", { title: "最後一件", slug: "last-unit", product_type: "physical", price_minor: 30000 });
  sqlite.prepare("UPDATE commerce_products SET status='active' WHERE id=?").run(product.body.id);
  sqlite.prepare("UPDATE commerce_product_variants SET active=1 WHERE id=?").run(product.body.variant_id);
  sqlite.prepare("INSERT INTO commerce_inventory_locations(id,merchant_id,name,active) VALUES('race_loc','merchant_a','Race',1)").run();
  sqlite.prepare("INSERT INTO commerce_inventory_items(id,merchant_id,variant_id,location_id,on_hand,reserved) VALUES('race_inv','merchant_a',?,'race_loc',1,0)").run(product.body.variant_id);
  const carts = await Promise.all([call(d1, "/api/commerce/public/merchant_a/carts", "POST", {}), call(d1, "/api/commerce/public/merchant_a/carts", "POST", {})]);
  for (const cart of carts) await call(d1, `/api/commerce/public/merchant_a/carts/${cart.body.id}/items`, "POST", { variant_id: product.body.variant_id, quantity: 1 }, "merchant_a", { authorization: `Bearer ${cart.body.guest_token}` });
  const results = await Promise.all(carts.map((cart, index) => call(d1, "/api/commerce/public/merchant_a/checkout", "POST", { cart_id: cart.body.id, terms_consent: true }, "merchant_a", { authorization: `Bearer ${cart.body.guest_token}`, "idempotency-key": `race-checkout-${index}` })));
  assert.deepEqual(results.map((result) => result.response.status).sort(), [201, 409]);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM commerce_orders").get().n, 1);
  assert.equal(sqlite.prepare("SELECT reserved FROM commerce_inventory_items WHERE id='race_inv'").get().reserved, 1);
  const order = sqlite.prepare("SELECT id FROM commerce_orders").get();
  await transitionStockReservations(d1, "merchant_a", order.id, "consumed");
  const remainingInventory = sqlite.prepare("SELECT on_hand,reserved FROM commerce_inventory_items WHERE id='race_inv'").get();
  assert.equal(remainingInventory.on_hand, 0);
  assert.equal(remainingInventory.reserved, 0);
});
