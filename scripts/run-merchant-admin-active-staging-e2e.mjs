import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const workerUrl = process.env.CONTRACT_STAGING_WORKER_URL;
const origin = process.env.CONTRACT_STAGING_ORIGIN;
if (!workerUrl?.includes("contract-signing-staging") || origin !== "https://baiye-platform-contract-signing-staging.pages.dev") {
  throw new Error("Staging-only guard rejected Worker or Pages origin");
}

const runId = Date.now().toString(36);
const phone = `096${String(Date.now()).slice(-7)}`;
const memberPhone = `095${String(Date.now() + 7).slice(-7)}`;
const signatory = "王小明";
const merchantName = "百工管理者 ACTIVE 示範店";
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const executable = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npx";
const prefix = process.platform === "win32" ? ["/d", "/s", "/c", "npx"] : [];
const d1 = (sql) => execFileSync(executable, [...prefix, "wrangler", "d1", "execute", "baiye-contract-signing-staging", "--remote", "--config", "wrangler.contract-staging.jsonc", "--command", sql], { cwd: join(process.cwd(), "cloudflare-worker"), stdio: "pipe", timeout: 30_000 });
const signature = JSON.stringify({
  strokes: [
    [[18, 22], [38, 34], [61, 18], [86, 43], [111, 25], [137, 48]],
    [[21, 76], [48, 61], [75, 83], [103, 64], [131, 89], [158, 69]],
  ],
});

let cookie = "";
let csrf = "";
const api = async (path, { method = "GET", body, headers = {}, expected = [200] } = {}) => {
  const response = await fetch(`${workerUrl}${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
      ...(csrf && !["GET", "HEAD"].includes(method) ? { "x-csrf-token": csrf } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie?.includes("baiye_merchant_session=")) cookie = setCookie.split(";", 1)[0];
  const contentType = response.headers.get("content-type") || "";
  const value = contentType.includes("json") ? await response.json() : new Uint8Array(await response.arrayBuffer());
  if (!expected.includes(response.status)) throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(value)}`);
  return { response, value };
};

const registration = await api("/api/merchant/register", {
  method: "POST",
  body: { phone, privacy_consent: true, consent_version: "merchant-admin-active-staging-e2e-v1" },
  headers: { "x-device-id": `merchant-admin-active-${runId}` },
  expected: [201],
});
csrf = registration.value.csrf_token;
const merchantId = registration.value.merchant.id;
if (!cookie || !csrf || !merchantId) throw new Error("Registration did not create a secure Merchant Session");
const selectedPlan = await api("/api/merchant/plans/select", {
  method: "POST",
  body: {
    plan_id: "baiye_commerce_ai_45000",
    installment_plan_requested: 24,
    price_minor: 1,
    contract_version: "forged-client-value",
  },
  expected: [201],
});
if (selectedPlan.value.plan.price_minor !== 4500000 || selectedPlan.value.plan.contract_version !== "merchant_commerce_ai_v1_0_45000") throw new Error("Server-side plan selection failed");
d1(`UPDATE merchants SET name=${quote(merchantName)},contact_name=${quote(signatory)} WHERE id=${quote(merchantId)};`);
const registrationCookie = registration.response.headers.get("set-cookie") || "";
if (!/HttpOnly/i.test(registrationCookie) || !/Secure/i.test(registrationCookie) || !/SameSite=None/i.test(registrationCookie)) throw new Error("Merchant Session cookie flags are incomplete");
if (registration.value.coupon) throw new Error("Welcome coupon issuance unexpectedly enabled");

const before = await api("/api/merchant-admin/dashboard");
if (before.value.administrator.status !== "PENDING_ACTIVATION" || before.value.operation_locked !== true) throw new Error("Pre-sign activation gate is not locked");
const lockedWrite = await api("/api/merchant-admin/profile", { method: "PATCH", body: { brand_name: "不得寫入" }, expected: [423] });
if (lockedWrite.value.code !== "MERCHANT_ACTIVATION_REQUIRED") throw new Error("Operational API did not return activation gate");

