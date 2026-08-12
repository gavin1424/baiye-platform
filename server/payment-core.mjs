import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export class PaymentError extends Error {
  constructor(message, statusCode = 400, code = "PAYMENT_ERROR") {
    super(message);
    this.name = "PaymentError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const allowedFulfillmentTypes = new Set(["delivery", "store-pickup", "digital-service"]);
const allowedPaymentMethods = new Set(["card", "apple-pay", "line-pay"]);
const allowedNotificationStatuses = new Set(["pending", "paid", "failed", "cancelled", "refunded"]);

export function loadCatalog(catalogPath) {
  return JSON.parse(readFileSync(catalogPath, "utf8"));
}

function safeText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function sanitizeCustomer(customer = {}) {
  if ("cardNumber" in customer || "cvv" in customer || "cvc" in customer || "securityCode" in customer) {
    throw new PaymentError("付款 API 不接受完整卡號或安全碼", 400, "RAW_CARD_DATA_REJECTED");
  }
  const normalized = {
    name: safeText(customer.name, 80),
    phone: safeText(customer.phone, 30),
    email: safeText(customer.email, 160).toLowerCase(),
    address: safeText(customer.address, 240),
    note: safeText(customer.note, 500),
  };
  if (normalized.name.length < 2) throw new PaymentError("顧客姓名格式不正確", 400, "INVALID_CUSTOMER_NAME");
  if (!/^0[2-9]\d{7,8}$|^09\d{8}$/.test(normalized.phone.replace(/[\s-]/g, ""))) {
    throw new PaymentError("聯絡電話格式不正確", 400, "INVALID_CUSTOMER_PHONE");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
    throw new PaymentError("Email 格式不正確", 400, "INVALID_CUSTOMER_EMAIL");
  }
  return normalized;
}

export function calculateOrder({ items, fulfillmentType }, catalog) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
    throw new PaymentError("購物車商品數量不正確", 400, "INVALID_CART");
  }
  if (!allowedFulfillmentTypes.has(fulfillmentType)) {
    throw new PaymentError("不支援的交付方式", 400, "INVALID_FULFILLMENT");
  }
  const normalizedItems = items.map((item) => {
    const quantity = Number(item.quantity);
    const product = catalog.find((candidate) => candidate.id === Number(item.productId));
    if (!product || !product.active) throw new PaymentError("商品不存在或已下架", 409, "PRODUCT_UNAVAILABLE");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new PaymentError("商品數量不正確", 400, "INVALID_QUANTITY");
    }
    if (product.stock < quantity) {
      throw new PaymentError(`「${product.name}」庫存不足`, 409, "INSUFFICIENT_STOCK");
    }
    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      price: product.price,
      quantity,
    };
  });
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = fulfillmentType === "delivery" ? 120 : fulfillmentType === "store-pickup" ? 60 : 0;
  const total = subtotal + shippingFee;
  if (!Number.isSafeInteger(total) || total < 1 || total > 10_000_000) {
    throw new PaymentError("訂單金額超出允許範圍", 400, "INVALID_ORDER_AMOUNT");
  }
  return { items: normalizedItems, subtotal, shippingFee, total };
}

function createInitialState(seed = {}) {
  return {
    orders: Array.isArray(seed.orders) ? [...seed.orders] : [],
    processedEvents: Array.isArray(seed.processedEvents) ? [...seed.processedEvents] : [],
    refundDrafts: Array.isArray(seed.refundDrafts) ? [...seed.refundDrafts] : [],
  };
}

export function createMemoryPaymentRepository(seed = {}) {
  let state = createInitialState(seed);
  return {
    findByCheckoutId(checkoutId) {
      return state.orders.find((order) => order.checkoutId === checkoutId) || null;
    },
    findByOrderNumber(orderNumber) {
      return state.orders.find((order) => order.orderNumber === orderNumber) || null;
    },
    saveOrder(order) {
      const index = state.orders.findIndex((item) => item.orderNumber === order.orderNumber);
      state.orders = index >= 0
        ? state.orders.map((item, itemIndex) => itemIndex === index ? order : item)
        : [order, ...state.orders];
      return order;
    },
    hasProcessedEvent(eventId) {
      return state.processedEvents.includes(eventId);
    },
    markProcessedEvent(eventId) {
      if (!state.processedEvents.includes(eventId)) state.processedEvents.push(eventId);
    },
    saveRefundDraft(draft) {
      state.refundDrafts = [draft, ...state.refundDrafts];
      return draft;
    },
    snapshot() {
      return structuredClone(state);
    },
  };
}

