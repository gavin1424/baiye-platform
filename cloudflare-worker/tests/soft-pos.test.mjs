import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { handleSoftPosRequest } from "../src/soft-pos.js";

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync(new URL("../migrations", import.meta.url)).filter((x) => /^\d+.*\.sql$/.test(x)).sort()) db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  return db;
}

test("POS01 migration creates a single order-source extension and ledger tables", () => {
  const db = database();
  for (const name of ["merchant_pos_profiles","pos_staff","inventory_items","inventory_locations","inventory_transactions","inventory_balances","inventory_reservations","inventory_recipes","inventory_recipe_items","suppliers","purchase_orders","purchase_order_items","goods_receipts","cash_sessions","cash_movements"]) assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='merchant_food_orders'").get());
  assert.ok(db.prepare("SELECT name FROM pragma_table_info('merchant_food_orders') WHERE name='order_source'").get());
});

test("POS02 inventory is ledger-derived, non-negative and immutable", () => {
  const db = database();
  db.exec("INSERT INTO merchants(id,merchant_code,name) VALUES('m','M','Merchant'); INSERT INTO inventory_locations(id,merchant_id,name) VALUES('l','m','主庫存'); INSERT INTO inventory_items(id,merchant_id,name) VALUES('i','m','雞排');");
  db.prepare("INSERT INTO inventory_transactions(id,merchant_id,location_id,inventory_item_id,transaction_type,quantity_delta_minor,idempotency_key,actor_type) VALUES('t1','m','l','i','purchase',10,'p1','merchant')").run();
  assert.equal(db.prepare("SELECT quantity_minor FROM inventory_balances WHERE merchant_id='m' AND inventory_item_id='i'").get().quantity_minor, 10);
  assert.throws(() => db.prepare("INSERT INTO inventory_transactions(id,merchant_id,location_id,inventory_item_id,transaction_type,quantity_delta_minor,idempotency_key,actor_type) VALUES('t2','m','l','i','sale',-11,'p2','merchant')").run(), /INVENTORY_NEGATIVE_GUARD/);
  assert.throws(() => db.prepare("UPDATE inventory_transactions SET quantity_delta_minor=4 WHERE id='t1'").run(), /INVENTORY_TRANSACTION_IMMUTABLE/);
});

test("POS03 cash session permits one open session per merchant and movements are immutable", () => {
  const db = database();
  db.exec("INSERT INTO merchants(id,merchant_code,name) VALUES('m','M','Merchant'); INSERT INTO cash_sessions(id,merchant_id,opening_float_minor,expected_cash_minor,opened_by) VALUES('c1','m',200000,200000,'owner');");
  assert.throws(() => db.prepare("INSERT INTO cash_sessions(id,merchant_id,opening_float_minor,expected_cash_minor,opened_by) VALUES('c2','m',0,0,'owner')").run(), /UNIQUE/);
  db.prepare("INSERT INTO cash_movements(id,merchant_id,cash_session_id,movement_type,amount_minor,idempotency_key) VALUES('x','m','c1','sale',50000,'cash-1')").run();
  assert.throws(() => db.prepare("DELETE FROM cash_movements WHERE id='x'").run(), /CASH_MOVEMENT_IMMUTABLE/);
});

test("POS04 production printer support stays browser-print only", () => {
  const migration = readFileSync(new URL("../migrations/0018_soft_pos_byod_v1.sql", import.meta.url), "utf8");
  assert.match(migration, /browser_print/);
  assert.match(migration, /bluetooth_escpos_future/);
  assert.doesNotMatch(migration, /bluetooth_escpos_enabled/);
});

class Statement {
  constructor(statement) { this.statement = statement; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async run() { const result = this.statement.run(...this.values); return { meta: { changes: Number(result.changes || 0) } }; }
  async first() { return this.statement.get(...this.values) || null; }
  async all() { return { results: this.statement.all(...this.values) }; }
}

class D1 {
  constructor() {
    this.sqlite = database();
    this.sqlite.prepare("INSERT INTO merchants(id,merchant_code,name,status) VALUES('pos-m','POSM','POS 測試商家','active')").run();
    this.sqlite.prepare("INSERT INTO merchant_ordering_settings(merchant_id,display_name,enabled,accepting_orders) VALUES('pos-m','POS 測試商家',1,1)").run();
    this.sqlite.prepare("INSERT INTO merchant_menu_categories(id,merchant_id,name,active) VALUES('pos-cat','pos-m','招牌',1)").run();
    this.sqlite.prepare("INSERT INTO merchant_menu_items(id,merchant_id,category_id,name,price_minor,status,available) VALUES('pos-item','pos-m','pos-cat','雞排',7000,'active',1)").run();
    this.sqlite.prepare("INSERT INTO merchant_pos_profiles(merchant_id,enabled,soft_pos_enabled,business_mode,kitchen_enabled) VALUES('pos-m',1,1,'food_stall',1)").run();
  }
  prepare(sql) { return new Statement(this.sqlite.prepare(sql)); }
  async batch(statements) { this.sqlite.exec("BEGIN IMMEDIATE"); try { const results = []; for (const statement of statements) results.push(await statement.run()); this.sqlite.exec("COMMIT"); return results; } catch (error) { this.sqlite.exec("ROLLBACK"); throw error; } }
}

const actor = { merchant_id: "pos-m", user_id: "owner-1", roles: "owner" };
const env = (db) => ({ FINANCE_DB: db });
const request = (path, body = {}, key = "soft-pos-key") => new Request(`https://pos.test${path}`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) });

