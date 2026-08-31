const E = new TextEncoder();
const LINE_PAY_SANDBOX = "https://sandbox-api-pay.line.me";
const allowedStates = new Set(["created","requires_action","processing","authorized","paid","failed","cancelled","expired","partially_refunded","refunded"]);

const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const hash = async (value) => b64(new Uint8Array(await crypto.subtle.digest("SHA-256", E.encode(String(value)))));
const nonce = () => crypto.randomUUID().replaceAll("-", "");

export const PAYMENT_PROVIDER_CAPABILITIES = Object.freeze({
  manual_counter: { authorize: false, capture: false, refund: true, partial_refund: false, redirect: false, wallet: false, webhook: false },
  line_pay_online: { authorize: true, capture: true, refund: true, partial_refund: true, redirect: true, wallet: true, webhook: false },
  apple_pay_web: { authorize: true, capture: false, refund: false, partial_refund: false, redirect: false, wallet: true, webhook: false },
  future_card_gateway: { authorize: false, capture: false, refund: false, partial_refund: false, redirect: false, wallet: false, webhook: false },
});

function secretReady(env, names) { return names.every((name) => typeof env[name] === "string" && env[name].trim().length > 0); }
function safeProviderResponse(data = {}) {
  return { returnCode: String(data.returnCode || ""), returnMessage: String(data.returnMessage || "").slice(0, 160), transactionId: String(data.info?.transactionId || data.info?.refundTransactionId || "") };
}
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", E.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC", key, E.encode(value))));
}
async function lineRequest(env, apiPath, body) {
  const channelId = env.LINE_PAY_SANDBOX_CHANNEL_ID;
  const channelSecret = env.LINE_PAY_SANDBOX_CHANNEL_SECRET;
  if (!secretReady(env, ["LINE_PAY_SANDBOX_CHANNEL_ID", "LINE_PAY_SANDBOX_CHANNEL_SECRET"])) return { ok: false, code: "LINE_PAY_SANDBOX_CREDENTIAL_REQUIRED" };
  const bodyText = JSON.stringify(body);
  const requestNonce = nonce();
  const authorization = await hmac(channelSecret, `${channelSecret}${apiPath}${bodyText}${requestNonce}`);
  const response = await fetch(`${LINE_PAY_SANDBOX}${apiPath}`, { method: "POST", headers: { "content-type": "application/json", "x-line-channelid": channelId, "x-line-authorization-nonce": requestNonce, "x-line-authorization": authorization }, body: bodyText });
  const text = await response.text();
  // LINE transaction IDs can exceed Number.MAX_SAFE_INTEGER.
  const data = JSON.parse(text.replace(/:\s*(\d{16,})\b/g, ': "$1"'));
  return { ok: response.ok && data.returnCode === "0000", data, safe: safeProviderResponse(data) };
}

export function getPaymentProviderAdapter(provider, env) {
  const capabilities = PAYMENT_PROVIDER_CAPABILITIES[provider] || PAYMENT_PROVIDER_CAPABILITIES.future_card_gateway;
  if (provider === "manual_counter") return Object.freeze({
    getCapabilities: () => capabilities,
    isAvailable: () => ({ available: true, code: "MANUAL_COUNTER_AVAILABLE" }),
    createPayment: async () => ({ ok: true, status: "created" }), getPaymentStatus: async () => ({ ok: true, status: "created" }),
    confirmPayment: async () => ({ ok: false, code: "MERCHANT_MANUAL_CONFIRMATION_REQUIRED" }), cancelPayment: async () => ({ ok: true, status: "cancelled" }), refundPayment: async () => ({ ok: false, code: "MERCHANT_MANUAL_REFUND_REQUIRED" }),
  });
  if (provider === "line_pay_online") return Object.freeze({
    getCapabilities: () => capabilities,
    isAvailable: () => ({ available: secretReady(env, ["LINE_PAY_SANDBOX_CHANNEL_ID", "LINE_PAY_SANDBOX_CHANNEL_SECRET"]), code: "LINE_PAY_SANDBOX_CREDENTIAL_REQUIRED" }),
    createPayment: async ({ amount_minor, currency, order_id, confirm_url, cancel_url, products }) => lineRequest(env, "/v4/payments/request", { amount: amount_minor / 100, currency, orderId: order_id, packages: [{ id: order_id, amount: amount_minor / 100, products }], redirectUrls: { confirmUrl: confirm_url, cancelUrl: cancel_url } }),
    getPaymentStatus: async ({ transaction_id }) => lineRequest(env, `/v4/payments/requests/${encodeURIComponent(transaction_id)}/check`, {}),
    confirmPayment: async ({ transaction_id, amount_minor, currency }) => lineRequest(env, `/v4/payments/${encodeURIComponent(transaction_id)}/confirm`, { amount: amount_minor / 100, currency }),
    cancelPayment: async () => ({ ok: true, status: "cancelled" }),
    refundPayment: async ({ transaction_id, amount_minor }) => lineRequest(env, `/v4/payments/${encodeURIComponent(transaction_id)}/refund`, { refundAmount: amount_minor / 100 }),
  });
  if (provider === "apple_pay_web") return Object.freeze({
    getCapabilities: () => capabilities,
    isAvailable: () => ({ available: secretReady(env, ["APPLE_PAY_MERCHANT_ID", "APPLE_PAY_TEAM_ID", "APPLE_PAY_MERCHANT_IDENTITY_CERT", "APPLE_PAY_MERCHANT_IDENTITY_KEY", "APPLE_PAY_PROCESSING_PROVIDER"]), code: "APPLE_PAY_CONFIGURATION_REQUIRED" }),
    createPayment: async () => ({ ok: false, code: "APPLE_PAY_CONFIGURATION_REQUIRED" }), getPaymentStatus: async () => ({ ok: false, code: "APPLE_PAY_CONFIGURATION_REQUIRED" }),
    confirmPayment: async () => ({ ok: false, code: "APPLE_PAY_PROCESSOR_REQUIRED" }), cancelPayment: async () => ({ ok: false, code: "APPLE_PAY_CONFIGURATION_REQUIRED" }), refundPayment: async () => ({ ok: false, code: "APPLE_PAY_PROCESSOR_REQUIRED" }),
  });
  return Object.freeze({ getCapabilities: () => capabilities, isAvailable: () => ({ available: false, code: "PAYMENT_PROVIDER_DISABLED" }), createPayment: async () => ({ ok: false, code: "PAYMENT_PROVIDER_DISABLED" }), getPaymentStatus: async () => ({ ok: false, code: "PAYMENT_PROVIDER_DISABLED" }), confirmPayment: async () => ({ ok: false, code: "PAYMENT_PROVIDER_DISABLED" }), cancelPayment: async () => ({ ok: false, code: "PAYMENT_PROVIDER_DISABLED" }), refundPayment: async () => ({ ok: false, code: "PAYMENT_PROVIDER_DISABLED" }) });
}

export { allowedStates, hash as hashPaymentAccessToken };
