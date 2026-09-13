import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const eventDb = () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=OFF; CREATE TABLE merchants(id TEXT PRIMARY KEY); CREATE TABLE merchant_food_orders(merchant_id TEXT NOT NULL,id TEXT NOT NULL,PRIMARY KEY(merchant_id,id)); CREATE TABLE printers(merchant_id TEXT NOT NULL,id TEXT NOT NULL,PRIMARY KEY(merchant_id,id));");
  db.exec(read("migrations/0035_merchant_order_realtime_v1.sql"));
  db.exec("INSERT INTO merchants(id) VALUES('merchant-a'),('merchant-b'); INSERT INTO merchant_food_orders(merchant_id,id) VALUES('merchant-a','order-1'),('merchant-a','o1'),('merchant-b','o2');");
  return db;
};

test("realtime migration is an append-only cursor over canonical orders", () => {
  const sql = read("migrations/0035_merchant_order_realtime_v1.sql");
  assert.match(sql, /sequence INTEGER PRIMARY KEY AUTOINCREMENT/);
  assert.match(sql, /REFERENCES merchant_food_orders\(merchant_id,id\)/);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS .*orders \(/);
});

test("order-created events are database-idempotent", () => {
  const db = eventDb();
  const insert = db.prepare("INSERT INTO merchant_order_events(event_id,merchant_id,event_type,order_id,order_code) VALUES(?,?,?,?,?)");
  insert.run("event-1", "merchant-a", "order_created", "order-1", "A-1");
  assert.throws(() => insert.run("event-2", "merchant-a", "order_created", "order-1", "A-1"));
  assert.equal(db.prepare("SELECT COUNT(*) count FROM merchant_order_events").get().count, 1);
});

test("events are isolated and replayed with a monotonic cursor", () => {
  const db = eventDb();
  const insert = db.prepare("INSERT INTO merchant_order_events(event_id,merchant_id,event_type,order_id,order_code) VALUES(?,?,?,?,?)");
  insert.run("e1", "merchant-a", "order_created", "o1", "A-1");
  insert.run("e2", "merchant-b", "order_created", "o2", "B-1");
  insert.run("e3", "merchant-a", "order_status_updated", "o1", "A-1");
  const rows = db.prepare("SELECT sequence,event_id FROM merchant_order_events WHERE merchant_id=? AND sequence>? ORDER BY sequence").all("merchant-a", 1);
  assert.deepEqual(rows.map((row) => row.event_id), ["e3"]);
});

test("worker publishes WebSocket events only after canonical commit", () => {
  const ordering = read("src/qr-ordering.js");
  assert.match(ordering, /await db\.batch\(statements\)[\s\S]*SELECT \* FROM merchant_order_events[\s\S]*publishMerchantOrderEvent/);
  assert.match(ordering, /order_status_updated/);
  assert.match(ordering, /order_payment_updated/);
});

test("merchant identity comes from authenticated session", () => {
  const events = read("src/merchant-order-events.js");
  assert.match(events, /authorizeMerchant\(request, env/);
  assert.match(events, /const merchantId = auth\.session\.merchant_id/);
  assert.doesNotMatch(events, /searchParams\.get\("merchant_id"\)/);
});

test("Android uses WebSocket plus cursor reconciliation", () => {
  const api = read("../android/app/src/main/java/com/baiye/merchantprinter/network/MerchantApi.kt");
  const service = read("../android/app/src/main/java/com/baiye/merchantprinter/service/PrintService.kt");
  assert.match(api, /connectOrderEvents/);
  assert.match(api, /orderEvents\(after/);
  assert.match(service, /api\.orderEvents\(store\.lastEventSequence\(\)\)/);
});

test("auto-print OFF still receives orders but cannot auto-claim", () => {
  const service = read("../android/app/src/main/java/com/baiye/merchantprinter/service/PrintService.kt");
  assert.match(service, /consumeOrderEvent/);
  assert.match(service, /if \(!printer\.canAutoClaim\)/);
  assert.match(service, /return/);
});

test("realtime order event triggers the guarded auto-print path immediately", () => {
  const service = read("../android/app/src/main/java/com/baiye/merchantprinter/service/PrintService.kt");
  assert.match(service, /event\.eventType == "order_created"[\s\S]*printer\(\)\?\.canAutoClaim == true[\s\S]*safeSync\(\)/);
});

test("manual print and reprint remain explicit and reprints are visibly labelled", () => {
  const printing = read("src/merchant-printing.js");
  const renderer = read("../android/app/src/main/java/com/baiye/merchantprinter/printer/EscPosRenderer.kt");
  assert.match(printing, /input\.manual === true/);
  assert.match(printing, /reprint_sequence/);
  assert.match(renderer, /【補印】/);
});

test("B mode migration enables only the official beef-noodle merchant", () => {
  const sql = read("migrations/0036_b_scheme_one_tap_orders_v1.sql");
  assert.match(sql, /accepted_by TEXT/);
  assert.match(sql, /completed_by TEXT/);
  assert.match(sql, /WHERE merchant_id='demo_beef_noodle'/);
  assert.doesNotMatch(sql, /UPDATE merchant_ordering_settings\s+SET auto_accept_orders=1\s*;/);
});

test("Android B mode exposes one completion action and server payment confirmation", () => {
  const ui = read("../android/app/src/main/java/com/baiye/merchantprinter/DiningSpiritApp.kt");
  const api = read("../android/app/src/main/java/com/baiye/merchantprinter/network/MerchantApi.kt");
  assert.match(ui, /完成訂單/);
  assert.match(ui, /現金已收款並完成/);
  assert.match(ui, /只完成訂單/);
  assert.match(ui, /api\.confirmPayment[\s\S]*api\.completeOrder/);
  assert.match(api, /\/complete/);
});
