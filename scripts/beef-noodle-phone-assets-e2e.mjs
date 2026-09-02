import assert from "node:assert/strict";

const api = process.env.BEEF_DEMO_API || "https://chuang-baiye-ordering-staging.baiye-platform.workers.dev";
const origin = process.env.BEEF_DEMO_ORIGIN || "https://baiye-beef-noodle-demo.pages.dev";
const phone = process.env.DEMO_ADMIN_PHONE;
if (!/^09\d{8}$/.test(phone || "")) throw new Error("DEMO_ADMIN_PHONE must be a Staging Taiwan mobile number.");

let passed = 0;
const pass = (label) => console.log(`PASS ${String(++passed).padStart(2, "0")} ${label}`);
const request = async (path, init = {}) => {
  const response = await fetch(`${api}${path}`, { ...init, headers: { origin, ...(init.headers || {}) } });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("json") ? await response.json() : await response.arrayBuffer();
  return { response, body };
};
const jsonRequest = (path, init = {}) => request(path, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });

const start = await jsonRequest("/api/merchant-auth/login/start", { method: "POST", headers: { "x-device-id": "beef-phone-v2" }, body: JSON.stringify({ phone }) });
assert.equal(start.response.status, 200, JSON.stringify(start.body));
assert.equal(start.body.code, "VERIFICATION_REQUIRED");
assert.match(start.body.staging_otp, /^\d{6}$/);
pass("Staging OTP challenge issued by normal Merchant Auth");

const wrong = await jsonRequest("/api/merchant-auth/login/verify", { method: "POST", headers: { "x-device-id": "beef-phone-v2" }, body: JSON.stringify({ challenge_id: start.body.challenge_id, code: "999999" === start.body.staging_otp ? "888888" : "999999" }) });
assert.equal(wrong.response.status, 401);
assert.equal(wrong.body.code, "OTP_INVALID");
pass("Wrong OTP rejected");

const verified = await jsonRequest("/api/merchant-auth/login/verify", { method: "POST", headers: { "x-device-id": "beef-phone-v2" }, body: JSON.stringify({ challenge_id: start.body.challenge_id, code: start.body.staging_otp }) });
assert.equal(verified.response.status, 200, JSON.stringify(verified.body));
assert.equal(verified.body.merchant.id, "demo_beef_noodle");
assert.equal(verified.body.administrator.internal_role, "merchant_owner");
assert.ok(verified.body.platform_member.id);
assert.ok(verified.body.platform_session.token);
const platformMemberId = verified.body.platform_member.id;
const memberToken = verified.body.platform_session.token;
const cookie = verified.response.headers.get("set-cookie");
let csrf = verified.body.csrf_token;
assert.ok(cookie && csrf);
pass("Verified phone reused canonical Platform Member and issued Merchant Session");

const replay = await jsonRequest("/api/merchant-auth/login/verify", { method: "POST", body: JSON.stringify({ challenge_id: start.body.challenge_id, code: start.body.staging_otp }) });
assert.ok([401, 409].includes(replay.response.status));
pass("OTP replay rejected");

