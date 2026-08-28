import assert from "node:assert/strict";

const api = "https://chuang-baiye-ordering-staging.baiye-platform.workers.dev";
const origin = "https://baiye-beef-noodle-demo.pages.dev";
const qrCode = "myJghWaqQbCwMInWWsBUf2xRwsR02saT";
const password = process.env.BEEF_DEMO_TEST_PASSWORD;
if (!password || password.length < 16) throw new Error("BEEF_DEMO_TEST_PASSWORD is required for isolated Staging E2E.");

let passed = 0;
const pass = (label) => { passed += 1; console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`); };
async function request(path, init = {}) {
  const response = await fetch(`${api}${path}`, { ...init, headers: { origin, ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

const context = await request(`/api/ordering/qr/${qrCode}`);
assert.equal(context.response.status, 200); assert.equal(context.body.context.merchant_id, "demo_beef_noodle"); pass("A1 QR 與 Demo 商家隔離");
assert.equal(context.body.context.enabled, true); assert.equal(context.body.context.accepting_orders, true); pass("Demo 商家已啟用且接單中");

const phone = `09${String(Date.now()).slice(-8)}`;
const joined = await request(`/api/ordering/qr/${qrCode}/join`, { method: "POST", body: JSON.stringify({ display_name: "STAGING 驗收顧客", phone, email: "beef-demo-e2e@example.test", privacy_consent: true, consent_version: "DEMO-2026-08-28" }) });
assert.equal(joined.response.status, 201); assert.ok(joined.body.session?.token); pass("快速會員加入");
const memberToken = joined.body.session.token;

const menu = await request(`/api/ordering/qr/${qrCode}/menu`, { headers: { authorization: `Bearer ${memberToken}` } });
assert.equal(menu.response.status, 200); assert.equal(menu.body.categories.length, 4); assert.equal(menu.body.items.length, 17); pass("四分類十七商品菜單");
assert.equal(menu.body.items.filter((item) => item.status === "active").length, 17); pass("十七品項皆可供 Demo 瀏覽");
assert.equal(menu.body.option_groups.length, 5); assert.ok(menu.body.option_values.some((value) => value.id === "bn_val_more_beef" && value.price_delta_minor === 6000)); pass("五組後端加料價格");
assert.equal(menu.body.item_option_groups.filter((link) => link.item_id === "bn_item_01").length, 5); pass("牛肉麵綁定五組選項");

const orderKey = `beef-e2e-${Date.now()}`;
const orderPayload = { order_type: "dine_in", table_label: "FORGED", items: [{ item_id: "bn_item_01", quantity: 1, option_value_ids: ["bn_val_thin", "bn_val_mild", "bn_val_more_noodle", "bn_val_more_beef", "bn_val_regular_pickles"], note: "STAGING E2E" }] };
const created = await request(`/api/ordering/qr/${qrCode}/orders`, { method: "POST", headers: { authorization: `Bearer ${memberToken}`, "idempotency-key": orderKey }, body: JSON.stringify(orderPayload) });
assert.equal(created.response.status, 201); assert.equal(created.body.order.table_label, "A1"); assert.equal(created.body.order.total_minor, 26000); pass("Worker 重算桌號與加料總價");
assert.equal(created.body.order.status, "submitted"); pass("新單狀態為 submitted");
const orderCode = created.body.order.order_code;

const replay = await request(`/api/ordering/qr/${qrCode}/orders`, { method: "POST", headers: { authorization: `Bearer ${memberToken}`, "idempotency-key": orderKey }, body: JSON.stringify(orderPayload) });
assert.equal(replay.response.status, 200); assert.equal(replay.body.order.order_code, orderCode); pass("送單冪等回放");

const customerOrder = await request(`/api/ordering/orders/${orderCode}`, { headers: { authorization: `Bearer ${memberToken}` } });
assert.equal(customerOrder.response.status, 200); assert.equal(customerOrder.body.order.status, "submitted"); pass("顧客訂單狀態查詢");

const second = await request(`/api/ordering/qr/${qrCode}/orders`, { method: "POST", headers: { authorization: `Bearer ${memberToken}`, "idempotency-key": `${orderKey}-reorder` }, body: JSON.stringify({ ...orderPayload, items: [{ item_id: "bn_item_10", quantity: 1 }] }) });
assert.equal(second.response.status, 201); assert.notEqual(second.body.order.order_code, orderCode); pass("再次加點建立第二單");

const login = await request("/api/merchant-auth/login", { method: "POST", body: JSON.stringify({ merchant_id: "demo_beef_noodle", email: "beef-demo-owner@example.test", password }) });
assert.equal(login.response.status, 200); const cookie = login.response.headers.get("set-cookie"); assert.ok(cookie); pass("商家 Server-side 登入");
const session = await request("/api/merchant-auth/session", { headers: { cookie } });
assert.equal(session.response.status, 200); assert.ok(session.body.permissions.includes("ordering.orders.manage")); const csrf = session.body.csrf_token; pass("商家權限與 CSRF Session");
assert.ok(session.body.roles.includes("owner")); assert.ok(csrf); pass("商家 Owner Role 由伺服器解析");

const merchantHeaders = { cookie, "x-csrf-token": csrf };
const board = await request("/api/merchant-admin/ordering/overview", { headers: { cookie } });
assert.equal(board.response.status, 200); assert.ok(board.body.orders.some((order) => order.order_code === orderCode)); pass("商家即時看板收到新單");
assert.ok(board.body.orders.some((order) => order.order_code === second.body.order.order_code)); pass("看板顯示同桌再次加點");

for (const [status, label] of [["accepted", "接單"], ["preparing", "製作中"], ["ready", "完成製作"], ["served", "出餐"], ["completed", "完成"]]) {
  const changed = await request(`/api/merchant-admin/ordering/orders/${orderCode}/status`, { method: "PATCH", headers: merchantHeaders, body: JSON.stringify({ status }) });
  assert.equal(changed.response.status, 200); pass(`訂單狀態：${label}`);
}

const paid = await request(`/api/merchant-admin/ordering/orders/${orderCode}/payment`, { method: "POST", headers: { ...merchantHeaders, "idempotency-key": `${orderKey}-pay` }, body: JSON.stringify({ action: "confirm", payment_method: "cash", reference: "STAGING-DEMO" }) });
assert.equal(paid.response.status, 200); pass("現場付款人工確認");
const paidReplay = await request(`/api/merchant-admin/ordering/orders/${orderCode}/payment`, { method: "POST", headers: { ...merchantHeaders, "idempotency-key": `${orderKey}-pay` }, body: JSON.stringify({ action: "confirm", payment_method: "cash", reference: "STAGING-DEMO" }) }); assert.equal(paidReplay.response.status, 200); pass("付款確認冪等回放");

const sold = await request("/api/merchant-admin/ordering/items/bn_item_05", { method: "PATCH", headers: merchantHeaders, body: JSON.stringify({ status: "sold_out" }) });
assert.equal(sold.response.status, 200); pass("商品售完");
const restored = await request("/api/merchant-admin/ordering/items/bn_item_05", { method: "PATCH", headers: merchantHeaders, body: JSON.stringify({ status: "active" }) });
assert.equal(restored.response.status, 200); pass("恢復供應");
const restoredMenu = await request(`/api/ordering/qr/${qrCode}/menu`, { headers: { authorization: `Bearer ${memberToken}` } }); assert.equal(restoredMenu.body.items.find((item) => item.id === "bn_item_05").status, "active"); pass("顧客菜單同步恢復供應");

const refreshed = await request("/api/merchant-admin/ordering/overview", { headers: { cookie } });
const openSession = refreshed.body.dining_sessions.find((item) => item.table_label === "A1" && item.status === "open"); assert.ok(openSession); pass("同桌 Dining Session 群組");
assert.ok(refreshed.body.orders.filter((item) => item.table_label === "A1").length >= 2); pass("同桌後台群組含多筆訂單");
const closed = await request(`/api/merchant-admin/ordering/dining-sessions/${openSession.id}/close`, { method: "POST", headers: merchantHeaders, body: "{}" });
assert.equal(closed.response.status, 200); pass("清桌關閉 Session");

const invalidQr = await request("/api/ordering/qr/not-a-real-demo-code"); assert.equal(invalidQr.response.status, 404); pass("無效 QR 友善拒絕");
const guestAdmin = await request("/api/merchant-admin/ordering/overview"); assert.equal(guestAdmin.response.status, 401); pass("未登入後台拒絕");
const wrongOrigin = await fetch(`${api}/api/ordering/qr/${qrCode}`, { headers: { origin: "https://invalid.example" } }); assert.equal(wrongOrigin.status, 403); pass("非法 Origin 拒絕");
const customerPayment = await request(`/api/ordering/orders/${second.body.order.order_code}/payment`, { method: "POST", headers: { authorization: `Bearer ${memberToken}` }, body: JSON.stringify({ payment_status: "paid" }) }); assert.ok([404, 405].includes(customerPayment.response.status)); pass("顧客不可標記付款");
const paidOrder = await request(`/api/ordering/orders/${orderCode}`, { headers: { authorization: `Bearer ${memberToken}` } }); assert.equal(paidOrder.response.status, 200); assert.equal(paidOrder.body.order.payment_status, "paid"); pass("付款僅為店家人工確認");
assert.equal(passed, 35);
console.log(JSON.stringify({ result: "PASS", passed, total: 35, order_code: orderCode }));
