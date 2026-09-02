import assert from "node:assert/strict";

if (!process.argv.includes("--staging-only")) throw new Error("Refusing to run without --staging-only.");
const api = "https://chuang-baiye-ordering-staging.baiye-platform.workers.dev";
const origin = "https://baiye-beef-noodle-demo.pages.dev";
const phone = process.env.DEMO_ADMIN_PHONE;
if (!/^09\d{8}$/.test(phone || "")) throw new Error("DEMO_ADMIN_PHONE must be a Staging Taiwan mobile number.");
let passed = 0;
const pass = (label) => console.log(`PASS ${String(++passed).padStart(2, "0")} ${label}`);
const call = async (path, init = {}) => {
  const response = await fetch(`${api}${path}`, { ...init, headers: { origin, ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers || {}) } });
  return { response, body: await response.json().catch(() => ({})) };
};

const unauthenticated = await call("/api/merchant-admin/inventory");
assert.equal(unauthenticated.response.status, 401); pass("Unauthenticated inventory blocked with 401");
const start = await call("/api/merchant-auth/login/start", { method: "POST", headers: { "x-device-id": "inventory-v1-e2e" }, body: JSON.stringify({ phone }) });
assert.equal(start.response.status, 200, JSON.stringify(start.body)); assert.match(start.body.staging_otp, /^\d{6}$/);
const verified = await call("/api/merchant-auth/login/verify", { method: "POST", headers: { "x-device-id": "inventory-v1-e2e" }, body: JSON.stringify({ challenge_id: start.body.challenge_id, code: start.body.staging_otp }) });
assert.equal(verified.response.status, 200, JSON.stringify(verified.body));
const cookie = verified.response.headers.get("set-cookie"), platformToken = verified.body.platform_session.token, csrf = verified.body.csrf_token;
assert.ok(cookie && platformToken && csrf); pass("Merchant phone login");
const merchant = (path, init = {}) => call(path, { ...init, headers: { cookie, ...(!["GET", "HEAD"].includes(init.method || "GET") ? { "x-csrf-token": csrf } : {}), ...(init.headers || {}) } });

const ordinary = await call("/api/merchant-admin/inventory", { headers: { authorization: `Bearer ${platformToken}` } });
assert.equal(ordinary.response.status, 403); pass("Ordinary Platform Member blocked with 403");
const foreign = await merchant("/api/merchant-admin/inventory?merchant_id=meiling_patchwork");
assert.equal(foreign.response.status, 403); pass("Cross Merchant inventory blocked with 403");

const reset = await merchant("/api/merchant-admin/demo/reset", { method: "POST", body: "{}" });
assert.equal(reset.response.status, 200, JSON.stringify(reset.body)); assert.equal(reset.body.inventory_reset, "blank");
let inventory = await merchant("/api/merchant-admin/inventory");
assert.equal(inventory.response.status, 200); assert.equal(inventory.body.blank, true); assert.equal(inventory.body.items.length, 0); pass("Blank inventory after Demo Reset");
const unlimited = await merchant("/api/merchant-admin/ordering/items/bn_item_01", { method: "PATCH", body: JSON.stringify({ daily_limit: null }) });
assert.equal(unlimited.response.status, 200, JSON.stringify(unlimited.body));

const fake = await merchant("/api/merchant-admin/inventory", { method: "POST", body: JSON.stringify({ menu_item_id: "foreign_or_fake", stock_on_hand: 1, low_stock_threshold: 1 }) });
assert.equal(fake.response.status, 422); pass("Fake menu_item_id rejected");
const created = await merchant("/api/merchant-admin/inventory", { method: "POST", body: JSON.stringify({ menu_item_id: "bn_item_01", stock_on_hand: 10, low_stock_threshold: 5, inventory_enabled: true, notes: "Inventory V1 E2E" }) });
assert.equal(created.response.status, 201, JSON.stringify(created.body)); const inventoryId = created.body.id; pass("Merchant manually created initial stock 10");
const duplicate = await merchant("/api/merchant-admin/inventory", { method: "POST", body: JSON.stringify({ menu_item_id: "bn_item_01", stock_on_hand: 10, low_stock_threshold: 5 }) });
assert.equal(duplicate.response.status, 409); pass("Duplicate inventory rejected");
const negative = await merchant(`/api/merchant-admin/inventory/${inventoryId}/adjust`, { method: "POST", body: JSON.stringify({ adjustment_quantity: -11, reason: "negative guard" }) });
assert.equal(negative.response.status, 409); pass("Negative stock rejected");

