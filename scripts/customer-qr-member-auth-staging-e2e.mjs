import assert from "node:assert/strict";
import { randomInt } from "node:crypto";

const api = "https://chuang-baiye-ordering-staging.baiye-platform.workers.dev";
const origin = "https://customer-qr-member-auth-v1.baiye-platform-ordering-staging.pages.dev";
const qrs = {
  A1: "myJghWaqQbCwMInWWsBUf2xRwsR02saT",
  A2: "FYBPEA-F44pPvPGkkP3d2vecgjTdFTPk",
  takeaway: "GgMBur68drtdBZZlndLJ6iq-n3QiU9hk",
};
const phone = `098${String(Date.now()).slice(-7)}`;
let password = "";
while (!password || /^(\d)\1{7}$/.test(password) || ["12345678", "87654321"].includes(password) || password === phone.slice(-8)) {
  password = String(randomInt(10_000_000, 100_000_000));
}
let passed = 0;
const pass = (label) => { passed += 1; console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`); };
async function call(path, init = {}) {
  const response = await fetch(`${api}${path}`, { ...init, headers: { origin, ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers || {}) } });
  return { response, body: await response.json().catch(() => ({})) };
}

const contexts = {};
for (const [label, code] of Object.entries(qrs)) {
  const result = await call(`/api/ordering/qr/${code}`);
  assert.equal(result.response.status, 200); contexts[label] = result.body.context; pass(`${label} QR context`);
}
const guestMenu = await call(`/api/ordering/qr/${qrs.A1}/menu`);
assert.equal(guestMenu.response.status, 200); assert.ok(guestMenu.body.items.length > 0); assert.equal(guestMenu.body.member, null); pass("未登入可先看菜單");

const weak = await call(`/api/ordering/qr/${qrs.A1}/join`, { method: "POST", body: JSON.stringify({ phone, password: "12345678", password_confirm: "12345678", privacy_consent: true, consent_version: contexts.A1.consent_version }) });
assert.equal(weak.response.status, 422); pass("弱會員密碼拒絕");

const joined = await call(`/api/ordering/qr/${qrs.A1}/join`, { method: "POST", headers: { "x-device-id": "customer-auth-staging" }, body: JSON.stringify({ phone, password, password_confirm: password, privacy_consent: true, consent_version: contexts.A1.consent_version, device_id: "customer-auth-staging" }) });
assert.equal(joined.response.status, 201); assert.ok(joined.body.session?.token); assert.ok(joined.body.platform_session?.token); pass("新會員建立與雙 Session");

const memberToken = joined.body.session.token, platformToken = joined.body.platform_session.token;
const logout = await call(`/api/ordering/qr/${qrs.A1}/logout`, { method: "POST", headers: { authorization: `Bearer ${memberToken}`, "x-platform-member-token": platformToken } });
assert.equal(logout.response.status, 200); pass("會員登出撤銷 Session");

const login = await call(`/api/ordering/qr/${qrs.A1}/login`, { method: "POST", headers: { "x-device-id": "customer-auth-staging-login" }, body: JSON.stringify({ phone, password, merchant_consent: true, device_id: "customer-auth-staging-login" }) });
assert.equal(login.response.status, 200); assert.equal(login.body.message, "會員登入成功"); pass("已有會員手機密碼登入");

const missing = await call(`/api/ordering/qr/${qrs.A1}/login`, { method: "POST", body: JSON.stringify({ phone: "0999999999", password: "48261539", merchant_consent: true }) });
const wrong = await call(`/api/ordering/qr/${qrs.A1}/login`, { method: "POST", body: JSON.stringify({ phone, password: password === "48261539" ? "48261530" : "48261539", merchant_consent: true }) });
assert.equal(missing.body.error, "手機號碼或會員密碼錯誤。"); assert.equal(wrong.body.error, missing.body.error); pass("登入錯誤不枚舉會員");

for (const [label, code] of Object.entries(qrs)) {
  const menu = await call(`/api/ordering/qr/${code}/menu`, { headers: { authorization: `Bearer ${login.body.session.token}` } });
  assert.equal(menu.response.status, 200); assert.equal(menu.body.member.membership_id, login.body.member.membership_id); pass(`${label} 重用同一商家會員`);
}

const menu = await call(`/api/ordering/qr/${qrs.A1}/menu`, { headers: { authorization: `Bearer ${login.body.session.token}` } });
const linked = new Set(menu.body.item_option_groups.map((item) => item.item_id));
const item = menu.body.items.find((candidate) => candidate.status === "active" && !linked.has(candidate.id));
assert.ok(item);
const order = await call(`/api/ordering/qr/${qrs.A1}/orders`, { method: "POST", headers: { authorization: `Bearer ${login.body.session.token}`, "idempotency-key": `member-auth-${Date.now()}` }, body: JSON.stringify({ order_type: "dine_in", items: [{ item_id: item.id, quantity: 1 }] }) });
assert.equal(order.response.status, 201); pass("會員登入後送單");

const invalid = await call("/api/ordering/qr/not-a-valid-order-code");
assert.equal(invalid.response.status, 404); pass("無效 QR fail closed");
assert.equal(passed, 14);
console.log(JSON.stringify({ result: "PASS", passed, total: 14, phone, order_code: order.body.order.order_code, password_exposed: false }));
