import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const allowedDatabase = "baiye-ordering-staging";
const database = process.env.BEEF_DEMO_D1_DATABASE || allowedDatabase;
if (!process.argv.includes("--staging-only")) {
  throw new Error("Refusing to run without --staging-only.");
}
if (database !== allowedDatabase || /finance|production/i.test(database)) {
  throw new Error("Refusing to run against a non-staging D1 database.");
}

const workerDir = path.resolve("cloudflare-worker");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const sql = `
PRAGMA foreign_keys=ON;
DROP TRIGGER IF EXISTS trg_ordering_item_option_immutable_delete;
DROP TRIGGER IF EXISTS trg_food_order_items_no_delete;
DROP TRIGGER IF EXISTS trg_order_pricing_no_delete;
DROP TRIGGER IF EXISTS trg_invoices_document_immutable_delete;
DROP TRIGGER IF EXISTS trg_inventory_movements_no_delete;
DELETE FROM merchant_inventory_movements WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_inventory_items WHERE merchant_id='demo_beef_noodle';
DELETE FROM invoice_events WHERE merchant_id='demo_beef_noodle';
DELETE FROM invoice_allowances WHERE merchant_id='demo_beef_noodle';
DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE merchant_id='demo_beef_noodle');
DELETE FROM invoices WHERE merchant_id='demo_beef_noodle';
DELETE FROM invoice_requests WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_order_invoice_preferences WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_payment_domain_events WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_order_inventory_reservations WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_checkout_payment_events WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_checkout_payment_transactions WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_checkout_payment_intents WHERE merchant_id='demo_beef_noodle';
DELETE FROM payment_events WHERE payment_id IN (SELECT id FROM payments WHERE merchant_id='demo_beef_noodle' AND note LIKE 'qr_order:%');
DELETE FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE merchant_id='demo_beef_noodle' AND note LIKE 'qr_order:%');
DELETE FROM payments WHERE merchant_id='demo_beef_noodle' AND note LIKE 'qr_order:%';
DELETE FROM merchant_food_order_item_options WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_order_payment_events WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_order_payment_intents WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_order_pricing WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_coupon_redemptions WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_member_coupons WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_food_order_items WHERE order_id IN (SELECT id FROM merchant_food_orders WHERE merchant_id='demo_beef_noodle');
DELETE FROM merchant_food_orders WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_dining_sessions WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_member_sessions WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_ordering_memberships WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_ordering_audit_logs WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_line_events WHERE merchant_id='demo_beef_noodle';
DELETE FROM ordering_rate_limits WHERE merchant_id='demo_beef_noodle';
DELETE FROM merchant_user_sessions WHERE merchant_id='demo_beef_noodle';
UPDATE merchant_menu_items SET daily_sold_count=0,daily_sold_date=NULL,updated_at=CURRENT_TIMESTAMP WHERE merchant_id='demo_beef_noodle';
CREATE TRIGGER trg_ordering_item_option_immutable_delete
BEFORE DELETE ON merchant_food_order_item_options BEGIN SELECT RAISE(ABORT,'ORDER_OPTION_IMMUTABLE'); END;
CREATE TRIGGER trg_food_order_items_no_delete
BEFORE DELETE ON merchant_food_order_items
BEGIN SELECT RAISE(ABORT, 'submitted order items are immutable'); END;
CREATE TRIGGER trg_order_pricing_no_delete
BEFORE DELETE ON merchant_order_pricing
BEGIN SELECT RAISE(ABORT,'order pricing is immutable'); END;
CREATE TRIGGER trg_invoices_document_immutable_delete
BEFORE DELETE ON invoices
FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'issued invoices cannot be deleted'); END;
CREATE TRIGGER trg_inventory_movements_no_delete
BEFORE DELETE ON merchant_inventory_movements
BEGIN SELECT RAISE(ABORT,'INVENTORY_LEDGER_IMMUTABLE'); END;
`;

const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "baiye-beef-demo-reset-"));
const sqlPath = path.join(temporaryDirectory, "reset.sql");
writeFileSync(sqlPath, sql, "utf8");
const result = spawnSync(npx, [
  "wrangler", "d1", "execute", "FINANCE_DB", "--remote",
  "--config", "wrangler.ordering-staging.jsonc", `--file=${sqlPath}`,
], { cwd: workerDir, stdio: "inherit", shell: process.platform === "win32" });
rmSync(temporaryDirectory, { recursive: true, force: true });

if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Demo cleanup failed with exit code ${result.status}.`);
console.log("Demo transactional data reset completed. Inventory was reset to blank; merchant, customer identity core, platform members, menu, options and QR codes were preserved.");
