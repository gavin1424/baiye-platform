import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

if (!process.argv.includes("--production-qa")) throw new Error("Refusing to run without --production-qa.");
const workerUrl = "https://chuang-baiye-ai.baiye-platform.workers.dev";
const origin = "https://baiyeconnect.com";
const outputDir = resolve(process.env.PRODUCTION_PDF_QA_OUTPUT || "tmp/production-pdf-qa");
mkdirSync(outputDir, { recursive: true });

const runId = `${Date.now().toString(36)}${randomUUID().replaceAll("-", "").slice(0, 5)}`;
const password = "12345678";
const signature = { strokes: [
  [[18, 18], [34, 31], [51, 17], [69, 38], [87, 21], [105, 44]],
  [[22, 67], [43, 79], [65, 62], [88, 86], [111, 66], [139, 91]],
] };
const expectedPlans = {
  baiye_standard_18000_addons: { contract: "merchant_service_v1_2_18000_addons", price: 1800000, file: "18k" },
  baiye_commerce_ai_45000: { contract: "merchant_commerce_ai_v1_0_45000", price: 4500000, file: "45k" },
  baiye_softpos_24000: { contract: "merchant_softpos_v1_0_24000", price: 2400000, firstBalance: 1800000, file: "24k" },
};

function taiwanId(seed) {
  const value = `1${String(seed).replace(/\D/g, "").slice(-7).padStart(7, "0")}`;
  let sum = 1 + 0 * 9;
  [...value].forEach((digit, index) => { sum += Number(digit) * (8 - index); });
  return `A${value}${(10 - (sum % 10)) % 10}`;
}

async function api(path, options = {}) {
  const response = await fetch(`${workerUrl}${path}`, {
    ...options,
    headers: { Origin: origin, "user-agent": "Baiye Production UX Auth PDF QA/1.0", ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {}) },
  });
  const contentType = response.headers.get("content-type") || "";
  const value = contentType.includes("json") ? await response.json() : new Uint8Array(await response.arrayBuffer());
  return { response, value };
}
async function ok(path, options = {}) {
  const result = await api(path, options);
  if (!result.response.ok) throw new Error(`${path} -> ${result.response.status}: ${JSON.stringify(result.value)}`);
  return result;
}
const post = (path, body, headers = {}) => ok(path, { method: "POST", body: JSON.stringify(body), headers });
const cookie = (response, name) => response.headers.get("set-cookie")?.match(new RegExp(`${name}=([^;]+)`))?.[1] || "";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("base64url");

for (const invalid of ["1234567", "123456789", "abcd1234"]) {
  const merchantInvalid = await api("/api/merchant-auth/login", { method: "POST", body: JSON.stringify({ phone: "0999999999", password: invalid }) });
  const partnerInvalid = await api("/api/partner/login", { method: "POST", body: JSON.stringify({ phone: "0999999999", password: invalid }) });
  if (merchantInvalid.response.status !== 422 || partnerInvalid.response.status !== 422) throw new Error(`Password format rejection failed: ${invalid}`);
}
for (const path of ["/api/partner/login/start", "/api/partner/login/verify", "/api/merchant-auth/login/start", "/api/merchant-auth/login/verify"]) {
  const response = await api(path, { method: "POST", body: "{}" });
  if (response.response.ok || /OTP|staging_otp|challenge_id|驗證碼/.test(JSON.stringify(response.value))) throw new Error(`Obsolete OTP endpoint remains reachable: ${path}`);
}

