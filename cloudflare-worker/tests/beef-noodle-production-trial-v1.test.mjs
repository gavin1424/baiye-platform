import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { detectProductImageMime } from "../src/merchant-assets.js";
import { deductionStatements, restoreStatements } from "../src/inventory.js";

const migrationNames = ["0001_finance_core.sql","0002_partner_portal.sql","0003_partner_completion.sql","0004_contract_v1_hash.sql","0005_partner_activation_approval.sql","0006_contractor_v13_policy.sql","0007_merchant_ai_quota.sql","0008_merchant_booking_engine.sql","0009_production_admin_auth.sql","0010_merchant_settlements.sql","0011_qr_membership_ordering.sql","0012_member_benefits_integrations.sql","0013_growth_completion.sql","0013_qr_ordering_commercial_v1.sql","0014_merchant_contracts.sql","0015_phone_only_platform_membership.sql","0016_partner_auto_approval.sql","0017_partner_passwordless_login.sql","0018_beef_noodle_production_trial_v1.sql","0019_beef_noodle_production_trial_seed_v1.sql","0020_beef_noodle_production_options_qr_v1.sql","0021_beef_noodle_production_booking_golden_v1.sql","0022_beef_noodle_production_golden_menu_v1.sql","0023_beef_noodle_production_golden_options_v1.sql"];
function database() { const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys=ON"); for (const name of migrationNames) db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8")); return db; }
class Statement { constructor(statement) { this.statement = statement; this.values = []; } bind(...values) { this.values = values; return this; } async run() { const result = this.statement.run(...this.values); return { meta: { changes: Number(result.changes || 0) } }; } async first() { return this.statement.get(...this.values) || null; } async all() { return { results: this.statement.all(...this.values) }; } }
class D1 { constructor(sqlite) { this.sqlite = sqlite; } prepare(sql) { return new Statement(this.sqlite.prepare(sql)); } async batch(statements) { this.sqlite.exec("BEGIN IMMEDIATE"); try { for (const statement of statements) await statement.run(); this.sqlite.exec("COMMIT"); } catch (error) { this.sqlite.exec("ROLLBACK"); throw error; } } }

test("production release migration seeds one exact official demo and twenty products", () => {
  const db = database();
  const merchant = db.prepare("SELECT id,demo_environment,official_demo,demo_contract_exemption FROM merchants WHERE id='demo_beef_noodle'").get();
  assert.equal(merchant.id, "demo_beef_noodle"); assert.equal(merchant.demo_environment, 1); assert.equal(merchant.official_demo, 1); assert.equal(merchant.demo_contract_exemption, 1);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM merchant_menu_items WHERE merchant_id='demo_beef_noodle' AND status<>'archived'").get().count, 20);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM merchant_inventory_items WHERE merchant_id='demo_beef_noodle' AND reset_at IS NULL").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM merchant_ordering_qr_codes WHERE merchant_id='demo_beef_noodle' AND active=1").get().count, 3);
});

test("production identity provisioning is separate from migration seed", () => {
  const db = database();
  assert.equal(db.prepare("SELECT COUNT(*) count FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized='0900000026'").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM merchant_owner_links WHERE merchant_id='demo_beef_noodle'").get().count, 0);
  const provisioning = readFileSync(new URL("../../scripts/provision-production-demo-access.mjs", import.meta.url), "utf8");
  for (const table of ["ordering_customers","platform_members","merchant_users","merchant_owner_links","merchant_ordering_memberships","production_demo_access_credentials"]) assert.match(provisioning, new RegExp(table));
});

test("production access credential starts unprovisioned and stores no plaintext code", () => {
  const db = database();
  const credential = db.prepare("SELECT phone_hash,code_hash,code_salt,status FROM production_demo_access_credentials WHERE merchant_id='demo_beef_noodle'").get();
  assert.equal(credential, undefined);
  const source = readFileSync(new URL("../src/demo-merchant.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /staging_otp|SMS.*寄出|if\s*\(.*demo.*\).*unlock/i);
  assert.match(source, /merchantId !== PRODUCTION_DEMO_MERCHANT_ID/);
});

test("product asset validation uses magic bytes and five megabyte cap", () => {
  assert.equal(detectProductImageMime(Uint8Array.from([0xff,0xd8,0xff,0x00])), "image/jpeg");
  assert.equal(detectProductImageMime(Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])), "image/png");
  assert.equal(detectProductImageMime(Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80])), "image/webp");
  assert.equal(detectProductImageMime(Uint8Array.from([0x47,0x49,0x46])), "");
  assert.match(readFileSync(new URL("../src/merchant-assets.js", import.meta.url), "utf8"), /5 \* 1024 \* 1024/);
});

