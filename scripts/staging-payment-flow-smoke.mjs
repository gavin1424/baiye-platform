import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const api = process.env.STAGING_API_URL;
const origin = process.env.STAGING_ORIGIN;
if (!api || !origin) throw new Error("STAGING_API_URL and STAGING_ORIGIN are required");
const expectedQrHash = process.env.STAGING_PAYMENT_QR_SHA256?.toLowerCase();
const outputDirectory = process.env.STAGING_SMOKE_OUTPUT_DIR;
if (outputDirectory) await mkdir(outputDirectory, { recursive: true });

const plans = [
  ["baiye_standard_18000_addons", 1800000, 0],
  ["baiye_commerce_ai_50000", 5000000, 0],
  ["baiye_softpos_24000", 600000, 1800000],
];
const signature = { strokes: [[[8, 8], [24, 31], [48, 14], [76, 38], [102, 20], [132, 42]], [[14, 66], [39, 84], [69, 62], [101, 88], [134, 68], [166, 91]]] };

async function request(path, { method = "GET", body, cookie, csrf, idempotencyKey } = {}) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      origin,
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(csrf ? { "x-csrf-token": csrf } : {}),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      "x-device-id": "merchant-payment-v1-staging-smoke",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`${method} ${path} -> ${response.status} ${response.headers.get("content-type")} ${text.slice(0, 240)}`); }
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text}`);
  return { response, data };
}

const results = [];
for (let index = 0; index < plans.length; index += 1) {
  const [planId, signatureDue, remaining] = plans[index];
  const suffix = `${Date.now()}`.slice(-6);
  const phone = `096${index}${suffix}`;
  const registered = await request("/api/merchant/register", {
    method: "POST",
    body: { phone, password: "48261735", password_confirm: "48261735", privacy_consent: true, consent_version: "merchant-registration-v1", intended_plan: planId },
  });
  const cookie = registered.response.headers.get("set-cookie")?.split(";")[0];
  const csrf = registered.data.csrf_token;
  if (!cookie || !csrf) throw new Error(`Registration session missing for ${planId}`);
  await request("/api/merchant/plans/select", { method: "POST", body: { plan_id: planId, installment_plan_requested: 24 }, cookie, csrf });
  const current = await request("/api/merchant/contracts/current", { cookie });
  if (Number(current.data.terms.payment_due_at_signature_minor) !== signatureDue || Number(current.data.terms.remaining_amount_minor) !== remaining) throw new Error(`Authoritative terms mismatch for ${planId}`);
  const signBody = { signatory_legal_name: "測試代表", signatory_role: "legal_representative", legal_representative_name: "測試代表", tax_id: "12345678", read: true, commercial_terms: true, authority: true, signature_evidence: true, electronic: true, signature };
  await request("/api/merchant/contracts/sign-preview", { method: "POST", body: signBody, cookie, csrf });
  const signed = await request("/api/merchant/contracts/sign", { method: "POST", body: signBody, cookie, csrf, idempotencyKey: `staging-${planId}-${randomUUID()}` });
  if (signed.data.lifecycle_status !== "SIGNED_PENDING_PAYMENT" || signed.data.payment.amount_due_minor !== signatureDue) throw new Error(`Signing payment mismatch for ${planId}`);
  const paymentId = signed.data.payment.id;
  const qrResponse = await fetch(`${api}/api/merchant/contract-payments/${paymentId}/qr`, { headers: { origin, cookie } });
  if (!qrResponse.ok) throw new Error(`Payment QR download failed for ${planId}: ${qrResponse.status}`);
  const qrBytes = Buffer.from(await qrResponse.arrayBuffer());
  const qrHash = createHash("sha256").update(qrBytes).digest("hex");
  if (expectedQrHash && qrHash !== expectedQrHash) throw new Error(`Payment QR hash mismatch for ${planId}`);
  const submitted = await request(`/api/merchant/contract-payments/${paymentId}/submit`, { method: "POST", body: { payment_at: new Date().toISOString(), transaction_reference: `STAGING-${index + 1}`, note: "隔離測試，無真實交易" }, cookie, csrf });
  if (submitted.data.payment.status !== "submitted") throw new Error(`Submission failed for ${planId}`);
  let confirmed = null;
  if (process.env.STAGING_ADMIN_TOKEN && process.env.STAGING_ADMIN_CSRF) {
    confirmed = await request(`/api/admin/merchant-payments/${paymentId}/confirm`, { method: "POST", cookie: `baiye_admin_session=${process.env.STAGING_ADMIN_TOKEN}`, csrf: process.env.STAGING_ADMIN_CSRF });
    if (confirmed.data.payment.status !== "confirmed") throw new Error(`Confirmation failed for ${planId}`);
  }
  const pdfResponse = await fetch(`${api}/api/merchant/contracts/${signed.data.signature_id}/pdf`, { headers: { origin, cookie } });
  if (!pdfResponse.ok) throw new Error(`PDF download failed for ${planId}: ${pdfResponse.status}`);
  const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer());
  const pdfHash = createHash("sha256").update(pdfBytes).digest("base64url");
  if (pdfHash !== signed.data.pdf_hash) throw new Error(`PDF hash mismatch for ${planId}`);
  if (outputDirectory) await writeFile(join(outputDirectory, `${planId}.pdf`), pdfBytes);
  results.push({ plan_id: planId, contract_version: current.data.contract.id, signature_due_minor: signatureDue, remaining_amount_minor: remaining, signature_id: signed.data.signature_id, payment_request_id: paymentId, payment_status: confirmed ? "confirmed" : "submitted", lifecycle_status: confirmed?.data.payment.lifecycle_status || signed.data.lifecycle_status, payment_qr_sha256: qrHash, pdf_hash: pdfHash });
}

console.log(JSON.stringify(results, null, 2));
