import test from "node:test";
import assert from "node:assert/strict";
import { handleLeadRequest } from "../src/leads.js";

test("valid consultation stores source attribution and responds only after save", async () => {
  let recorded;
  const env = { FINANCE_DB: { prepare: () => ({ bind: (...values) => ({ run: async () => { recorded = values; } }) }) } };
  const request = new Request("https://example.com/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "陳店長", phone: "0912345678", industry: "餐飲", consent: "yes", attribution: { utm_source: "google", gclid: "abc" } }) });
  const response = await handleLeadRequest(request, env, {});
  assert.equal(response.status, 201);
  assert.equal(recorded[1], "陳店長");
  assert.equal(recorded[3], "0912345678");
  assert.deepEqual(JSON.parse(recorded[10]).utm_source, "google");
});

test("invalid consent is rejected without storing data", async () => {
  const request = new Request("https://example.com/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "A", phone: "0912345678", industry: "餐飲" }) });
  const response = await handleLeadRequest(request, { FINANCE_DB: { prepare: () => { throw new Error("should not be called"); } } }, {});
  assert.equal(response.status, 400);
});
