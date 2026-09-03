import assert from "node:assert/strict";
import test from "node:test";
import { handleCommercialCatalog, MERCHANT_PLANS, STANDARD_ADDONS } from "../src/commercial-catalog.js";

test("public catalog exposes exactly the three approved commercial definitions", async () => {
  const response = handleCommercialCatalog(new Request("https://worker.test/api/public/commercial-catalog"));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(data.plans.map((plan) => [plan.plan_id, plan.price_minor, plan.term_months]), [
    ["baiye_standard_18000_addons", 1800000, 24],
    ["baiye_commerce_ai_45000", 4500000, 24],
    ["baiye_softpos_24000", 2400000, 24],
  ]);
  assert.equal(data.server_authoritative, true);
  assert.equal(data.final_contract_amount_server_calculated, true);
});

test("catalog values stay consistent with immutable contract commercial definitions", () => {
  const [standard, commerce, softpos] = MERCHANT_PLANS;
  assert.equal(standard.contract_version, "merchant_service_v1_2_18000_addons");
  assert.equal(standard.base_product_limit, 20);
  assert.equal(standard.merchant_content_editable, false);
  assert.equal(commerce.contract_version, "merchant_commerce_ai_v1_0_45000");
  assert.equal(commerce.merchant_product_editable, true);
  assert.equal(commerce.commerce_full, true);
  assert.equal(softpos.contract_version, "merchant_softpos_v1_0_24000");
  assert.equal(softpos.trial_months, 3);
  assert.equal(softpos.activation_fee_minor, 300000);
  assert.equal(softpos.deposit_minor, 600000);
  assert.equal(softpos.first_cycle_balance_minor, 1800000);
});

test("standard add-ons retain pricing configuration and quote gate", () => {
  assert.equal(STANDARD_ADDONS.find((item) => item.code === "simple_cart")?.amount_minor, 800000);
  assert.equal(STANDARD_ADDONS.find((item) => item.code === "external_checkout_cart")?.amount_minor, 1400000);
  const payment = STANDARD_ADDONS.find((item) => item.code === "payment_api");
  assert.equal(payment?.minimum_minor, 2200000);
  assert.equal(payment?.admin_quote_required, true);
});