const merchantRequest = async (path, init = {}) => request(path, { ...init, headers: { cookie, ...(init.method && init.method !== "GET" ? { "x-csrf-token": csrf } : {}), ...(init.headers || {}) } });
const merchantJson = (path, init = {}) => merchantRequest(path, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
const dashboard = await merchantRequest("/api/merchant-admin/dashboard");
assert.equal(dashboard.response.status, 200);
assert.equal(dashboard.body.membership.platform_member, true);
assert.equal(dashboard.body.membership.merchant_relationship, true);
pass("Dashboard confirms Platform Member and beef-noodle relationship");

const cleanStart = await merchantJson("/api/merchant-admin/demo/reset", { method: "POST", body: "{}" });
assert.equal(cleanStart.response.status, 200, JSON.stringify(cleanStart.body));
const overview = await merchantRequest("/api/merchant-admin/ordering/overview");
assert.equal(overview.response.status, 200);
const product = overview.body.items.find((item) => item.id === "bn_item_01");
assert.ok(product);
const originalImage = product.image_url;
const uniqueTokens = [
  "myJghWaqQbCwMInWWsBUf2xRwsR02saT",
  "FYBPEA-F44pPvPGkkP3d2vecgjTdFTPk",
  "GgMBur68drtdBZZlndLJ6iq-n3QiU9hk",
];
pass("Existing menu and opaque QR set reused");

let orderingMemberToken = "";
let a1OrderingToken = "";
for (const token of uniqueTokens) {
  const joined = await jsonRequest(`/api/ordering/qr/${token}/join`, { method: "POST", headers: { authorization: `Bearer ${memberToken}`, "x-device-id": "beef-phone-v2" }, body: JSON.stringify({ phone, privacy_consent: true, consent_version: "DEMO-2026-08-28", device_id: "beef-phone-v2" }) });
  assert.equal(joined.response.status, 201, JSON.stringify(joined.body));
  assert.equal(joined.body.platform_membership.id, platformMemberId);
  orderingMemberToken = joined.body.session.token;
  if (token === uniqueTokens[0]) a1OrderingToken = joined.body.session.token;
}
pass("A1/A2/takeaway QR reuse one Platform Member and relationship");

const editedName = `${product.name} V2`;
const edited = await merchantJson("/api/merchant-admin/ordering/items/bn_item_01", { method: "PATCH", body: JSON.stringify({ name: editedName, price_minor: product.price_minor + 100 }) });
assert.equal(edited.response.status, 200, JSON.stringify(edited.body));
let changedMenu = await request(`/api/ordering/qr/${uniqueTokens[0]}/menu`, { headers: { authorization: `Bearer ${a1OrderingToken}` } });
assert.equal(changedMenu.body.items.find((item) => item.id === "bn_item_01").name, editedName);
assert.equal(changedMenu.body.items.find((item) => item.id === "bn_item_01").price_minor, product.price_minor + 100);
const unpublished = await merchantJson("/api/merchant-admin/ordering/items/bn_item_01", { method: "PATCH", body: JSON.stringify({ status: "hidden" }) });
assert.equal(unpublished.response.status, 200);
changedMenu = await request(`/api/ordering/qr/${uniqueTokens[0]}/menu`, { headers: { authorization: `Bearer ${a1OrderingToken}` } });
assert.ok(!changedMenu.body.items.some((item) => item.id === "bn_item_01"));
const republished = await merchantJson("/api/merchant-admin/ordering/items/bn_item_01", { method: "PATCH", body: JSON.stringify({ status: "active" }) });
assert.equal(republished.response.status, 200);
pass("Product name, price and publish state synchronize to Storefront");

const order = await jsonRequest(`/api/ordering/qr/${uniqueTokens[0]}/orders`, { method: "POST", headers: { authorization: `Bearer ${a1OrderingToken}`, "idempotency-key": `phone-assets-${Date.now()}` }, body: JSON.stringify({ order_type: "dine_in", items: [{ item_id: "bn_item_10", quantity: 1, option_value_ids: [], note: "Phone identity V2 E2E" }] }) });
assert.equal(order.response.status, 201, JSON.stringify(order.body));
assert.equal(order.body.order.table_label, "A1");
const orderOverview = await merchantRequest("/api/merchant-admin/ordering/overview");
assert.ok(orderOverview.body.orders.some((item) => item.order_code === order.body.order.order_code));
pass("QR order appears in the same Merchant order administration");

const bytesByType = {
  "image/jpeg": Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00]),
  "image/png": Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zs5sAAAAASUVORK5CYII=", "base64")),
  "image/webp": Uint8Array.from([0x52,0x49,0x46,0x46,0x04,0,0,0,0x57,0x45,0x42,0x50]),
};
let uploadedPng;
for (const [mime, bytes] of Object.entries(bytesByType)) {
  const form = new FormData();
  form.set("image", new File([bytes], `product.${mime.split("/")[1]}`, { type: mime }));
  const uploaded = await merchantRequest("/api/merchant-admin/products/bn_item_01/image", { method: "POST", body: form });
  assert.equal(uploaded.response.status, 201, JSON.stringify(uploaded.body));
  assert.equal(uploaded.body.content_type, mime);
  assert.match(uploaded.body.image_url, /merchant-assets\/demo_beef_noodle\/products\//);
  const served = await fetch(uploaded.body.image_url);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), mime);
  if (mime === "image/png") uploadedPng = uploaded.body;
}
assert.ok(uploadedPng);
pass("JPEG, PNG and WebP validated and stored in Merchant-scoped R2");

