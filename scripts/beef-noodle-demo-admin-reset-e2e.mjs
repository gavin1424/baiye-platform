import assert from "node:assert/strict";
const api = "https://chuang-baiye-ordering-staging.baiye-platform.workers.dev";
const origin = "https://baiye-beef-noodle-demo.pages.dev";
const password = process.env.BEEF_DEMO_TEST_PASSWORD;
if (!password || password.length < 12) throw new Error("BEEF_DEMO_TEST_PASSWORD is required.");
const call = async (path, init = {}) => { const response = await fetch(`${api}${path}`, { ...init, headers: { origin, ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers || {}) } }); return { response, body: await response.json().catch(() => ({})) }; };
let passed = 0; const pass = (label) => console.log(`PASS ${String(++passed).padStart(2,"0")} ${label}`);
const login = await call("/api/merchant-demo/login", { method: "POST", body: JSON.stringify({ username: "baiye-beef-demo", password }) }); assert.equal(login.response.status, 200); const cookie = login.response.headers.get("set-cookie"); let csrf = login.body.csrf_token;
const session = await call("/api/merchant-auth/session", { headers: { cookie } }); assert.equal(session.response.status, 200); csrf = session.body.csrf_token;
const get = (path) => call(path, { headers: { cookie } }); const mutate = (path, body = {}) => call(path, { method: "POST", headers: { cookie, "x-csrf-token": csrf }, body: JSON.stringify(body) });
for (const [path, label] of [["/api/merchant/google-maps-booking","Google Maps Booking"],["/api/merchant-admin/line","LINE readiness"],["/api/merchant-admin/account","管理者帳戶"]]) { const result = await get(path); assert.equal(result.response.status, 200, `${label}: ${JSON.stringify(result.body)}`); pass(label); }
const foreign = await get("/api/merchant-admin/profile?merchant_id=meiling_patchwork"); assert.equal(foreign.response.status, 403); pass("Cross Merchant 403");
const admin = await get("/api/admin/finance/merchants"); assert.ok([401,403].includes(admin.response.status)); pass("Platform Admin blocked");
const reset = await mutate("/api/merchant-admin/demo/reset"); assert.equal(reset.response.status, 200, JSON.stringify(reset.body)); assert.equal(reset.body.golden_restored, true); pass("Golden Reset");
const menu = await call("/api/ordering/qr/myJghWaqQbCwMInWWsBUf2xRwsR02saT/menu"); assert.equal(menu.response.status, 200); assert.equal(menu.body.items.length, 20); assert.equal(menu.body.items.find((item) => item.id === "bn_item_01").price_minor, 18000); assert.ok(!menu.body.items.some((item) => item.name === "測試商品")); pass("Golden 菜單與原價恢復");
console.log(JSON.stringify({ result: "PASS", passed, merchant_id: "demo_beef_noodle" }));