test("POS05 server-priced order uses unified order core, preserves exact manual method and replays idempotently", async () => {
  const db = new D1();
  const body = { items: [{ item_id: "pos-item", quantity: 2, client_price_minor: 1 }], payment_method: "bank_transfer", confirm_payment: true };
  const firstRequest = request("/api/merchant-pos/orders", body, "pos-order-1");
  const first = await handleSoftPosRequest(firstRequest, env(db), new URL(firstRequest.url), {}, actor);
  const created = await first.json();
  assert.equal(first.status, 201);
  assert.equal(created.total_minor, 14000);
  const replayRequest = request("/api/merchant-pos/orders", body, "pos-order-1");
  const replay = await handleSoftPosRequest(replayRequest, env(db), new URL(replayRequest.url), {}, actor);
  assert.equal((await replay.json()).replayed, true);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM merchant_food_orders WHERE merchant_id='pos-m'").get().n, 1);
  const order = db.sqlite.prepare("SELECT order_source,pos_payment_method,payment_status FROM merchant_food_orders").get();
  assert.deepEqual([order.order_source, order.pos_payment_method, order.payment_status], ["merchant_pos", "bank_transfer", "paid"]);
  assert.equal(db.sqlite.prepare("SELECT payment_method FROM payments").get().payment_method, "bank_transfer");
});

test("POS06 option requirements and negative inventory guard reject without creating an order", async () => {
  const db = new D1();
  db.sqlite.prepare("INSERT INTO merchant_menu_option_groups(id,merchant_id,name,selection_type,required,min_select,max_select) VALUES('pos-required','pos-m','辣度','single',1,1,1)").run();
  db.sqlite.prepare("INSERT INTO merchant_menu_option_values(id,merchant_id,group_id,name,price_delta_minor) VALUES('pos-mild','pos-m','pos-required','小辣',0)").run();
  db.sqlite.prepare("INSERT INTO merchant_menu_item_option_groups(merchant_id,menu_item_id,option_group_id) VALUES('pos-m','pos-item','pos-required')").run();
  let call = request("/api/merchant-pos/orders", { items: [{ item_id: "pos-item", quantity: 1 }] }, "option-required");
  assert.equal((await handleSoftPosRequest(call, env(db), new URL(call.url), {}, actor)).status, 422);
  db.sqlite.prepare("INSERT INTO inventory_locations(id,merchant_id,name) VALUES('pos-loc','pos-m','主庫存')").run();
  db.sqlite.prepare("INSERT INTO inventory_items(id,merchant_id,menu_item_id,name) VALUES('pos-stock','pos-m','pos-item','雞排庫存')").run();
  db.sqlite.prepare("INSERT INTO inventory_transactions(id,merchant_id,location_id,inventory_item_id,transaction_type,quantity_delta_minor,idempotency_key,actor_type) VALUES('pos-in','pos-m','pos-loc','pos-stock','purchase',1,'stock-in','merchant')").run();
  call = request("/api/merchant-pos/orders", { items: [{ item_id: "pos-item", quantity: 2, option_value_ids: ["pos-mild"] }] }, "stock-guard");
  const response = await handleSoftPosRequest(call, env(db), new URL(call.url), {}, actor);
  assert.equal(response.status, 409);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM merchant_food_orders").get().n, 0);
});

test("POS07 cash confirmation requires a cash session and cash sessions are kept in the ledger", async () => {
  const db = new D1();
  let call = request("/api/merchant-pos/orders", { items: [{ item_id: "pos-item", quantity: 1 }], payment_method: "cash", confirm_payment: true }, "cash-before-open");
  assert.equal((await handleSoftPosRequest(call, env(db), new URL(call.url), {}, actor)).status, 409);
  call = request("/api/merchant-pos/cash/open", { opening_float_minor: 200000 }, "cash-open");
  assert.equal((await handleSoftPosRequest(call, env(db), new URL(call.url), {}, actor)).status, 201);
  call = request("/api/merchant-pos/orders", { items: [{ item_id: "pos-item", quantity: 1 }], payment_method: "cash", confirm_payment: true }, "cash-sale");
  assert.equal((await handleSoftPosRequest(call, env(db), new URL(call.url), {}, actor)).status, 201);
  assert.equal(db.sqlite.prepare("SELECT amount_minor FROM cash_movements WHERE movement_type='sale'").get().amount_minor, 7000);
});

test("POS08 a normal sale decrements an existing balance without making it negative", () => {
  const db = database();
  db.exec("INSERT INTO merchants(id,merchant_code,name) VALUES('m-sale','MSALE','Merchant'); INSERT INTO inventory_locations(id,merchant_id,name) VALUES('l-sale','m-sale','主庫存'); INSERT INTO inventory_items(id,merchant_id,name) VALUES('i-sale','m-sale','雞排');");
  db.prepare("INSERT INTO inventory_transactions(id,merchant_id,location_id,inventory_item_id,transaction_type,quantity_delta_minor,idempotency_key,actor_type) VALUES('in-sale','m-sale','l-sale','i-sale','purchase',5,'in-sale','merchant')").run();
  db.prepare("INSERT INTO inventory_transactions(id,merchant_id,location_id,inventory_item_id,transaction_type,quantity_delta_minor,idempotency_key,actor_type) VALUES('out-sale','m-sale','l-sale','i-sale','sale',-1,'out-sale','merchant')").run();
  assert.equal(db.prepare("SELECT quantity_minor FROM inventory_balances WHERE merchant_id='m-sale' AND inventory_item_id='i-sale'").get().quantity_minor, 4);
});
