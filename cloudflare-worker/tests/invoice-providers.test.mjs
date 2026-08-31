import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { getInvoiceProviderAdapter, invoiceStates } from "../src/invoice-providers.js";

test("disabled invoice provider never issues a Demo invoice number", async () => {
  const adapter = getInvoiceProviderAdapter("disabled", {});
  assert.equal(adapter.isAvailable().code, "INVOICE_PROVIDER_DISABLED");
  assert.equal((await adapter.issueInvoice({ request_id: "x" })).ok, false);
});

test("test invoice provider is forbidden outside isolated automated tests", () => {
  assert.equal(getInvoiceProviderAdapter("mock_for_automated_test_only", {}).isAvailable().available, false);
  assert.equal(getInvoiceProviderAdapter("mock_for_automated_test_only", { NODE_ENV: "test", INVOICE_TEST_MODE: "isolated" }).isAvailable().available, true);
});

test("test provider generates an explicitly non-production invoice only in test", async () => {
  const result = await getInvoiceProviderAdapter("mock_for_automated_test_only", { NODE_ENV: "test", INVOICE_TEST_MODE: "isolated" }).issueInvoice({ request_id: "request-000001" });
  assert.match(result.invoice_number, /^TEST-INV-/);
});

test("invoice migration includes requests, immutable document records and retry state", () => {
  const sql = fs.readFileSync(new URL("../migrations/0020_demo_invoice_core.sql", import.meta.url), "utf8");
  for (const table of ["invoice_requests", "invoices", "invoice_items", "invoice_events", "invoice_allowances", "merchant_invoice_integrations"]) assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  for (const state of ["PENDING", "ISSUING", "ISSUED", "FAILED", "VOID_PENDING", "VOIDED", "ALLOWANCE_PENDING", "PARTIALLY_REFUNDED", "FULLY_REFUNDED"]) assert.ok(invoiceStates.has(state) || sql.includes(`'${state}'`));
  assert.match(sql, /retry_count/); assert.match(sql, /next_retry_at/);
});