const fakeForm = new FormData();
fakeForm.set("image", new File([Uint8Array.from([0x47,0x49,0x46,0x38,0x39,0x61])], "fake.png", { type: "image/png" }));
const fake = await merchantRequest("/api/merchant-admin/products/bn_item_01/image", { method: "POST", body: fakeForm });
assert.equal(fake.response.status, 415);
pass("Fake MIME rejected server-side");

const largeForm = new FormData();
largeForm.set("image", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }));
const large = await merchantRequest("/api/merchant-admin/products/bn_item_01/image", { method: "POST", body: largeForm });
assert.equal(large.response.status, 413);
pass("Upload larger than 5 MB rejected");

const attach = await merchantJson("/api/merchant-admin/ordering/items/bn_item_01", { method: "PATCH", body: JSON.stringify({ image_url: uploadedPng.image_url }) });
assert.equal(attach.response.status, 200, JSON.stringify(attach.body));
const menu = await request("/api/ordering/qr/myJghWaqQbCwMInWWsBUf2xRwsR02saT/menu", { headers: { authorization: `Bearer ${orderingMemberToken}` } });
assert.equal(menu.response.status, 200);
assert.equal(menu.body.items.find((item) => item.id === "bn_item_01").image_url, uploadedPng.image_url);
pass("Saved product image synchronizes to Storefront");

const cross = await merchantRequest("/api/merchant-admin/products/bn_item_01/image?merchant_id=another_merchant", { method: "POST", body: new FormData() });
assert.equal(cross.response.status, 403);
pass("Cross-merchant image mutation blocked");

const ordinaryPhone = `09${String(Date.now()).slice(-8)}`;
const ordinary = await jsonRequest("/api/ordering/qr/myJghWaqQbCwMInWWsBUf2xRwsR02saT/join", { method: "POST", body: JSON.stringify({ phone: ordinaryPhone, privacy_consent: true, consent_version: "DEMO-2026-08-28", device_id: "ordinary-member-v2" }) });
assert.equal(ordinary.response.status, 201);
const ordinaryLogin = await jsonRequest("/api/merchant-auth/login/start", { method: "POST", body: JSON.stringify({ phone: ordinaryPhone }) });
assert.equal(ordinaryLogin.response.status, 202);
assert.equal(ordinaryLogin.body.code, "MERCHANT_NOT_FOUND");
const ordinaryUpload = await request("/api/merchant-admin/products/bn_item_01/image", { method: "POST", headers: { authorization: `Bearer ${ordinary.body.platform_session.token}` }, body: new FormData() });
assert.equal(ordinaryUpload.response.status, 401);
pass("Ordinary Platform Member is not a Merchant administrator");

const password = await jsonRequest("/api/merchant-demo/login", { method: "POST", body: JSON.stringify({ username: "baiye-beef-demo", password: "not-used" }) });
assert.equal(password.response.status, 404);
pass("Deprecated demo password login disabled");

const reset = await merchantJson("/api/merchant-admin/demo/reset", { method: "POST", body: "{}" });
assert.equal(reset.response.status, 200, JSON.stringify(reset.body));
const restored = await merchantRequest("/api/merchant-admin/ordering/overview");
assert.equal(restored.response.status, 200);
assert.equal(restored.body.items.find((item) => item.id === "bn_item_01").image_url, originalImage);
const dashboardAfterReset = await merchantRequest("/api/merchant-admin/dashboard");
assert.equal(dashboardAfterReset.body.membership.merchant_relationship, true);
assert.equal((await fetch(uploadedPng.image_url)).status, 404);
pass("Demo reset restores Golden image while preserving admin identity relationship");

console.log(JSON.stringify({ result: "PASS", passed, platform_member_id: platformMemberId, merchant_id: "demo_beef_noodle", coupon_created: 0 }));
