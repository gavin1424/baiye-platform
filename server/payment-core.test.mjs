import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  PaymentError,
  calculateOrder,
  createMemoryPaymentRepository,
  createPaymentService,
  loadCatalog,
} from "./payment-core.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const catalog = loadCatalog(resolve(directory, "../data/shop-products.json"));
const customer = { name: "王小明", phone: "0912345678", email: "buyer@example.com", address: "台北市中正區測試路一號", note: "測試" };

test("伺服器依權威商品目錄計算金額與運費", () => {
  const result = calculateOrder({ items: [{ productId: 1001, quantity: 2 }], fulfillmentType: "delivery" }, catalog);
  assert.equal(result.subtotal, 1960);
  assert.equal(result.shippingFee, 120);
  assert.equal(result.total, 2080);
});

test("缺貨與超量商品會在付款 API 前被阻擋", () => {
  assert.throws(
    () => calculateOrder({ items: [{ productId: 1002, quantity: 1 }], fulfillmentType: "delivery" }, catalog),
    (error) => error instanceof PaymentError && error.code === "INSUFFICIENT_STOCK",
  );
  assert.throws(
    () => calculateOrder({ items: [{ productId: 1001, quantity: 99 }], fulfillmentType: "delivery" }, catalog),
    (error) => error instanceof PaymentError && error.code === "INSUFFICIENT_STOCK",
  );
});

test("測試付款支援成功、失敗與取消狀態", async () => {
  for (const [outcome, expected] of [["success", "paid"], ["failure", "failed"], ["cancelled", "cancelled"]]) {
    const repository = createMemoryPaymentRepository();
    const service = createPaymentService({ mode: "mock", catalog, repository });
    const result = await service.createPayment({ checkoutId: `checkout-${outcome}`, items: [{ productId: 1003, quantity: 1 }], fulfillmentType: "store-pickup", paymentMethod: "card", customer, testOutcome: outcome });
    assert.equal(result.order.paymentStatus, expected);
    assert.equal(result.testMode, true);
  }
});

test("相同 checkoutId 不會重複建立訂單", async () => {
  const repository = createMemoryPaymentRepository();
  const service = createPaymentService({ mode: "mock", catalog, repository });
  const input = { checkoutId: "checkout-idempotent-001", items: [{ productId: 1004, quantity: 1 }], fulfillmentType: "delivery", paymentMethod: "line-pay", customer, testOutcome: "success" };
  const first = await service.createPayment(input);
  const second = await service.createPayment(input);
  assert.equal(first.order.orderNumber, second.order.orderNumber);
  assert.equal(second.duplicate, true);
  assert.equal(repository.snapshot().orders.length, 1);
});

test("重複付款通知只處理一次且不建立新訂單", async () => {
  const repository = createMemoryPaymentRepository();
  const service = createPaymentService({ mode: "mock", catalog, repository });
  const created = await service.createPayment({ checkoutId: "checkout-webhook-001", items: [{ productId: 1005, quantity: 1 }], fulfillmentType: "delivery", paymentMethod: "card", customer, testOutcome: "failure" });
  const event = { eventId: "evt-001", orderNumber: created.order.orderNumber, paymentStatus: "paid", providerReference: "TEST-PAID-001" };
  const first = service.applyPaymentNotification(event);
  const second = service.applyPaymentNotification(event);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(repository.snapshot().orders.length, 1);
  assert.equal(repository.snapshot().orders[0].paymentStatus, "paid");
});

test("退款僅建立待人工核准草稿，不執行正式退款", async () => {
  const repository = createMemoryPaymentRepository();
  const service = createPaymentService({ mode: "mock", catalog, repository });
  const created = await service.createPayment({ checkoutId: "checkout-refund-001", items: [{ productId: 1006, quantity: 1 }], fulfillmentType: "store-pickup", paymentMethod: "card", customer, testOutcome: "success" });
  const refund = service.prepareRefund({ orderNumber: created.order.orderNumber, amount: 100, reason: "測試退款結構" });
  assert.equal(refund.status, "prepared");
  assert.equal(refund.requiresManualApproval, true);
  assert.equal(refund.executesRealRefund, false);
});
