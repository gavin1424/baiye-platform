import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  PaymentError,
  createJsonFilePaymentRepository,
  createPaymentService,
  loadCatalog,
} from "./payment-core.mjs";

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(serverDirectory, "..");
const catalog = loadCatalog(resolve(projectRoot, "data/shop-products.json"));
const mode = process.env.PAYMENT_MODE || "mock";
const dataFile = resolve(projectRoot, process.env.PAYMENT_DATA_FILE || "data/payment-runtime.local.json");
const repository = createJsonFilePaymentRepository(dataFile);
const paymentService = createPaymentService({ mode, catalog, repository, env: process.env });
const port = Number(process.env.PAYMENT_PORT || 8787);
const allowedOrigins = new Set(
  (process.env.PAYMENT_ALLOWED_ORIGINS || "http://127.0.0.1:4173,http://localhost:4173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function sendJson(response, statusCode, payload, origin = "") {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  };
  if (origin && allowedOrigins.has(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "origin";
  }
  response.writeHead(statusCode, headers);
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let length = 0;
    request.on("data", (chunk) => {
      length += chunk.length;
      if (length > 64 * 1024) {
        reject(new PaymentError("請求內容過大", 413, "PAYLOAD_TOO_LARGE"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      const raw = Buffer.concat(chunks);
      try {
        resolveBody({ raw, json: raw.length ? JSON.parse(raw.toString("utf8")) : {} });
      } catch {
        reject(new PaymentError("JSON 格式不正確", 400, "INVALID_JSON"));
      }
    });
    request.on("error", reject);
  });
}

function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET || "";
  if (!secret || typeof signature !== "string") return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const actual = signature.replace(/^sha256=/, "");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin || "";
  const url = new URL(request.url || "/", "http://localhost");
  if (request.method === "OPTIONS") {
    if (!allowedOrigins.has(origin)) return sendJson(response, 403, { error: "Origin not allowed" });
    response.writeHead(204, {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,x-baiye-webhook-signature",
      "access-control-max-age": "600",
      vary: "origin",
    });
    return response.end();
  }
  if (origin && !allowedOrigins.has(origin)) return sendJson(response, 403, { error: "Origin not allowed" });

  try {
    if (request.method === "GET" && url.pathname === "/api/payment/health") {
      return sendJson(response, 200, { ok: true, provider: "tappay", mode, livePaymentsEnabled: mode === "production" && process.env.ALLOW_LIVE_PAYMENTS === "true" }, origin);
    }
    if (request.method === "POST" && url.pathname === "/api/payments") {
      const { json } = await readBody(request);
      const result = await paymentService.createPayment(json);
      return sendJson(response, result.order.paymentStatus === "paid" ? 201 : 402, result, origin);
    }
    if (request.method === "POST" && url.pathname === "/api/payments/notifications/tappay") {
      const { raw, json } = await readBody(request);
      if (!verifyWebhookSignature(raw, request.headers["x-baiye-webhook-signature"])) {
        throw new PaymentError("付款通知簽章驗證失敗", 401, "INVALID_WEBHOOK_SIGNATURE");
      }
      return sendJson(response, 200, paymentService.applyPaymentNotification(json), origin);
    }
    if (request.method === "POST" && url.pathname === "/api/refunds/prepare") {
      const { json } = await readBody(request);
      return sendJson(response, 201, { refund: paymentService.prepareRefund(json) }, origin);
    }
    return sendJson(response, 404, { error: "Not found" }, origin);
  } catch (error) {
    const statusCode = error instanceof PaymentError ? error.statusCode : 500;
    const code = error instanceof PaymentError ? error.code : "INTERNAL_ERROR";
    const message = error instanceof PaymentError ? error.message : "付款服務暫時無法使用";
    return sendJson(response, statusCode, { error: message, code }, origin);
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Baiye payment API listening on http://127.0.0.1:${port} (${mode})\n`);
});
