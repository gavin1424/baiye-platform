import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { getPaymentProviderAdapter, PAYMENT_PROVIDER_CAPABILITIES } from "../src/payment-providers.js";

test("LINE Pay adapter is sandbox-only and fails closed without Worker secrets", () => {
  const adapter = getPaymentProviderAdapter("line_pay_online", {});
  assert.equal(adapter.isAvailable().available, false);
  assert.equal(adapter.isAvailable().code, "LINE_PAY_SANDBOX_CREDENTIAL_REQUIRED");
  assert.equal(adapter.getCapabilities().redirect, true);
});

test("Apple Pay cannot be marked paid without merchant validation and a processor", async () => {
  const adapter = getPaymentProviderAdapter("apple_pay_web", {});
  assert.equal(adapter.isAvailable().code, "APPLE_PAY_CONFIGURATION_REQUIRED");
  assert.equal((await adapter.confirmPayment({})).code, "APPLE_PAY_PROCESSOR_REQUIRED");
});

test("manual counter retains merchant confirmation semantics", async () => {
  const adapter = getPaymentProviderAdapter("manual_counter", {});
  assert.equal(adapter.isAvailable().available, true);
  assert.equal((await adapter.confirmPayment({})).code, "MERCHANT_MANUAL_CONFIRMATION_REQUIRED");
});

test("payment lifecycle migration has all terminal and partial refund states", () => {
  const sql = fs.readFileSync(new URL("../migrations/0019_demo_payment_adapters.sql", import.meta.url), "utf8");
  for (const state of ["created", "requires_action", "processing", "authorized", "paid", "failed", "cancelled", "expired", "partially_refunded", "refunded"]) assert.match(sql, new RegExp(`'${state}'`));
});

test("provider secrets and credentials never enter the client adapter contract", () => {
  assert.deepEqual(Object.keys(PAYMENT_PROVIDER_CAPABILITIES).sort(), ["apple_pay_web", "future_card_gateway", "line_pay_online", "manual_counter"].sort());
  const source = fs.readFileSync(new URL("../src/payment-providers.js", import.meta.url), "utf8");
  assert.match(source, /sandbox-api-pay\.line\.me/);
  assert.doesNotMatch(source, /api-pay\.line\.me(?!")/);
});
