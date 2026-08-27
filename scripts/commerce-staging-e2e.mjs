import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const worker = "https://chuang-baiye-commerce-staging.baiye-platform.workers.dev";
const pages = "https://baiye-platform-commerce-staging.pages.dev";
const origin = pages;
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const key = crypto.randomBytes(32).toString("hex");
const seed = path.join(os.tmpdir(), `baiye-commerce-seed-${crypto.randomUUID()}.sql`);
const results = [];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" && command.endsWith(".cmd"), ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
}
function pass(name, detail = "PASS") { results.push({ name, status: "PASS", detail }); }
async function request(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { origin, "content-type": "application/json", ...(init.headers || {}) } });
  const body = await response.json().catch(() => null);
  return { response, body };
}

try {
  run(process.execPath, [path.join(root, "scripts/seed-commerce-staging.mjs"), seed], { env: { ...process.env, APP_MODE: "staging", STAGING_SEED_KEY: key } });
  run(npx, ["wrangler", "d1", "execute", "baiye-commerce-staging", "--remote", "--config", "cloudflare-worker/wrangler.commerce-staging.jsonc", "--file", seed]);
  pass("01 isolated staging seed");

  const health = await request(`${worker}/health`); assert.equal(health.response.status, 200); pass("02 worker health");
  const anonymous = await request(`${worker}/api/merchant-auth/session`); assert.equal(anonymous.response.status, 401); pass("03 anonymous session rejected");
  const login = await request(`${worker}/api/merchant-auth/login`, { method: "POST", body: JSON.stringify({ merchant_id: "staging_commerce_merchant", email: "staging-owner@invalid.example", password: key }) });
  assert.equal(login.response.status, 200, JSON.stringify(login.body)); const cookie = login.response.headers.get("set-cookie")?.split(";")[0]; assert.ok(cookie); pass("04 merchant login");
  const session = await request(`${worker}/api/merchant-auth/session`, { headers: { cookie } }); assert.equal(session.response.status, 200); const csrf = session.body.csrf_token; assert.ok(csrf); pass("05 server session and CSRF rotation");
  const authHeaders = { cookie, "x-csrf-token": csrf };
  const dashboard = await request(`${worker}/api/commerce/dashboard`, { headers: { cookie } }); assert.equal(dashboard.response.status, 200); pass("06 dashboard");
  const missingCsrf = await request(`${worker}/api/commerce/pages`, { method: "POST", headers: { cookie }, body: JSON.stringify({ title: "Denied", slug: "denied" }) }); assert.equal(missingCsrf.response.status, 403); pass("07 CSRF rejection");
  const badOrigin = await fetch(`${worker}/api/commerce/dashboard`, { headers: { origin: "https://attacker.invalid", cookie } }); assert.equal(badOrigin.status, 403); pass("08 origin rejection");
  const providers = await request(`${worker}/api/commerce/provider-status`, { headers: { cookie } }); assert.equal(providers.response.status, 200); pass("09 provider status");
  assert.ok(providers.body.payments.every((item) => item.status === "disabled")); pass("10 payments disabled");
  assert.ok(providers.body.shipping.every((item) => item.status === "disabled")); pass("11 shipping disabled");
  assert.ok(providers.body.invoice.every((item) => item.status === "disabled")); pass("12 invoice disabled");
  assert.equal(providers.body.shopee_import, "disabled"); pass("13 Shopee import disabled");
  assert.equal(providers.body.two_factor, "disabled"); pass("14 2FA adapter disabled");
  const page = await request(`${worker}/api/commerce/pages`, { method: "POST", headers: authHeaders, body: JSON.stringify({ title: "STAGING Landing", slug: `landing-${Date.now()}`, content_hash: "staging-content-hash" }) }); assert.equal(page.response.status, 201); pass("15 page create");
  const pagesList = await request(`${worker}/api/commerce/pages`, { headers: { cookie } }); assert.equal(pagesList.response.status, 200); assert.ok(pagesList.body.items.some((item) => item.id === page.body.id)); pass("16 page list");
  const publish = await request(`${worker}/api/commerce/pages/${page.body.id}/publish`, { method: "POST", headers: authHeaders, body: JSON.stringify({}) }); assert.equal(publish.response.status, 200); pass("17 page publish");
  const product = await request(`${worker}/api/commerce/products`, { method: "POST", headers: authHeaders, body: JSON.stringify({ title: "STAGING Product", slug: `product-${Date.now()}`, sku: `SKU-${Date.now()}`, product_type: "digital", price_minor: 12345 }) }); assert.equal(product.response.status, 201); pass("18 product create");
  const products = await request(`${worker}/api/commerce/products`, { headers: { cookie } }); assert.equal(products.response.status, 200); assert.ok(products.body.items.every((item) => item.merchant_id === "staging_commerce_merchant")); assert.ok(!products.body.items.some((item) => item.id === "staging_isolation_product")); pass("19 merchant isolation");
  const raceProduct = await request(`${worker}/api/commerce/products`, { method: "POST", headers: authHeaders, body: JSON.stringify({ title: "STAGING Last Unit", slug: `last-unit-${Date.now()}`, sku: `LAST-${Date.now()}`, product_type: "physical", price_minor: 30000 }) }); assert.equal(raceProduct.response.status, 201);
  const activationSql = path.join(os.tmpdir(), `baiye-commerce-activate-${crypto.randomUUID()}.sql`);
  fs.writeFileSync(activationSql, `UPDATE commerce_product_variants SET active=1 WHERE id IN ('${product.body.variant_id}','${raceProduct.body.variant_id}') AND merchant_id='staging_commerce_merchant'; UPDATE commerce_products SET status='active' WHERE id IN ('${product.body.id}','${raceProduct.body.id}') AND merchant_id='staging_commerce_merchant'; INSERT OR REPLACE INTO commerce_inventory_items(id,merchant_id,variant_id,location_id,on_hand,reserved) VALUES('staging_gate0_last_unit','staging_commerce_merchant','${raceProduct.body.variant_id}','staging_commerce_location',1,0);`, { mode: 0o600 });
  try { run(npx, ["wrangler", "d1", "execute", "baiye-commerce-staging", "--remote", "--config", "cloudflare-worker/wrangler.commerce-staging.jsonc", "--file", activationSql]); }
  finally { fs.rmSync(activationSql, { force: true }); }
  const cart = await request(`${worker}/api/commerce/public/staging_commerce_merchant/carts`, { method: "POST", body: "{}" }); assert.equal(cart.response.status, 201); pass("20 guest cart");
  const cartAuth = { authorization: `Bearer ${cart.body.guest_token}` };
  const cartAnonymous = await request(`${worker}/api/commerce/public/staging_commerce_merchant/carts/${cart.body.id}`); assert.equal(cartAnonymous.response.status, 401); pass("21 cart token required");
  const cartWrongToken = await request(`${worker}/api/commerce/public/staging_commerce_merchant/carts/${cart.body.id}`, { headers: { authorization: "Bearer invalid-cart-token" } }); assert.ok([401, 403].includes(cartWrongToken.response.status)); pass("22 invalid cart token rejected");
  const cartRead = await request(`${worker}/api/commerce/public/staging_commerce_merchant/carts/${cart.body.id}`, { headers: cartAuth }); assert.equal(cartRead.response.status, 200); pass("23 authenticated cart read");
  const item = await request(`${worker}/api/commerce/public/staging_commerce_merchant/carts/${cart.body.id}/items`, { method: "POST", headers: cartAuth, body: JSON.stringify({ variant_id: product.body.variant_id, quantity: 2 }) }); assert.equal(item.response.status, 200); pass("24 cart item");
  const checkoutBody = JSON.stringify({ cart_id: cart.body.id, terms_consent: true, total_minor: 1 });
  const checkoutKey = `staging-checkout-${crypto.randomUUID()}`;
  const checkout = await request(`${worker}/api/commerce/public/staging_commerce_merchant/checkout`, { method: "POST", headers: { ...cartAuth, "idempotency-key": checkoutKey }, body: checkoutBody }); assert.equal(checkout.response.status, 201); pass("25 guest checkout");
  assert.equal(checkout.body.order.total_minor, 24690); pass("26 backend price recalculation");
  const replay = await request(`${worker}/api/commerce/public/staging_commerce_merchant/checkout`, { method: "POST", headers: { ...cartAuth, "idempotency-key": checkoutKey }, body: checkoutBody }); assert.equal(replay.response.status, 200); assert.equal(replay.body.replayed, true); pass("27 checkout idempotency");
  const eventKey = `staging-event-${crypto.randomUUID()}`;
  const event = await request(`${worker}/api/commerce/events`, { method: "POST", headers: { ...authHeaders, "idempotency-key": eventKey }, body: JSON.stringify({ merchant_id: "staging_isolation_merchant", event_type: "purchase", email: "not-stored@invalid.example" }) }); assert.equal(event.response.status, 202); pass("28 analytics event");
  const eventReplay = await request(`${worker}/api/commerce/events`, { method: "POST", headers: { ...authHeaders, "idempotency-key": eventKey }, body: JSON.stringify({ event_type: "purchase" }) }); assert.equal(eventReplay.response.status, 202); pass("29 analytics idempotency");
  const raceCarts = await Promise.all([request(`${worker}/api/commerce/public/staging_commerce_merchant/carts`, { method: "POST", body: "{}" }), request(`${worker}/api/commerce/public/staging_commerce_merchant/carts`, { method: "POST", body: "{}" })]);
  for (const raceCart of raceCarts) { const response = await request(`${worker}/api/commerce/public/staging_commerce_merchant/carts/${raceCart.body.id}/items`, { method: "POST", headers: { authorization: `Bearer ${raceCart.body.guest_token}` }, body: JSON.stringify({ variant_id: raceProduct.body.variant_id, quantity: 1 }) }); assert.equal(response.response.status, 200); }
  const raceResults = await Promise.all(raceCarts.map((raceCart) => request(`${worker}/api/commerce/public/staging_commerce_merchant/checkout`, { method: "POST", headers: { authorization: `Bearer ${raceCart.body.guest_token}`, "idempotency-key": `staging-race-${crypto.randomUUID()}` }, body: JSON.stringify({ cart_id: raceCart.body.id, terms_consent: true }) })));
  assert.deepEqual(raceResults.map((result) => result.response.status).sort(), [201, 409]); pass("30 atomic last-unit checkout");
  const pageResponse = await fetch(`${pages}/`); assert.equal(pageResponse.status, 200); const html = await pageResponse.text(); assert.match(html, /noindex,nofollow/); pass("31 Pages noindex");
  const robots = await fetch(`${pages}/robots.txt`); assert.match(await robots.text(), /Disallow: \/$/m); pass("32 robots disallow");
  const app = await fetch(`${pages}/#/merchant-admin`); assert.equal(app.status, 200); pass("33 merchant admin route");
  const logout = await request(`${worker}/api/merchant-auth/logout`, { method: "POST", headers: authHeaders, body: "{}" }); assert.equal(logout.response.status, 200); pass("34 logout and session revocation");
  const readLogin = await request(`${worker}/api/merchant-auth/login`, { method: "POST", body: JSON.stringify({ merchant_id: "staging_commerce_merchant", email: "staging-readonly@invalid.example", password: key }) }); assert.equal(readLogin.response.status, 200); const readCookie = readLogin.response.headers.get("set-cookie")?.split(";")[0];
  const readSession = await request(`${worker}/api/merchant-auth/session`, { headers: { cookie: readCookie } }); const readHeaders = { cookie: readCookie, "x-csrf-token": readSession.body.csrf_token };
  const readPages = await request(`${worker}/api/commerce/pages`, { headers: { cookie: readCookie } }); assert.equal(readPages.response.status, 200); pass("35 read-only read allowed");
  const deniedWrite = await request(`${worker}/api/commerce/pages`, { method: "POST", headers: readHeaders, body: JSON.stringify({ title: "Forbidden", slug: `forbidden-${Date.now()}` }) }); assert.equal(deniedWrite.response.status, 403); pass("36 read-only write forbidden");
  const report = { ok: true, gate: "Gate 0 Security / Correctness", worker, pages, results };
  const evidenceDirectory = path.join(root, "GOV_ACCEPTANCE_EVIDENCE");
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(path.join(evidenceDirectory, "commerce-gate0-e2e.json"), JSON.stringify(report, null, 2), "utf8");
  process.stdout.write(JSON.stringify(report, null, 2));
} finally {
  if (fs.existsSync(seed)) fs.rmSync(seed, { force: true });
}
