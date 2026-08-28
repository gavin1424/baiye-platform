import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateOrderLines,
  canTransitionOrderStatus,
  normalizeTaiwanMobile,
} from "../src/qr-ordering.js";

test("normalizes common Taiwan mobile formats", () => {
  assert.equal(normalizeTaiwanMobile("0912-345-678"), "0912345678");
  assert.equal(normalizeTaiwanMobile("+886 912 345 678"), "0912345678");
  assert.equal(normalizeTaiwanMobile("886912345678"), "0912345678");
  assert.equal(normalizeTaiwanMobile("02-2345-6789"), "");
});

test("recalculates authoritative prices from the menu catalog", () => {
  const result = calculateOrderLines(
    [
      { item_id: "tea", quantity: 2, price_minor: 1 },
      { item_id: "cake", quantity: 1, price_minor: 1 },
    ],
    [
      { id: "tea", name: "紅茶", price_minor: 4500 },
      { id: "cake", name: "蛋糕", price_minor: 8000 },
    ],
  );
  assert.equal(result.ok, true);
  assert.equal(result.subtotal_minor, 17000);
  assert.deepEqual(result.lines.map((line) => line.line_total_minor), [9000, 8000]);
});

test("combines duplicate lines but enforces quantity limits", () => {
  const result = calculateOrderLines(
    [
      { item_id: "tea", quantity: 2 },
      { item_id: "tea", quantity: 3 },
    ],
    [{ id: "tea", name: "紅茶", price_minor: 4500 }],
  );
  assert.equal(result.ok, true);
  assert.equal(result.lines[0].quantity, 5);
  assert.equal(result.total_minor, 22500);

  const rejected = calculateOrderLines(
    [
      { item_id: "tea", quantity: 11 },
      { item_id: "tea", quantity: 10 },
    ],
    [{ id: "tea", name: "紅茶", price_minor: 4500 }],
  );
  assert.equal(rejected.ok, false);
});

test("rejects menu items that are no longer available", () => {
  const result = calculateOrderLines(
    [{ item_id: "sold-out", quantity: 1 }],
    [],
  );
  assert.equal(result.ok, false);
});

test("allows only forward operational order status transitions", () => {
  assert.equal(canTransitionOrderStatus("submitted", "accepted"), true);
  assert.equal(canTransitionOrderStatus("accepted", "preparing"), true);
  assert.equal(canTransitionOrderStatus("preparing", "ready"), true);
  assert.equal(canTransitionOrderStatus("ready", "served"), true);
  assert.equal(canTransitionOrderStatus("served", "completed"), true);
  assert.equal(canTransitionOrderStatus("completed", "preparing"), false);
  assert.equal(canTransitionOrderStatus("cancelled", "accepted"), false);
});
