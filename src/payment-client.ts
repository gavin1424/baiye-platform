import type {
  FulfillmentType,
  PaymentStatus,
  ShopCustomer,
  ShopOrderItem,
  ShopPaymentMethod,
} from "./shop-types";

type TestOutcome = "success" | "failure" | "cancelled";

export type PaymentRequest = {
  checkoutId: string;
  items: ShopOrderItem[];
  customer: ShopCustomer;
  fulfillmentType: FulfillmentType;
  paymentMethod: ShopPaymentMethod;
  testOutcome: TestOutcome;
  prime?: string;
};

export type PaymentResult = {
  status: PaymentStatus;
  providerReference: string;
  source: "local-test" | "payment-api";
};

const paymentApiUrl = (import.meta.env.VITE_PAYMENT_API_URL || "").trim().replace(/\/$/, "");

export async function processPayment(request: PaymentRequest): Promise<PaymentResult> {
  if (!paymentApiUrl) {
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    return {
      status: request.testOutcome === "success" ? "paid" : request.testOutcome === "failure" ? "failed" : "cancelled",
      providerReference: `LOCAL-TEST-${request.checkoutId}`,
      source: "local-test",
    };
  }

  const response = await fetch(`${paymentApiUrl}/api/payments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      checkoutId: request.checkoutId,
      items: request.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      customer: request.customer,
      fulfillmentType: request.fulfillmentType,
      paymentMethod: request.paymentMethod,
      testOutcome: request.testOutcome,
      prime: request.prime,
    }),
  });
  const payload = await response.json();
  if (!payload.order) {
    throw new Error(payload.error || "付款服務暫時無法使用");
  }
  return {
    status: payload.order.paymentStatus,
    providerReference: payload.order.providerReference || "",
    source: "payment-api",
  };
}