const qrs = [
  ["A1", "myJghWaqQbCwMInWWsBUf2xRwsR02saT"],
  ["A2", "FYBPEA-F44pPvPGkkP3d2vecgjTdFTPk"],
  ["外帶", "GgMBur68drtdBZZlndLJ6iq-n3QiU9hk"],
];
const sessions = new Map();
for (const [label, qr] of qrs) {
  const context = await call(`/api/ordering/qr/${qr}`); assert.equal(context.response.status, 200);
  const joined = await call(`/api/ordering/qr/${qr}/join`, { method: "POST", headers: { "x-platform-member-token": platformToken, "x-device-id": "inventory-v1-e2e" }, body: JSON.stringify({ phone, privacy_consent: true, consent_version: context.body.context.consent_version, device_id: "inventory-v1-e2e" }) });
  assert.equal(joined.response.status, 201, `${label}: ${JSON.stringify(joined.body)}`); sessions.set(qr, joined.body.session.token);
}
pass("A1 A2 Takeaway sessions ready");

const menuFor = async (qr) => (await call(`/api/ordering/qr/${qr}/menu`, { headers: { authorization: `Bearer ${sessions.get(qr)}` } })).body;
const selectedOptions = (menu, itemId) => {
  const groupIds = menu.item_option_groups.filter((link) => link.item_id === itemId).map((link) => link.group_id);
  return groupIds.flatMap((groupId) => { const group = menu.option_groups.find((row) => row.id === groupId); return menu.option_values.filter((row) => row.group_id === groupId).slice(0, Number(group?.min_select || 0)).map((row) => row.id); });
};
const place = async (qr, itemQuantities, key) => {
  const menu = await menuFor(qr);
  const purpose = menu.context.qr.purpose;
  return call(`/api/ordering/qr/${qr}/orders`, { method: "POST", headers: { authorization: `Bearer ${sessions.get(qr)}`, "idempotency-key": key }, body: JSON.stringify({ order_type: purpose === "takeaway" ? "takeaway" : "dine_in", items: itemQuantities.map(([itemId, quantity]) => ({ item_id: itemId, quantity, option_value_ids: selectedOptions(menu, itemId) })) }) });
};
const stock = async () => { inventory = await merchant("/api/merchant-admin/inventory"); return inventory.body.items.find((item) => item.id === inventoryId)?.stock_on_hand; };

for (const [index, expected] of [8,5,0].entries()) {
  const [label, qr] = qrs[index], qty = [2,3,5][index]; const order = await place(qr, [["bn_item_01", qty]], `inventory-flow-${index}-${Date.now()}`);
  assert.equal(order.response.status, 201, JSON.stringify(order.body)); assert.equal(await stock(), expected); pass(`${label} deduction to ${expected}`);
}
let menu = await menuFor(qrs[0][1]); const beef = menu.items.find((item) => item.id === "bn_item_01");
assert.equal(beef.status, "sold_out"); assert.equal(beef.stock_on_hand, 0); pass("Storefront sold out sync");
const soldOut = await place(qrs[0][1], [["bn_item_01", 1]], `sold-out-${Date.now()}`);
assert.equal(soldOut.response.status, 409); assert.equal(soldOut.body.code, "INVENTORY_INSUFFICIENT"); pass("Sold out order blocked");