test("inventory ledger is immutable and reset preserves it", () => {
  const db = database();
  db.prepare("INSERT INTO merchant_inventory_items(id,merchant_id,menu_item_id,stock_on_hand) VALUES('inv','demo_beef_noodle','bn_item_01',10)").run();
  db.prepare("INSERT INTO merchant_inventory_movements(id,merchant_id,inventory_item_id,menu_item_id,movement_type,quantity_delta,quantity_before,quantity_after,actor_type) VALUES('mov','demo_beef_noodle','inv','bn_item_01','INITIAL',10,0,10,'merchant')").run();
  assert.throws(() => db.prepare("DELETE FROM merchant_inventory_movements WHERE id='mov'").run(), /INVENTORY_LEDGER_IMMUTABLE/);
  db.prepare("UPDATE merchant_inventory_items SET reset_at=CURRENT_TIMESTAMP WHERE merchant_id='demo_beef_noodle'").run();
  assert.equal(db.prepare("SELECT COUNT(*) count FROM merchant_inventory_items WHERE merchant_id='demo_beef_noodle' AND reset_at IS NULL").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM merchant_inventory_movements WHERE merchant_id='demo_beef_noodle'").get().count, 1);
});

test("atomic inventory deduction permits one winner and cancellation restores once", async () => {
  const sqlite = database(); sqlite.exec("PRAGMA foreign_keys=OFF");
  sqlite.prepare("INSERT INTO merchant_inventory_items(id,merchant_id,menu_item_id,stock_on_hand,low_stock_threshold,inventory_enabled) VALUES('atomic','demo_beef_noodle','bn_item_01',1,0,1)").run();
  const db = new D1(sqlite);
  await db.batch(deductionStatements(db, "demo_beef_noodle", "order-one", [{ order_item_id: "line-one", menu_item_id: "bn_item_01", quantity: 1 }], "member-one"));
  await assert.rejects(() => db.batch(deductionStatements(db, "demo_beef_noodle", "order-two", [{ order_item_id: "line-two", menu_item_id: "bn_item_01", quantity: 1 }], "member-two")));
  assert.equal(sqlite.prepare("SELECT stock_on_hand FROM merchant_inventory_items WHERE id='atomic'").get().stock_on_hand, 0);
  const line = { id: "line-one", menu_item_id: "bn_item_01", quantity: 1 };
  await db.batch(restoreStatements(db, "demo_beef_noodle", "order-one", [line], "customer", "member-one", "cancel"));
  await db.batch(restoreStatements(db, "demo_beef_noodle", "order-one", [line], "customer", "member-one", "cancel replay"));
  assert.equal(sqlite.prepare("SELECT stock_on_hand FROM merchant_inventory_items WHERE id='atomic'").get().stock_on_hand, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM merchant_inventory_movements WHERE order_item_id='line-one' AND movement_type='ORDER_RESTORE'").get().count, 1);
});

test("merchant ordering audit maps to the existing production actor enum", () => {
  const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  assert.match(source, /actor_type: "admin",\s*actor_id: authorization\.session\.user_id,\s*actor_role: "merchant_owner"/);
  const db = database();
  assert.doesNotThrow(() => db.prepare("INSERT INTO merchant_ordering_audit_logs(id,merchant_id,actor_type,actor_id,actor_role,action,resource_type) VALUES('merchant-audit','demo_beef_noodle','admin','demo_beef_owner','merchant_owner','product_update','menu_item')").run());
});

test("production demo login issues a platform-compatible hex token hash", () => {
  const source = readFileSync(new URL("../src/demo-merchant.js", import.meta.url), "utf8");
  assert.match(source, /platform_member_sessions[\s\S]*await shaHex\(memberToken\)/);
  assert.doesNotMatch(source, /platform_member_sessions[\s\S]{0,300}await sha\(memberToken\)/);
});
