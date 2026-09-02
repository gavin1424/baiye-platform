import assert from "node:assert/strict";

const api = "https://chuang-baiye-ordering-staging.baiye-platform.workers.dev";
const origin = "https://baiye-beef-noodle-demo.pages.dev";
const qrCode = "myJghWaqQbCwMInWWsBUf2xRwsR02saT";
const password = process.env.BEEF_DEMO_TEST_PASSWORD;
if (!password || password.length < 12) throw new Error("BEEF_DEMO_TEST_PASSWORD is required.");
let passed = 0;
const pass = (label) => console.log(`PASS ${String(++passed).padStart(2, "0")} ${label}`);
const parse = async (response) => ({ response, body: await response.json().catch(() => ({})) });
const publicRequest = (path, init = {}) => fetch(`${api}${path}`, { ...init, headers: { origin, ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers || {}) } }).then(parse);

const login = await publicRequest("/api/merchant-demo/login", { method: "POST", body: JSON.stringify({ username: "baiye-beef-demo", password }) });
assert.equal(login.response.status, 200); const cookie = login.response.headers.get("set-cookie"); let csrf = login.body.csrf_token; assert.ok(cookie && csrf); pass("Demo Password Login");
const merchantRequest = (path, init = {}) => publicRequest(path, { ...init, headers: { cookie, ...(init.method && init.method !== "GET" ? { "x-csrf-token": csrf } : {}), ...(init.headers || {}) } });

const session = await merchantRequest("/api/merchant-auth/session"); assert.equal(session.response.status, 200); csrf = session.body.csrf_token; assert.equal(session.body.user.merchant_id, "demo_beef_noodle"); assert.ok(session.body.roles.includes("owner")); pass("正式 Merchant Session／merchant_owner scope");
const dashboard = await merchantRequest("/api/merchant-admin/dashboard"); assert.equal(dashboard.response.status, 200); assert.equal(dashboard.body.demo_environment, true); assert.equal(dashboard.body.operation_locked, false); assert.equal(dashboard.body.merchant.name, "百工牛肉麵"); pass("Demo Dashboard 與 Contract-only exemption");
const overview = await merchantRequest("/api/merchant-admin/ordering/overview"); assert.equal(overview.response.status, 200); const original = overview.body.items.find((item) => item.id === "bn_item_01"); assert.ok(original); pass("商品後台讀取");

const edit = await merchantRequest("/api/merchant-admin/ordering/items/bn_item_01", { method: "PATCH", body: JSON.stringify({ price_minor: original.price_minor + 100, name: original.name, category_id: original.category_id, description: original.description, image_url: original.image_url, status: "active" }) }); assert.equal(edit.response.status, 200, JSON.stringify(edit.body)); pass("紅燒牛肉麵價格修改 API 200");
let menu = await publicRequest(`/api/ordering/qr/${qrCode}/menu`); assert.equal(menu.body.items.find((item) => item.id === "bn_item_01").price_minor, original.price_minor + 100); pass("Storefront 即時同步新價格");
const restorePrice = await merchantRequest("/api/merchant-admin/ordering/items/bn_item_01", { method: "PATCH", body: JSON.stringify({ price_minor: original.price_minor }) }); assert.equal(restorePrice.response.status, 200); menu = await publicRequest(`/api/ordering/qr/${qrCode}/menu`); assert.equal(menu.body.items.find((item) => item.id === "bn_item_01").price_minor, original.price_minor); pass("原價完整還原");

const created = await merchantRequest("/api/merchant-admin/ordering/items", { method: "POST", body: JSON.stringify({ category_id: "bn_cat_sides", sku: `DEMO-${Date.now()}`, name: "測試商品", description: "Demo CRUD 驗證後封存", price_minor: 9900, status: "active" }) }); assert.equal(created.response.status, 201); const itemId = created.body.item?.id || created.body.id; assert.ok(itemId); pass("測試商品 NT$99 建立");
menu = await publicRequest(`/api/ordering/qr/${qrCode}/menu`); assert.ok(menu.body.items.some((item) => item.id === itemId && item.price_minor === 9900)); pass("新商品前台上架");
const hidden = await merchantRequest(`/api/merchant-admin/ordering/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ status: "hidden" }) }); assert.equal(hidden.response.status, 200); menu = await publicRequest(`/api/ordering/qr/${qrCode}/menu`); assert.ok(!menu.body.items.some((item) => item.id === itemId)); pass("商品下架後前台消失");
const republished = await merchantRequest(`/api/merchant-admin/ordering/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) }); assert.equal(republished.response.status, 200); pass("商品恢復上架");
const archived = await merchantRequest(`/api/merchant-admin/ordering/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ status: "archived" }) }); assert.equal(archived.response.status, 200); pass("商品 soft delete／archive");

for (const [path, label] of [["/api/merchant-admin/bookings","Booking Core"],["/api/merchant-admin/members","Membership Core"],["/api/merchant/google-maps-booking","Google Maps Booking"],["/api/merchant-admin/line","LINE readiness"],["/api/merchant-admin/account","管理者帳戶"]]) { const result = await merchantRequest(path); assert.equal(result.response.status, 200, `${label}: ${result.response.status}`); pass(label); }
const foreign = await merchantRequest("/api/merchant-admin/profile?merchant_id=meiling_patchwork"); assert.equal(foreign.response.status, 403); pass("Cross Merchant 403");
const platformAdmin = await merchantRequest("/api/admin/finance/merchants"); assert.ok([401,403].includes(platformAdmin.response.status)); pass("Platform Admin access blocked");

const reset = await merchantRequest("/api/merchant-admin/demo/reset", { method: "POST", body: "{}" }); assert.equal(reset.response.status, 200, JSON.stringify(reset.body)); assert.equal(reset.body.golden_restored, true); pass("Golden Demo Reset");
menu = await publicRequest(`/api/ordering/qr/${qrCode}/menu`); assert.equal(menu.body.items.length, 20); assert.equal(menu.body.items.find((item) => item.id === "bn_item_01").price_minor, 18000); assert.ok(!menu.body.items.some((item) => item.name === "測試商品")); pass("Golden 菜單 20 項恢復");
console.log(JSON.stringify({ result: "PASS", passed, merchant_id: "demo_beef_noodle", coupon_created: 0 }));