const current = await api("/api/merchant/contracts/current");
if (current.value.contract.id !== "merchant_commerce_ai_v1_0_45000" || !current.value.contract.content_html) throw new Error("Merchant commerce contract is unavailable");
if (current.value.merchant.name !== merchantName) throw new Error("Merchant legal party fixture is incomplete");
if (Number(current.value.terms.discount_price_minor) !== 4500000 || Number(current.value.terms.contract_term_months) !== 24) throw new Error("Commercial terms mismatch");
if (!current.value.legal_entity?.configured || current.value.legal_entity.entity.legal_name !== "陳靈有限公司" || current.value.legal_entity.entity.tax_id !== "42868714") throw new Error("Approved Staging legal entity is not rendered");
if (!current.value.attachments?.some((item) => String(item.title || "").startsWith("附件 A｜"))) throw new Error("Attachment A is missing");

const signBody = {
  signatory_legal_name: signatory,
  signatory_role: "legal_representative",
  legal_representative_name: signatory,
  read: true,
  electronic: true,
  commercial_terms: true,
  authority: true,
  signature_evidence: true,
  signature,
};
const preview = await api("/api/merchant/contracts/sign-preview", { method: "POST", body: signBody });
if (preview.value.version !== "merchant_commerce_ai_v1_0_45000" || preview.value.signatory !== signatory || Number(preview.value.total_minor) !== 4500000 || Number(preview.value.term_months) !== 24) throw new Error("Contract preview mismatch");
const idempotencyKey = `merchant-admin-active-sign-${runId}`;
const signed = await api("/api/merchant/contracts/sign", { method: "POST", body: signBody, headers: { "idempotency-key": idempotencyKey }, expected: [201] });
const replay = await api("/api/merchant/contracts/sign", { method: "POST", body: signBody, headers: { "idempotency-key": idempotencyKey }, expected: [200] });
if (replay.value.signature_id !== signed.value.signature_id || replay.value.replay !== true) throw new Error("Sign idempotency replay failed");

const pdf = await api(`/api/merchant/contracts/${signed.value.signature_id}/pdf`);
if (pdf.value.byteLength < 1000 || !String(pdf.response.headers.get("content-type")).includes("application/pdf")) throw new Error("Private signed PDF download failed");
const pdfDocument = await pdfjs.getDocument({ data: Uint8Array.from(pdf.value), useWorkerFetch: false, isEvalSupported: false }).promise;
let pdfText = "";
for (let pageNo = 1; pageNo <= pdfDocument.numPages; pageNo += 1) {
  const page = await pdfDocument.getPage(pageNo);
  const text = await page.getTextContent();
  pdfText += ` ${(text.items || []).map((item) => item.str || "").join(" ")}`;
}
const normalizedPdfText = pdfText.replace(/\s+/g, "");
for (const expected of ["創百業智慧鏈", "AI智慧商城完整版", "附件A", "NT$45,000", "24個月", "陳靈有限公司", "42868714", "陳美玲", "民生東路三段57號", merchantName, signatory]) {
  if (!normalizedPdfText.includes(expected.replace(/\s+/g, ""))) throw new Error(`PDF text missing: ${expected}`);
}
const pdfBinary = new TextDecoder("latin1").decode(pdf.value);
if (/MSung-Light|UniCNS-UTF16-H/.test(pdfBinary)) throw new Error("Legacy CJK renderer dependency found in PDF");

const active = await api("/api/merchant-admin/dashboard");
if (active.value.administrator.status !== "ACTIVE" || active.value.account_status !== "已啟用" || active.value.contract.status !== "signed" || active.value.operation_locked !== false) throw new Error("Merchant activation did not complete server-side");

await api("/api/merchant-admin/profile", { method: "PATCH", body: { brand_name: "百工管理者 ACTIVE 示範店", business_description: "STAGING ONLY｜Merchant Admin ACTIVE E2E", support_phone: phone, business_hours: "週一至週五 09:00–18:00" } });
const profile = await api("/api/merchant-admin/profile");
if (profile.value.profile.brand_name !== "百工管理者 ACTIVE 示範店" || profile.value.legal_fields_locked !== true) throw new Error("Profile CRUD failed");
const legalChange = await api("/api/merchant-admin/profile", { method: "PATCH", body: { tax_id: "12345678" }, expected: [409] });
if (legalChange.value.code !== "LEGAL_PROFILE_CHANGE_REQUIRED") throw new Error("Signed legal fields were not locked");

