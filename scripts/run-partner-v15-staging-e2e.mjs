import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const workerUrl = process.env.CONTRACT_STAGING_WORKER_URL;
const origin = process.env.CONTRACT_STAGING_ORIGIN;
if (!workerUrl?.includes("contract-signing-staging") || !origin?.includes("contract-signing-staging.pages.dev")) {
  throw new Error("Staging-only guard rejected target");
}

const runId = Date.now().toString(36);
const digits = String(Date.now()).slice(-7);
const phone = `091${digits}`;
const legalName = "測試姓名";

function stagingTaiwanId(seed) {
  const letterValue = 10; // A
  const firstEight = `1${String(seed).replace(/\D/g, "").slice(-7).padStart(7, "0")}`;
  let sum = Math.floor(letterValue / 10) + (letterValue % 10) * 9;
  [...firstEight].forEach((digit, index) => { sum += Number(digit) * (8 - index); });
  const check = (10 - (sum % 10)) % 10;
  return `A${firstEight}${check}`;
}

const idNumber = stagingTaiwanId(Date.now());
const signature = { strokes: [
  [[18, 18], [34, 31], [51, 17], [69, 38], [87, 21], [105, 44]],
  [[22, 67], [43, 79], [65, 62], [88, 86], [111, 66], [139, 91]],
] };

async function api(path, options = {}) {
  const response = await fetch(`${workerUrl}${path}`, {
    ...options,
    headers: { Origin: origin, "content-type": "application/json", ...(options.headers || {}) },
  });
  const type = response.headers.get("content-type") || "";
  const value = type.includes("json") ? await response.json() : new Uint8Array(await response.arrayBuffer());
  if (!response.ok) throw new Error(`${path} -> ${response.status}: ${JSON.stringify(value)}`);
  return { response, value };
}

const post = (path, body, headers = {}) => api(path, { method: "POST", body: JSON.stringify(body), headers });
const applied = await post("/api/partner/apply", {
  legal_name: legalName,
  id_number: idNumber,
  email: `partner-v15-${runId}@staging.invalid`,
  phone,
  company_name: "",
  tax_id: "",
  note: "STAGING V1.5 E2E｜NOT A REAL CONTRACT",
  consent: true,
});
const activationToken = decodeURIComponent(new URL(applied.value.activation_url).hash.split("token=")[1] || "");
const activated = await post("/api/partner/accept-invite", { token: activationToken });
const partnerCookie = activated.response.headers.get("set-cookie")?.match(/partner_session=([^;]+)/)?.[1];
if (!partnerCookie) throw new Error("Activation did not issue a secure Partner session");
const headers = { cookie: `partner_session=${partnerCookie}` };
const current = await api("/api/partner/contract/current", { headers });
const consent = { legal_name: legalName, read: true, electronic: true, independent: true, identity: true, block_letter_signature: true, signature };
const preview = await post("/api/partner/contract/sign-preview", consent, headers);
const signHeaders = { ...headers, "idempotency-key": `partner-v15-${runId}` };
const signed = await post("/api/partner/contract/sign", consent, signHeaders);
const replay = await post("/api/partner/contract/sign", consent, signHeaders);
const pdf = await api(`/api/partner/contracts/${signed.value.signature_id}/pdf`, { headers });
if (process.env.CONTRACT_STAGING_PDF_OUTPUT) {
  const outputPath = resolve(process.env.CONTRACT_STAGING_PDF_OUTPUT);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, pdf.value);
}
const dashboard = await api("/api/partner/dashboard", { headers });
const verification = await api(`/api/contract-verification/${signed.value.public_id}`);

const serializedVerification = JSON.stringify(verification.value);
const result = {
  run_id: runId,
  partner_id: applied.value.id,
  signature_id: signed.value.signature_id,
  application_masked: applied.value.id_number_masked === `******${idNumber.slice(-4)}`,
  membership_created: Boolean(applied.value.membership?.id),
  welcome_coupon_absent: !applied.value.coupon,
  activation_session: true,
  contract_version: current.value.version,
  legal_review_status: current.value.legal_review_status,
  is_active: Number(current.value.is_active),
  preview_masked: preview.value.id_number_masked === `******${idNumber.slice(-4)}`,
  preview_term_months: preview.value.contract_period?.term_months,
  signed: Boolean(signed.value.signature_id),
  idempotency_replay: replay.value.signature_id === signed.value.signature_id,
  pdf_bytes: pdf.value.byteLength,
  document_hash: Boolean(signed.value.document_hash),
  pdf_hash: Boolean(signed.value.pdf_hash),
  dashboard_term_months: dashboard.value.contract?.period?.contract_term_months,
  dashboard_period_start: dashboard.value.contract?.period?.period_start,
  dashboard_period_end: dashboard.value.contract?.period?.period_end,
  public_verification_no_id: !serializedVerification.includes(idNumber) && !serializedVerification.includes(idNumber.slice(-4)),
};

if (!result.application_masked || !result.membership_created || !result.welcome_coupon_absent || result.contract_version !== "v1.5" || result.legal_review_status !== "pending_review" || result.is_active !== 0 || !result.preview_masked || result.preview_term_months !== 3 || !result.signed || !result.idempotency_replay || result.pdf_bytes < 1000 || !result.document_hash || !result.pdf_hash || result.dashboard_term_months !== 3 || !result.public_verification_no_id) {
  throw new Error(`Partner v1.5 Staging E2E failed: ${JSON.stringify(result)}`);
}
console.log(JSON.stringify({ ok: true, ...result }));