const merchantResults = [];
let index = 0;
for (const [planId, expected] of Object.entries(expectedPlans)) {
  index += 1;
  const phone = `09${index}${String(Date.now() + index).slice(-7)}`;
  const registered = await post("/api/merchant/register", { phone, password, password_confirm: password, privacy_consent: true, consent_version: "production-ux-auth-pdf-qa-v1", intended_plan: planId });
  if (registered.value.registration_price_minor !== 0 || registered.value.coupon) throw new Error(`Merchant registration/coupon regression: ${planId}`);
  const login = await post("/api/merchant-auth/login", { phone, password });
  const merchantCookie = cookie(login.response, "baiye_merchant_session");
  if (!merchantCookie || login.value.next_url !== "/merchant/select-plan") throw new Error(`Merchant password login failed: ${planId}`);
  const memberLogin = await post("/api/members/login", { phone, password });
  if (!memberLogin.value.session?.token) throw new Error(`Platform member shared login failed: ${planId}`);
  const headers = { cookie: `baiye_merchant_session=${merchantCookie}`, "x-csrf-token": login.value.csrf_token };
  const selected = await post("/api/merchant/plans/select", { plan_id: planId, price: 1, deposit: 1, cycle_fee: 1, discount: 1, installment_plan_requested: 24 }, headers);
  if (selected.value.plan.price_minor !== expected.price || selected.value.payment_transaction_created !== false) throw new Error(`Server price authority failed: ${planId}`);
  const current = await ok("/api/merchant/contracts/current", { headers });
  if (current.value.contract.id !== expected.contract || current.value.terms.plan_code !== planId) throw new Error(`Contract resolution failed: ${planId}`);
  if (planId === "baiye_softpos_24000" && (current.value.plan.trial_months !== 3 || current.value.plan.first_cycle_balance !== expected.firstBalance)) throw new Error("SoftPOS terms regression");
  const signBody = { signatory_legal_name: "葉耀仁", signatory_role: "legal_representative", legal_representative_name: "葉耀仁", read: true, commercial_terms: true, authority: true, signature_evidence: true, electronic: true, signature };
  const preview = await post("/api/merchant/contracts/sign-preview", signBody, headers);
  const signKey = `production-merchant-${expected.file}-${runId}`;
  const signed = await post("/api/merchant/contracts/sign", signBody, { ...headers, "idempotency-key": signKey });
  const replay = await post("/api/merchant/contracts/sign", signBody, { ...headers, "idempotency-key": signKey });
  if (replay.value.signature_id !== signed.value.signature_id || !replay.value.replay) throw new Error(`Merchant idempotency failed: ${planId}`);
  const pdf = await ok(`/api/merchant/contracts/${signed.value.signature_id}/pdf`, { headers });
  const bytes = Buffer.from(pdf.value);
  if (bytes.length < 1_000_000 || sha256(bytes) !== String(signed.value.pdf_hash)) throw new Error(`Merchant PDF verification failed: ${planId}`);
  writeFileSync(resolve(outputDir, `${expected.file}.pdf`), bytes, { mode: 0o600 });
  merchantResults.push({ plan_id: planId, contract: current.value.contract.id, preview_total_minor: preview.value.total_minor, signature_id: signed.value.signature_id, public_id: signed.value.public_id, pdf_hash: signed.value.pdf_hash, pdf_bytes: bytes.length, login_return: login.value.next_url });
}

const partnerPhone = `098${String(Date.now() + 9).slice(-7)}`;
const partnerIdNumber = taiwanId(Date.now());
const applied = await post("/api/partner/apply", { legal_name: "葉耀仁", id_number: partnerIdNumber, email: `production-partner-${runId}@example.invalid`, phone: partnerPhone, password, password_confirm: password, consent: true, note: "Production UX/Auth/PDF QA" });
if (applied.value.coupon || !applied.value.activation_url) throw new Error("Partner apply/coupon regression");
const activationToken = decodeURIComponent(new URL(applied.value.activation_url).hash.split("token=")[1] || "");
await post("/api/partner/accept-invite", { token: activationToken });
const partnerLogin = await post("/api/partner/login", { phone: partnerPhone, password });
const partnerCookie = cookie(partnerLogin.response, "partner_session");
if (!partnerCookie) throw new Error("Partner password login failed");
const partnerHeaders = { cookie: `partner_session=${partnerCookie}` };
const partnerCurrent = await ok("/api/partner/contract/current", { headers: partnerHeaders });
const partnerBody = { legal_name: "葉耀仁", read: true, electronic: true, independent: true, identity: true, block_letter_signature: true, signature };
await post("/api/partner/contract/sign-preview", partnerBody, partnerHeaders);
const partnerKey = `production-partner-${runId}`;
const partnerSigned = await post("/api/partner/contract/sign", partnerBody, { ...partnerHeaders, "idempotency-key": partnerKey });
const partnerReplay = await post("/api/partner/contract/sign", partnerBody, { ...partnerHeaders, "idempotency-key": partnerKey });
if (partnerReplay.value.signature_id !== partnerSigned.value.signature_id || !partnerReplay.value.replay) throw new Error("Partner idempotency failed");
const partnerPdf = await ok(`/api/partner/contracts/${partnerSigned.value.signature_id}/pdf`, { headers: partnerHeaders });
const partnerBytes = Buffer.from(partnerPdf.value);
if (partnerBytes.length < 1_000_000 || sha256(partnerBytes) !== String(partnerSigned.value.pdf_hash)) throw new Error("Partner PDF verification failed");
writeFileSync(resolve(outputDir, "partner-v1.5.pdf"), partnerBytes, { mode: 0o600 });

console.log(JSON.stringify({ ok: true, run_id: runId, merchant: merchantResults, partner: { version: partnerCurrent.value.version, signature_id: partnerSigned.value.signature_id, public_id: partnerSigned.value.public_id, pdf_hash: partnerSigned.value.pdf_hash, pdf_bytes: partnerBytes.length, login_return: partnerLogin.value.next_url }, output_dir: outputDir }, null, 2));