await api("/api/merchant-admin/ordering/settings", { method: "PATCH", body: { display_name: "百工管理者 ACTIVE 示範店", enabled: true, consent_version: "merchant-admin-active-v1", ordering_open: true, accepting_orders: true }, expected: [200, 201] });
const category = await api("/api/merchant-admin/ordering/categories", { method: "POST", body: { name: "E2E 商品" }, expected: [201] });
const product = await api("/api/merchant-admin/ordering/items", { method: "POST", body: { category_id: category.value.id, sku: `E2E-${runId}`, name: "管理者測試商品", price_minor: 35000, status: "active" }, expected: [201] });
await api(`/api/merchant-admin/ordering/items/${product.value.id}`, { method: "PATCH", body: { price_minor: 38000, status: "hidden" } });
await api(`/api/merchant-admin/ordering/items/${product.value.id}`, { method: "PATCH", body: { status: "active" } });

const fixtureSql = `PRAGMA foreign_keys=ON;
INSERT OR IGNORE INTO merchant_booking_settings(merchant_id,enabled,minimum_notice_minutes) VALUES(${quote(merchantId)},1,0);
INSERT INTO merchant_booking_services(id,merchant_id,name,duration_minutes,active) VALUES(${quote(`ma-service-${runId}`)},${quote(merchantId)},'ACTIVE E2E 服務',60,1);
INSERT INTO merchant_booking_staff(id,merchant_id,display_name,active) VALUES(${quote(`ma-staff-${runId}`)},${quote(merchantId)},'ACTIVE E2E 顧問',1);
INSERT INTO merchant_booking_service_staff(merchant_id,service_id,staff_id) VALUES(${quote(merchantId)},${quote(`ma-service-${runId}`)},${quote(`ma-staff-${runId}`)});
INSERT INTO merchant_bookings(id,merchant_id,booking_code,manage_token_hash,service_id,staff_id,customer_name,customer_phone,start_at,end_at,blocked_start_at,blocked_end_at,timezone,status,source,booking_source) VALUES(${quote(`ma-booking-${runId}`)},${quote(merchantId)},${quote(`MA-${runId}`)},${quote(`TOKEN-${runId}`)},${quote(`ma-service-${runId}`)},${quote(`ma-staff-${runId}`)},'測試顧客',${quote(memberPhone)},'2026-09-20T02:00:00.000Z','2026-09-20T03:00:00.000Z','2026-09-20T02:00:00.000Z','2026-09-20T03:00:00.000Z','Asia/Taipei','pending','admin','manual');
INSERT INTO ordering_customers(id,display_name,phone_normalized,phone_display) VALUES(${quote(`ma-customer-${runId}`)},'測試會員',${quote(memberPhone)},'09** *** 555');
INSERT INTO merchant_ordering_memberships(id,merchant_id,customer_id,membership_no,consent_version,consented_at) VALUES(${quote(`ma-relation-${runId}`)},${quote(merchantId)},${quote(`ma-customer-${runId}`)},${quote(`MBR-${runId}`)},'merchant-admin-active-v1',CURRENT_TIMESTAMP);`;
for (const statement of fixtureSql.split(";").map((item) => item.trim()).filter(Boolean)) {
  d1(`${statement};`);
}

const bookings = await api("/api/merchant-admin/bookings");
if (!bookings.value.bookings.some((item) => item.id === `ma-booking-${runId}`)) throw new Error("Booking read failed");
await api(`/api/merchant-admin/bookings/ma-booking-${runId}`, { method: "PATCH", body: { status: "confirmed" } });
const members = await api("/api/merchant-admin/members");
if (!members.value.members.some((item) => item.id === `ma-relation-${runId}`) || JSON.stringify(members.value).includes(memberPhone)) throw new Error("Member isolation or masking failed");

