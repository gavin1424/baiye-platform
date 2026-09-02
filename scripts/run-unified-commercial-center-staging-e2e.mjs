import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

if (!process.argv.includes("--staging-only")) throw new Error("Refusing to run without --staging-only.");
const worker = "https://chuang-baiye-contract-signing-staging.baiye-platform.workers.dev";
const origin = "https://baiye-platform-contract-signing-staging.pages.dev";
if (!worker.includes("contract-signing-staging") || !origin.includes("contract-signing-staging.pages.dev")) throw new Error("STAGING_ONLY guard rejected target");

const executable = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npx";
const prefix = process.platform === "win32" ? ["/d", "/s", "/c", "npx"] : [];
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const d1 = (sql) => execFileSync(executable, [...prefix, "wrangler", "d1", "execute", "baiye-contract-signing-staging", "--remote", "--config", "wrangler.contract-staging.jsonc", "--command", sql], { cwd: join(process.cwd(), "cloudflare-worker"), encoding: "utf8", timeout: 30_000 });
const scalar = (sql, key) => {
  const output = d1(sql);
  const match = output.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`));
  if (!match) throw new Error(`Unable to read D1 scalar ${key}`);
  return Number(match[1]);
};
const couponBefore = scalar("SELECT COUNT(*) AS coupon_count FROM platform_member_coupons;", "coupon_count");
const runId = `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
const signature = { strokes: [
  [[18, 22], [38, 34], [61, 18], [86, 43], [111, 25], [137, 48]],
  [[21, 76], [48, 61], [75, 83], [103, 64], [131, 89], [158, 69]],
] };

async function responseValue(response) {
  const type = response.headers.get("content-type") || "";
  return type.includes("json") ? response.json() : new Uint8Array(await response.arrayBuffer());
}

function merchantClient(suffix) {
  let cookie = "";
  let csrf = "";
  const phone = `097${String(Date.now() + suffix).slice(-7)}`;
  const device = `unified-${runId}-${suffix}`;
  const call = async (path, { method = "GET", body, headers = {}, expected = [200] } = {}) => {
    const response = await fetch(`${worker}${path}`, { method, headers: { Origin: origin, ...(body === undefined ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}), ...(csrf && !["GET", "HEAD"].includes(method) ? { "x-csrf-token": csrf } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const setCookie = response.headers.get("set-cookie") || "";
    const raw = setCookie.match(/baiye_merchant_session=([^;]+)/)?.[1];
    if (raw) cookie = `baiye_merchant_session=${raw}`;
    const value = await responseValue(response);
    if (!expected.includes(response.status)) throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(value)}`);
    if (value?.csrf_token) csrf = value.csrf_token;
    return { response, value };
  };
  return { call, phone, device, get cookie() { return cookie; }, get csrf() { return csrf; } };
}

async function pdfText(bytes) {
  const document = await pdfjs.getDocument({ data: Uint8Array.from(bytes), useWorkerFetch: false, isEvalSupported: false }).promise;
  let text = "";
  for (let pageNo = 1; pageNo <= document.numPages; pageNo += 1) {
    const page = await document.getPage(pageNo);
    const content = await page.getTextContent();
    text += (content.items || []).map((item) => item.str || "").join("");
  }
  return { pages: document.numPages, normalized: text.replace(/\s+/g, "") };
}

async function registerSelectSign({ planId, expectedVersion, expectedAmount, suffix, merchantName, signatory }) {
  const client = merchantClient(suffix);
  const registration = await client.call("/api/merchant/register", { method: "POST", body: { phone: client.phone, privacy_consent: true, consent_version: "unified-commercial-center-staging-e2e-v1", intended_plan: planId }, headers: { "x-device-id": client.device }, expected: [201] });
  if (registration.value.registration_price_minor !== 0 || registration.value.coupon !== null || registration.value.next_url !== "/merchant/select-plan") throw new Error(`${planId}: free registration contract failed`);
  const merchantId = registration.value.merchant.id;
  const selected = await client.call("/api/merchant/plans/select", { method: "POST", body: { plan_id: planId, installment_plan_requested: 24, price_minor: 1, deposit_minor: 1, trial_months: 99, contract_version: "forged" }, expected: [201] });
  if (selected.value.plan.price_minor !== expectedAmount || selected.value.plan.contract_version !== expectedVersion || selected.value.payment_transaction_created !== false) throw new Error(`${planId}: server pricing was not authoritative`);
  d1(`UPDATE merchants SET name=${quote(merchantName)},contact_name=${quote(signatory)} WHERE id=${quote(merchantId)};`);
  const current = await client.call("/api/merchant/contracts/current");
  if (current.value.contract.id !== expectedVersion || Number(current.value.terms.discount_price_minor) !== expectedAmount || Number(current.value.terms.contract_term_months) !== 24 || current.value.legal_entity?.entity?.legal_name !== "陳靈有限公司" || current.value.legal_entity?.entity?.tax_id !== "42868714") throw new Error(`${planId}: contract render mismatch`);
  const signBody = { signatory_legal_name: signatory, signatory_role: "legal_representative", legal_representative_name: signatory, read: true, electronic: true, commercial_terms: true, authority: true, signature_evidence: true, signature };
  const preview = await client.call("/api/merchant/contracts/sign-preview", { method: "POST", body: signBody });
  if (Number(preview.value.total_minor) !== expectedAmount || Number(preview.value.term_months) !== 24) throw new Error(`${planId}: preview mismatch`);
  const key = `unified-sign-${planId}-${runId}`;
  const signed = await client.call("/api/merchant/contracts/sign", { method: "POST", body: signBody, headers: { "idempotency-key": key }, expected: [201] });
  const replay = await client.call("/api/merchant/contracts/sign", { method: "POST", body: signBody, headers: { "idempotency-key": key }, expected: [200] });
  if (replay.value.signature_id !== signed.value.signature_id || replay.value.replay !== true || !signed.value.document_hash || !signed.value.pdf_hash) throw new Error(`${planId}: immutable sign replay mismatch`);
  const pdf = await client.call(`/api/merchant/contracts/${signed.value.signature_id}/pdf`);
  const text = await pdfText(pdf.value);
  const active = await client.call("/api/merchant-admin/dashboard");
  if (active.value.administrator.status !== "ACTIVE" || active.value.operation_locked !== false || active.value.plan.plan_code !== planId) throw new Error(`${planId}: activation failed`);
  return { client, merchantId, registration, selected, current, preview, signed, pdf, text, active };
}

const standard = await registerSelectSign({ planId: "baiye_standard_18000_addons", expectedVersion: "merchant_service_v1_2_18000_addons", expectedAmount: 1800000, suffix: 11, merchantName: "STAGING 統一中心｜百工標準方案", signatory: "林小華" });
for (const expected of ["NT$18,000", "24個月", "附件A", "陳靈有限公司"]) if (!standard.text.normalized.includes(expected.replace(/\s+/g, ""))) throw new Error(`18k PDF missing ${expected}`);
const blockedProfile = await standard.client.call("/api/merchant-admin/profile", { method: "PATCH", body: { brand_name: "不得直接修改" }, expected: [403] });
const blockedProduct = await standard.client.call("/api/merchant-admin/ordering/items", { method: "POST", body: { name: "不得建立", price_minor: 1 }, expected: [403] });
if (blockedProfile.value.code !== "MERCHANT_CONTENT_EDIT_DISABLED" || blockedProduct.value.code !== "MERCHANT_PRODUCT_EDIT_PLAN_REQUIRED") throw new Error("18k content/product gate failed");
const changeRequest = await standard.client.call("/api/merchant-admin/content-change-requests", { method: "POST", body: { items: "更新品牌介紹", text: "STAGING ONLY 統一中心 E2E", images: [] }, expected: [201] });
const signedPlanChange = await standard.client.call("/api/merchant/plans/select", { method: "POST", body: { plan_id: "baiye_commerce_ai_45000", installment_plan_requested: 24 }, expected: [409] });
if (signedPlanChange.value.code !== "ACTIVE_PLAN_EXISTS") throw new Error("Signed plan overwrite guard failed");

const softpos = await registerSelectSign({ planId: "baiye_softpos_24000", expectedVersion: "merchant_softpos_v1_0_24000", expectedAmount: 2400000, suffix: 22, merchantName: "STAGING 統一中心｜免 POS 機智慧點餐", signatory: "陳小安" });
for (const expected of ["NT$24,000", "3個月", "NT$18,000", "陳靈有限公司"]) if (!softpos.text.normalized.includes(expected.replace(/\s+/g, ""))) throw new Error(`SoftPOS PDF missing ${expected}`);
await softpos.client.call("/api/merchant-admin/ordering/settings", { method: "PATCH", body: { display_name: "STAGING SoftPOS", enabled: true, ordering_open: true, accepting_orders: true, consent_version: "unified-v1" }, expected: [200, 201] });
const category = await softpos.client.call("/api/merchant-admin/ordering/categories", { method: "POST", body: { name: "SoftPOS E2E" }, expected: [201] });
const item = await softpos.client.call("/api/merchant-admin/ordering/items", { method: "POST", body: { category_id: category.value.id, name: "SoftPOS 測試品項", price_minor: 12000, status: "active" }, expected: [201] });
const trial = await softpos.client.call("/api/merchant/contracts/renewal");
if (!String(trial.value.subscription.renewal_state).startsWith("TRIAL")) throw new Error("SoftPOS trial did not start");
d1(`UPDATE merchant_service_subscriptions SET trial_ends_at=date('now','-1 day') WHERE merchant_id=${quote(softpos.merchantId)};`);
const due = await softpos.client.call("/api/merchant/contracts/renewal");
const firstCycle = await softpos.client.call("/api/merchant/contracts/renewal/prepare", { method: "POST", body: {}, expected: [201] });
if (due.value.subscription.renewal_state !== "RENEWAL_REQUIRED" || Number(firstCycle.value.cycle.cycle_fee_minor) !== 2400000 || Number(firstCycle.value.cycle.deposit_credit_minor) !== 600000 || Number(firstCycle.value.cycle.balance_due_minor) !== 1800000 || firstCycle.value.payment_provider.production_verified !== false) throw new Error("SoftPOS first cycle calculation/provider gate failed");

const crossMerchant = await standard.client.call(`/api/merchant-admin/profile?merchant_id=${encodeURIComponent(softpos.merchantId)}`, { expected: [403] });
if (crossMerchant.value.code !== "MERCHANT_CROSS_ACCESS_DENIED") throw new Error("Cross merchant access was not blocked");

function stagingTaiwanId(seed) {
  const firstEight = `1${String(seed).replace(/\D/g, "").slice(-7).padStart(7, "0")}`;
  let sum = 1 + [...firstEight].reduce((total, digit, index) => total + Number(digit) * (8 - index), 0);
  return `A${firstEight}${(10 - (sum % 10)) % 10}`;
}
const partnerPhone = `092${String(Date.now() + 33).slice(-7)}`;
const partnerApply = await fetch(`${worker}/api/partner/apply`, { method: "POST", headers: { Origin: origin, "content-type": "application/json" }, body: JSON.stringify({ legal_name: "跨角色測試夥伴", id_number: stagingTaiwanId(Date.now() + 33), email: `cross-role-${runId}@staging.invalid`, phone: partnerPhone, consent: true }) });
const partnerApplied = await responseValue(partnerApply);
if (!partnerApply.ok) throw new Error(`Partner apply failed: ${JSON.stringify(partnerApplied)}`);
const activationToken = decodeURIComponent(new URL(partnerApplied.activation_url).hash.split("token=")[1] || "");
const partnerActivate = await fetch(`${worker}/api/partner/accept-invite`, { method: "POST", headers: { Origin: origin, "content-type": "application/json" }, body: JSON.stringify({ token: activationToken }) });
const partnerActivated = await responseValue(partnerActivate);
if (!partnerActivate.ok) throw new Error(`Partner activation failed: ${JSON.stringify(partnerActivated)}`);
const partnerCookie = (partnerActivate.headers.get("set-cookie") || "").match(/partner_session=([^;]+)/)?.[1];
const partnerOnMerchant = await fetch(`${worker}/api/merchant/contracts/current`, { headers: { Origin: origin, cookie: `partner_session=${partnerCookie}` } });
const merchantOnPartner = await fetch(`${worker}/api/partner/contract/current`, { headers: { Origin: origin, cookie: standard.client.cookie } });
if (partnerOnMerchant.status !== 401 || merchantOnPartner.status !== 401) throw new Error("Cross-role contract access was not rejected");

const couponAfter = scalar("SELECT COUNT(*) AS coupon_count FROM platform_member_coupons;", "coupon_count");
if (couponAfter !== couponBefore) throw new Error(`Coupon issuance changed: ${couponBefore} -> ${couponAfter}`);

console.log(JSON.stringify({
  ok: true,
  environment: "STAGING_ONLY",
  run_id: runId,
  free_registration: true,
  standard_18000: { merchant_id: standard.merchantId, signature_id: standard.signed.value.signature_id, contract_version: standard.current.value.contract.id, pdf_bytes: standard.pdf.value.byteLength, pdf_pages: standard.text.pages, content_edit: "BLOCKED", product_edit: "BLOCKED", change_request_id: changeRequest.value.id },
  softpos_24000: { merchant_id: softpos.merchantId, signature_id: softpos.signed.value.signature_id, contract_version: softpos.current.value.contract.id, pdf_bytes: softpos.pdf.value.byteLength, pdf_pages: softpos.text.pages, trial_months: 3, activation_fee_minor: 300000, deposit_minor: 600000, cycle_fee_minor: 2400000, first_cycle_credit_minor: 600000, first_cycle_balance_minor: 1800000, ordering_item_id: item.value.id, payment_provider_ready: false },
  legal_entity: "陳靈有限公司",
  server_pricing: true,
  signed_plan_immutable: true,
  cross_merchant_403: true,
  cross_role_401: true,
  coupon_created: couponAfter - couponBefore,
}, null, 2));