const restock = await merchant(`/api/merchant-admin/inventory/${inventoryId}/restock`, { method: "POST", body: JSON.stringify({ adjustment_quantity: 10 }) });
assert.equal(restock.response.status, 200); assert.equal(await stock(), 10); menu = await menuFor(qrs[0][1]); assert.equal(menu.items.find((item) => item.id === "bn_item_01").status, "active"); pass("Restock re-enabled storefront");
const cancellable = await place(qrs[0][1], [["bn_item_01", 2]], `restore-${Date.now()}`); assert.equal(cancellable.response.status, 201); assert.equal(await stock(), 8);
const cancelPath = `/api/ordering/orders/${cancellable.body.order.order_code}/cancel`;
const cancelled = await call(cancelPath, { method: "POST", headers: { authorization: `Bearer ${sessions.get(qrs[0][1])}` }, body: JSON.stringify({ reason: "Inventory E2E cancellation" }) });
assert.equal(cancelled.response.status, 200); assert.equal(await stock(), 10); pass("Eligible cancellation restored stock");
const doubleRestore = await call(cancelPath, { method: "POST", headers: { authorization: `Bearer ${sessions.get(qrs[0][1])}` }, body: JSON.stringify({ reason: "replay" }) });
assert.equal(doubleRestore.response.status, 409); assert.equal(await stock(), 10); pass("Double restore blocked");

const adjusted = await merchant(`/api/merchant-admin/inventory/${inventoryId}/adjust`, { method: "POST", body: JSON.stringify({ adjustment_quantity: -9, reason: "Concurrency setup" }) });
assert.equal(adjusted.response.status, 200); assert.equal(await stock(), 1); inventory = await merchant("/api/merchant-admin/inventory"); assert.equal(inventory.body.items.find((item) => item.id === inventoryId).inventory_status, "low_stock"); pass("Manual adjustment and low stock warning");
const race = await Promise.all([place(qrs[0][1], [["bn_item_01", 1]], `race-a-${Date.now()}`), place(qrs[1][1], [["bn_item_01", 1]], `race-b-${Date.now()}`)]);
assert.deepEqual(race.map((result) => result.response.status).sort(), [201,409]); assert.equal(await stock(), 0);
inventory = await merchant(`/api/merchant-admin/inventory/${inventoryId}/movements`); assert.equal(inventory.body.items.filter((row) => row.movement_type === "ORDER_DEDUCTION" && row.quantity_delta === -1).length, 1); pass("Concurrent order: one success, one 409, final stock 0");

await merchant(`/api/merchant-admin/inventory/${inventoryId}/restock`, { method: "POST", body: JSON.stringify({ adjustment_quantity: 2 }) });
const soup = await merchant("/api/merchant-admin/inventory", { method: "POST", body: JSON.stringify({ menu_item_id: "bn_item_19", stock_on_hand: 0, low_stock_threshold: 5, inventory_enabled: true }) }); assert.equal(soup.response.status, 201);
const multi = await place(qrs[0][1], [["bn_item_01", 1], ["bn_item_19", 1]], `multi-${Date.now()}`); assert.equal(multi.response.status, 409); assert.equal(await stock(), 2); pass("Multi-item transaction rollback");

const ledger = await merchant(`/api/merchant-admin/inventory/${inventoryId}/movements`); assert.equal(ledger.response.status, 200); assert.ok(ledger.body.items.some((row) => row.movement_type === "INITIAL")); assert.ok(ledger.body.items.some((row) => row.movement_type === "RESTOCK")); assert.ok(ledger.body.items.some((row) => row.movement_type === "MANUAL_ADJUSTMENT")); assert.ok(ledger.body.items.some((row) => row.movement_type === "ORDER_RESTORE")); pass("Inventory movement ledger complete");
const finalReset = await merchant("/api/merchant-admin/demo/reset", { method: "POST", body: "{}" }); assert.equal(finalReset.response.status, 200); inventory = await merchant("/api/merchant-admin/inventory"); assert.equal(inventory.body.blank, true); pass("Demo Reset returns inventory to blank");
console.log(JSON.stringify({ result: "PASS", passed, merchant_id: "demo_beef_noodle", production_modified: false }));