const googleRead = await api("/api/merchant/google-maps-booking");
if (googleRead.value.contract_signed !== true) throw new Error("Google Maps Booking contract gate mismatch");
const googleApply = await api("/api/merchant/google-maps-booking", { method: "POST", body: { merchant_name: merchantName, google_maps_url: "https://www.google.com/maps/place/Taipei", contact_name: signatory, contact_phone: phone, merchant_type: "service", services: ["ACTIVE E2E 服務"], has_staff_schedule: true, business_hours: { description: "週一至週五 09:00–18:00" }, has_google_profile: true, has_booking_system: true, note: "STAGING ONLY" }, expected: [201] });
if (googleApply.value.application.status !== "UNDER_REVIEW") throw new Error("Google Maps Booking apply failed");
const line = await api("/api/merchant-admin/line");
if (line.value.secrets_exposed !== false) throw new Error("LINE endpoint exposed secrets");
const account = await api("/api/merchant-admin/account");
if (account.value.display_role !== "管理者" || !Array.isArray(account.value.sessions)) throw new Error("Merchant account endpoint failed");

for (const path of ["/api/merchant-admin/profile", "/api/merchant-admin/bookings", "/api/merchant-admin/members", "/api/merchant/contracts/current", "/api/merchant/google-maps-booking"]) {
  const response = await api(`${path}?merchant_id=merchant_admin_demo`, { expected: [403] });
  if (response.value.code !== "MERCHANT_CROSS_ACCESS_DENIED") throw new Error(`Cross-merchant guard failed: ${path}`);
}
const foreignProduct = await api("/api/merchant-admin/ordering/items/merchant-admin-product-1", { method: "PATCH", body: { merchant_id: "merchant_admin_demo", price_minor: 1 }, expected: [403] });
if (foreignProduct.value.code !== "MERCHANT_CROSS_ACCESS_DENIED") throw new Error("Cross-merchant product mutation was not blocked");

const audit = await api("/api/merchant-admin/audit");
for (const action of ["merchant.activation.completed", "merchant.profile.updated", "merchant.product.created", "merchant.product.updated", "merchant.booking.updated"]) {
  if (!audit.value.items.some((item) => item.action === action)) throw new Error(`Merchant audit missing: ${action}`);
}

const loginStartResponse = await fetch(`${workerUrl}/api/merchant-auth/login/start`, {
  method: "POST",
  headers: { Origin: origin, "content-type": "application/json", "x-device-id": `merchant-admin-second-${runId}` },
  body: JSON.stringify({ phone }),
});
const loginStartValue = await loginStartResponse.json();
if (!loginStartResponse.ok || !loginStartValue.staging_otp) throw new Error(`Staging OTP was not issued: ${JSON.stringify(loginStartValue)}`);
let secondCookie = "";
let secondCsrf = "";
const verifyResponse = await fetch(`${workerUrl}/api/merchant-auth/login/verify`, { method: "POST", headers: { Origin: origin, "content-type": "application/json", "x-device-id": `merchant-admin-second-${runId}` }, body: JSON.stringify({ challenge_id: loginStartValue.challenge_id, code: loginStartValue.staging_otp }) });
const verifyValue = await verifyResponse.json();
if (!verifyResponse.ok) throw new Error(`OTP verify failed: ${JSON.stringify(verifyValue)}`);
secondCookie = (verifyResponse.headers.get("set-cookie") || "").split(";", 1)[0];
secondCsrf = verifyValue.csrf_token;
await api("/api/merchant-auth/logout", { method: "POST", body: {} });
cookie = secondCookie;
csrf = secondCsrf;
await api("/api/merchant-admin/logout-all", { method: "POST", body: {} });
await api("/api/merchant-auth/session", { expected: [401] });

console.log(JSON.stringify({
  ok: true,
  run_id: runId,
  merchant_id: merchantId,
  phone_masked: `${phone.slice(0, 3)}****${phone.slice(-3)}`,
  signature_id: signed.value.signature_id,
  public_id: signed.value.public_id,
  document_hash: signed.value.document_hash,
  pdf_hash: signed.value.pdf_hash,
  pdf_pages: pdfDocument.numPages,
  pdf_bytes: pdf.value.byteLength,
  contract_version: current.value.contract.id,
  contract_content_hash: current.value.contract.content_hash,
  commercial_terms_id: current.value.terms.id,
  legal_entity: current.value.legal_entity.entity.legal_name,
  active: true,
  cross_merchant_403: true,
  coupon_created: 0,
  google_application_id: googleApply.value.application.id,
  logout_and_logout_all: true,
}));
