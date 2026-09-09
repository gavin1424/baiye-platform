import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { buildKitchenPayload, retryDelaySeconds, RETRY_DELAYS_SECONDS } from "../src/merchant-printing.js";

const migration = readFileSync(new URL("../migrations/0027_xprinter_android_app_v1.sql", import.meta.url), "utf8");
const worker = readFileSync(new URL("../src/merchant-printing.js", import.meta.url), "utf8");
const ordering = readFileSync(new URL("../src/qr-ordering.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("migration adds merchant-owned printer queue tables", () => {
  for (const table of ["printers", "print_jobs", "print_job_attempts"]) assert.match(migration, new RegExp(`CREATE TABLE ${table}`));
  assert.match(migration, /FOREIGN KEY\(merchant_id,order_id\) REFERENCES merchant_food_orders\(merchant_id,id\)/);
});

test("original print task has database-level deduplication while reprints remain explicit", () => {
  assert.match(migration, /CREATE UNIQUE INDEX uq_print_job_original[\s\S]*merchant_id,order_code,printer_id,print_type[\s\S]*reprint_sequence=0/);
  assert.match(migration, /reprint_reason TEXT/); assert.match(migration, /reprint_operator TEXT/); assert.match(migration, /reprint_requested_at TEXT/);
});

test("new order and print job are committed in the same D1 batch", () => {
  const batch = ordering.indexOf("await db.batch(statements)");
  assert.ok(ordering.indexOf("INSERT OR IGNORE INTO print_jobs") < batch);
  assert.ok(ordering.indexOf("INSERT INTO merchant_food_orders") < batch);
});

test("printer registration never backfills old orders", () => {
  assert.doesNotMatch(worker, /reconcileRecentCanonicalOrders/);
  assert.doesNotMatch(worker, /reconciled_jobs/);
  assert.doesNotMatch(worker, /datetime\(o\.created_at\)>=datetime\('now','-24 hours'\)/);
});

test("retry schedule is bounded", () => {
  assert.deepEqual(RETRY_DELAYS_SECONDS, [5, 15, 30, 60]);
  assert.deepEqual([1, 2, 3, 4, 99].map(retryDelaySeconds), [5, 15, 30, 60, 60]);
  assert.match(worker, /attempt_count<4/);
});

test("ambiguous delivery cannot return to automatic polling", () => {
  assert.match(worker, /delivery_outcome IN\('not_started','safe_failure'\)/);
  assert.match(worker, /requires_manual_confirmation: ambiguous/);
  assert.match(worker, /ambiguous_at/);
});

test("claims are merchant scoped and token protected", () => {
  assert.match(worker, /WHERE id=\? AND merchant_id=\? AND claim_token_hash=\?/);
  assert.match(worker, /lease_expires_at=datetime\('now','\+10 minutes'\)/);
  assert.match(index, /authorization\.session\.merchant_id/);
});

test("kitchen payload snapshots Chinese, options, notes, quantities and takeaway", () => {
  const payload = buildKitchenPayload({ merchantName: "\u767e\u5de5\u725b\u8089\u9eb5", orderCode: "A1-0086", tableLabel: "", orderType: "takeaway", paymentMethod: "counter", totalMinor: 57000, createdAt: "2026-09-08T06:42:00+08:00", customerNote: "\u4e0d\u8981\u8471", items: [{ name_snapshot: "\u8d85\u9577\u7684\u62db\u724c\u7d05\u71d2\u534a\u7b4b\u534a\u8089\u725b\u8089\u9eb5", quantity: 20, note: "\u4e0d\u8981\u8471", options: [{ group_name_snapshot: "\u9eb5\u689d", value_name_snapshot: "\u7c97\u9eb5" }, { group_name_snapshot: "\u8fa3\u5ea6", value_name_snapshot: "\u5c0f\u8fa3" }] }] });
  assert.equal(payload.items[0].quantity, 20); assert.equal(payload.items[0].options.length, 2); assert.equal(payload.order_type, "takeaway"); assert.equal(payload.customer_note, "\u4e0d\u8981\u8471");
});

test("LAN v1 does not claim unsupported hardware status", () => {
  assert.match(worker, /reachability: row\.last_seen_at \? "UNKNOWN" : "UNKNOWN"/);
  assert.doesNotMatch(worker, /PAPER_OUT|COVER_OPEN|CUTTER_ERROR/);
});

test("D1 enforces original dedupe and cross-merchant ownership", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE merchants(id TEXT PRIMARY KEY); CREATE TABLE merchant_permissions(code TEXT PRIMARY KEY,module TEXT,description TEXT); CREATE TABLE merchant_food_orders(id TEXT PRIMARY KEY,merchant_id TEXT NOT NULL,order_code TEXT,UNIQUE(merchant_id,id));");
  db.exec(migration);
  db.exec("INSERT INTO merchants VALUES('a'),('b'); INSERT INTO merchant_food_orders VALUES('oa','a','A-1'),('ob','b','B-1'); INSERT INTO printers(id,merchant_id,name,host,port) VALUES('pa','a','Kitchen','192.168.1.2',9100),('pb','b','Kitchen','192.168.1.3',9100);");
  const insert = db.prepare("INSERT INTO print_jobs(id,merchant_id,order_id,order_code,printer_id,payload_json,created_by,idempotency_key) VALUES(?,?,?,?,?,'{}','test',?)");
  insert.run("j1", "a", "oa", "A-1", "pa", "key-1");
  assert.throws(() => insert.run("j2", "a", "oa", "A-1", "pa", "key-2"), /UNIQUE/);
  assert.throws(() => insert.run("j3", "a", "oa", "A-2", "pb", "key-3"), /FOREIGN KEY/);
});