export function createJsonFilePaymentRepository(filePath) {
  const readState = () => {
    if (!existsSync(filePath)) return createInitialState();
    try {
      return createInitialState(JSON.parse(readFileSync(filePath, "utf8")));
    } catch {
      throw new PaymentError("付款資料檔案無法讀取", 500, "PAYMENT_STORE_READ_FAILED");
    }
  };
  let state = readState();
  const persist = () => {
    mkdirSync(dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
    renameSync(temporaryPath, filePath);
  };
  return {
    findByCheckoutId(checkoutId) {
      return state.orders.find((order) => order.checkoutId === checkoutId) || null;
    },
    findByOrderNumber(orderNumber) {
      return state.orders.find((order) => order.orderNumber === orderNumber) || null;
    },
    saveOrder(order) {
      const index = state.orders.findIndex((item) => item.orderNumber === order.orderNumber);
      state.orders = index >= 0
        ? state.orders.map((item, itemIndex) => itemIndex === index ? order : item)
        : [order, ...state.orders];
      persist();
      return order;
    },
    hasProcessedEvent(eventId) {
      return state.processedEvents.includes(eventId);
    },
    markProcessedEvent(eventId) {
      if (!state.processedEvents.includes(eventId)) {
        state.processedEvents.push(eventId);
        persist();
      }
    },
    saveRefundDraft(draft) {
      state.refundDrafts = [draft, ...state.refundDrafts];
      persist();
      return draft;
    },
    snapshot() {
      return structuredClone(state);
    },
  };
}

function makeOrderNumber(now = new Date()) {
  const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  return `BY${datePart}${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function publicOrder(order) {
  const { checkoutId: _checkoutId, ...safeOrder } = order;
  return safeOrder;
}

export function createPaymentService({
  mode = "mock",
  catalog,
  repository,
  fetchImpl = globalThis.fetch,
  env = process.env,
  now = () => new Date(),
}) {
  if (!Array.isArray(catalog) || !repository) throw new Error("Payment service requires catalog and repository");
  if (!["mock", "sandbox", "production"].includes(mode)) throw new Error("Invalid PAYMENT_MODE");

  async function createPayment(input = {}) {
    const checkoutId = safeText(input.checkoutId, 100);
    if (checkoutId.length < 8) throw new PaymentError("checkoutId 格式不正確", 400, "INVALID_CHECKOUT_ID");
    const existing = repository.findByCheckoutId(checkoutId);
    if (existing) return { order: publicOrder(existing), duplicate: true };
    if (!allowedPaymentMethods.has(input.paymentMethod)) {
      throw new PaymentError("不支援的付款方式", 400, "INVALID_PAYMENT_METHOD");
    }
    const customer = sanitizeCustomer(input.customer);
    const totals = calculateOrder(input, catalog);
    const createdAt = now().toISOString();
    const baseOrder = {
      id: randomUUID(),
      checkoutId,
      orderNumber: makeOrderNumber(now()),
      ...totals,
      customer,
      fulfillmentType: input.fulfillmentType,
      paymentMethod: input.paymentMethod,
      paymentStatus: "pending",
      status: "processing",
      provider: "tappay",
      providerReference: null,
      createdAt,
      updatedAt: createdAt,
    };

    if (mode === "mock") {
      const outcome = ["success", "failure", "cancelled"].includes(input.testOutcome) ? input.testOutcome : "success";
      const paymentStatus = outcome === "success" ? "paid" : outcome === "failure" ? "failed" : "cancelled";
      const order = {
        ...baseOrder,
        paymentStatus,
        status: paymentStatus === "paid" ? "paid" : paymentStatus === "cancelled" ? "cancelled" : "processing",
        providerReference: `TEST-${createHash("sha256").update(checkoutId).digest("hex").slice(0, 14).toUpperCase()}`,
        updatedAt: now().toISOString(),
      };
      repository.saveOrder(order);
      return { order: publicOrder(order), duplicate: false, testMode: true };
    }

    if (mode === "production" && env.ALLOW_LIVE_PAYMENTS !== "true") {
      throw new PaymentError("正式扣款安全鎖尚未啟用", 503, "LIVE_PAYMENTS_DISABLED");
    }
    const partnerKey = safeText(env.TAPPAY_PARTNER_KEY, 300);
    const merchantId = safeText(env.TAPPAY_MERCHANT_ID, 120);
    const prime = safeText(input.prime, 1000);
    if (!partnerKey || !merchantId || !prime) {
      throw new PaymentError("TapPay 伺服器設定或一次性 Prime 尚未完成", 503, "TAPPAY_CONFIGURATION_MISSING");
    }
    const endpoint = mode === "production"
      ? "https://prod.tappaysdk.com/tpc/payment/pay-by-prime"
      : "https://sandbox.tappaysdk.com/tpc/payment/pay-by-prime";
    const providerResponse = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": partnerKey },
      body: JSON.stringify({
        prime,
        partner_key: partnerKey,
        merchant_id: merchantId,
        details: `百業共創訂單 ${baseOrder.orderNumber}`,
        amount: totals.total,
        cardholder: {
          phone_number: customer.phone,
          name: customer.name,
          email: customer.email,
        },
        remember: false,
      }),
    });
    const providerResult = await providerResponse.json();
    const paid = providerResponse.ok && providerResult.status === 0;
    const order = {
      ...baseOrder,
      paymentStatus: paid ? "paid" : "failed",
      status: paid ? "paid" : "processing",
      providerReference: safeText(providerResult.rec_trade_id, 160) || null,
      providerStatus: Number.isInteger(providerResult.status) ? providerResult.status : null,
      updatedAt: now().toISOString(),
    };
    repository.saveOrder(order);
    return { order: publicOrder(order), duplicate: false, testMode: mode !== "production" };
  }

  function applyPaymentNotification(input = {}) {
    const eventId = safeText(input.eventId, 160);
    const orderNumber = safeText(input.orderNumber, 80);
    if (!eventId || !orderNumber || !allowedNotificationStatuses.has(input.paymentStatus)) {
      throw new PaymentError("付款通知格式不正確", 400, "INVALID_PAYMENT_NOTIFICATION");
    }
    if (repository.hasProcessedEvent(eventId)) {
      const existingOrder = repository.findByOrderNumber(orderNumber);
      return { order: existingOrder ? publicOrder(existingOrder) : null, duplicate: true };
    }
    const order = repository.findByOrderNumber(orderNumber);
    if (!order) throw new PaymentError("找不到付款通知對應訂單", 404, "ORDER_NOT_FOUND");
    const updated = {
      ...order,
      paymentStatus: input.paymentStatus,
      status: input.paymentStatus === "paid" ? "paid" : input.paymentStatus === "cancelled" ? "cancelled" : order.status,
      providerReference: safeText(input.providerReference, 160) || order.providerReference,
      updatedAt: now().toISOString(),
    };
    repository.saveOrder(updated);
    repository.markProcessedEvent(eventId);
    return { order: publicOrder(updated), duplicate: false };
  }

  function prepareRefund(input = {}) {
    const orderNumber = safeText(input.orderNumber, 80);
    const order = repository.findByOrderNumber(orderNumber);
    if (!order) throw new PaymentError("找不到訂單", 404, "ORDER_NOT_FOUND");
    if (order.paymentStatus !== "paid") throw new PaymentError("只有已付款訂單可建立退款草稿", 409, "ORDER_NOT_PAID");
    const amount = Number(input.amount);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > order.total) {
      throw new PaymentError("退款金額不正確", 400, "INVALID_REFUND_AMOUNT");
    }
    const draft = {
      id: `RFD-${randomUUID()}`,
      orderNumber,
      amount,
      reason: safeText(input.reason, 300),
      status: "prepared",
      requiresManualApproval: true,
      executesRealRefund: false,
      createdAt: now().toISOString(),
    };
    repository.saveRefundDraft(draft);
    return draft;
  }

  return { createPayment, applyPaymentNotification, prepareRefund };
}
