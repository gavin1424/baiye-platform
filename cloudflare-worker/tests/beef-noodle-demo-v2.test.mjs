import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { calculateOrderLines, canTransitionOrderStatus } from "../src/qr-ordering.js";

function demoDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync(new URL("../migrations", import.meta.url)).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
    db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  }
  db.prepare("INSERT INTO merchants(id,merchant_code,name,status) VALUES('staging_owner_merchant','STG','Staging Owner','active')").run();
  db.prepare("INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,password_iterations,password_algorithm,status,display_name) VALUES('stg_owner','staging_owner_merchant','owner@example.test','hash','salt',1,'PBKDF2-SHA-256','active','Staging Owner')").run();
  db.exec(readFileSync(new URL("../staging/seed-beef-noodle-demo.sql", import.meta.url), "utf8"));
  return db;
}

test("beef noodle V2 seed keeps one demo merchant with five categories, twenty menu items and six opaque QRs", () => {
  const db = demoDatabase();
  assert.equal(db.prepare("SELECT COUNT(*) count FROM merchants WHERE id='demo_beef_noodle'").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM merchant_menu_categories WHERE merchant_id='demo_beef_noodle' AND active=1").get().count, 5);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM merchant_menu_items WHERE merchant_id='demo_beef_noodle' AND status='active'").get().count, 20);
  const qrs = db.prepare("SELECT code FROM merchant_ordering_qr_codes WHERE merchant_id='demo_beef_noodle' AND active=1").all();
  assert.equal(qrs.length, 6);
  assert.equal(new Set(qrs.map((row) => row.code)).size, 6);
  assert.ok(qrs.every((row) => !row.code.includes("demo_beef_noodle") && row.code.length >= 24));
});

test("beef noodle V2 uses server-side option repricing and preserves the five-step kitchen state machine", () => {
  const db = demoDatabase();
  const catalog = db.prepare("SELECT id,name,price_minor,allow_customer_note FROM merchant_menu_items WHERE id='bn_item_01'").all();
  const groups = db.prepare("SELECT id,name,active,min_select,max_select FROM merchant_menu_option_groups WHERE merchant_id='demo_beef_noodle'").all();
  const values = db.prepare("SELECT id,group_id,name,price_delta_minor,active FROM merchant_menu_option_values WHERE merchant_id='demo_beef_noodle'").all();
  const links = db.prepare("SELECT menu_item_id,option_group_id FROM merchant_menu_item_option_groups WHERE menu_item_id='bn_item_01'").all();
  const price = calculateOrderLines([{ item_id: "bn_item_01", quantity: 1, price_minor: 1, option_value_ids: ["bn_val_thin", "bn_val_mild", "bn_val_more_noodle", "bn_val_more_beef", "bn_val_regular_pickles"] }], catalog, groups, values, links);
  assert.equal(price.ok, true);
  assert.equal(price.subtotal_minor, 26000);
  for (const [from, to] of [["submitted", "accepted"], ["accepted", "preparing"], ["preparing", "ready"], ["ready", "served"], ["served", "completed"]]) assert.equal(canTransitionOrderStatus(from, to), true);
  assert.equal(canTransitionOrderStatus("submitted", "completed"), false);
});
