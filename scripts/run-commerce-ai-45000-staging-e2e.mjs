import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { commerceAiTermsSnapshot } from "../cloudflare-worker/src/commerce-ai-contract.js";
import { hashCanonical } from "../cloudflare-worker/src/contract-engine.js";

if (!process.argv.includes("--staging-only")) throw new Error("Refusing to run without --staging-only.");

const workerUrl = "https://chuang-baiye-contract-signing-staging.baiye-platform.workers.dev";
const origin = "https://baiye-platform-contract-signing-staging.pages.dev";
if (!workerUrl.includes("contract-signing-staging") || !origin.includes("contract-signing-staging.pages.dev")) throw new Error("Staging-only target guard failed.");

const compact = () => randomUUID().replaceAll("-", "");
const runId = `${Date.now().toString(36)}_${compact().slice(0, 6)}`;
const merchantId = `staging_commerce_ai_45000_${runId}`;
const userId = `staging_commerce_owner_${runId}`;
const roleId = `staging_commerce_role_${runId}`;
const termsId = `staging_commerce_terms_${runId}`;
const assignmentId = `staging_commerce_plan_${runId}`;
const inviteId = `staging_commerce_invite_${runId}`;
const sessionId = `staging_commerce_session_${runId}`;
const categoryId = `staging_commerce_category_${runId}`;
const productId = `staging_commerce_product_${runId}`;
const qrId = `staging_commerce_qr_${runId}`;
const qrCode = `commerce-cart-${compact()}`;
const sessionToken = `${randomUUID()}${randomUUID()}`;
const csrfToken = `${randomUUID()}${randomUUID()}`;
const sha = (value) => createHash("sha256").update(String(value)).digest("base64url");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const terms = commerceAiTermsSnapshot(new Date("2026-09-02T12:00:00+08:00"));
const termsHash = await hashCanonical(terms);

const sql = `PRAGMA foreign_keys=ON;
INSERT OR IGNORE INTO platform_contract_legal_entity_configs(id,legal_name,tax_id,responsible_person,registered_address,support_contact,updated_by)
VALUES('default','STAGING 測試法律主體（非真實公司）','00000000','STAGING 測試負責人','STAGING 測試地址','staging-contract@example.invalid','staging-e2e');
INSERT INTO merchants(id,merchant_code,name,contact_name,phone,email,status)
VALUES(${quote(merchantId)},${quote(`STAGE-CA45-${runId}`)},'STAGING｜AI 智慧商城完整版測試商家','STAGING 測試代表','0930450000',${quote(`${merchantId}@example.invalid`)},'contract_required');
INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,status,display_name,phone_normalized,auth_mode)
VALUES(${quote(userId)},${quote(merchantId)},${quote(`${merchantId}@example.invalid`)},'PASSWORDLESS_DISABLED','','active','STAGING 測試代表','0930450000','passwordless_phone');
INSERT INTO merchant_roles(id,merchant_id,code,name,is_system) VALUES(${quote(roleId)},${quote(merchantId)},'owner','STAGING 管理者',1);
INSERT INTO merchant_user_roles(merchant_id,user_id,role_id) VALUES(${quote(merchantId)},${quote(userId)},${quote(roleId)});
INSERT INTO merchant_user_sessions(id,merchant_id,user_id,token_hash,csrf_hash,assurance_level,issued_via,expires_at)
VALUES(${quote(sessionId)},${quote(merchantId)},${quote(userId)},${quote(sha(sessionToken))},${quote(sha(csrfToken))},'activation_invite','staging_e2e',datetime('now','+2 hours'));
INSERT INTO merchant_contract_commercial_terms(id,merchant_id,plan_code,plan_name,list_price_minor,discount_price_minor,currency,contract_term_months,payment_plan,upfront_amount_minor,offset_target_amount_minor,tax_reserve_enabled,withholding_enabled,included_services_json,excluded_services_json,attachments_json,start_date,service_period_end,renewal_terms,custom_quote_reference,status,created_by,approved_by,approved_at,terms_hash,source_preset_id)
VALUES(${quote(termsId)},${quote(merchantId)},'baiye_commerce_ai_45000','創百業智慧鏈｜AI 智慧商城完整版',4500000,4500000,'TWD',24,'upfront_18000',4500000,0,0,0,${quote(JSON.stringify(terms.included_services))},${quote(JSON.stringify(terms.excluded_services))},${quote(JSON.stringify(terms.attachments))},${quote(terms.start_date)},${quote(terms.service_period_end)},${quote(terms.renewal_terms)},NULL,'approved','staging-e2e','staging-e2e',CURRENT_TIMESTAMP,${quote(termsHash)},'baiye_commerce_ai_45000');
INSERT INTO merchant_plan_assignments(id,merchant_id,plan_id,commercial_terms_id,status,assigned_by)
VALUES(${quote(assignmentId)},${quote(merchantId)},'baiye_commerce_ai_45000',${quote(termsId)},'assigned','staging-e2e');
INSERT INTO merchant_plan_entitlements(assignment_id,merchant_id,plan_id,commerce_full,cart,merchant_product_edit,merchant_content_editable,merchant_product_editable)
VALUES(${quote(assignmentId)},${quote(merchantId)},'baiye_commerce_ai_45000',1,1,1,1,1);
INSERT INTO merchant_onboarding_states(merchant_id,registration_mode,state,operation_locked,commercial_terms_approval_required,commercial_terms_id)
VALUES(${quote(merchantId)},'custom_quote','contract_required',1,0,${quote(termsId)});
INSERT INTO merchant_contract_invites(id,merchant_id,commercial_terms_id,email,token_hash,expires_at,used_at,created_by)
VALUES(${quote(inviteId)},${quote(merchantId)},${quote(termsId)},${quote(`${merchantId}@example.invalid`)},${quote(sha(`invite-${runId}`))},datetime('now','+2 hours'),CURRENT_TIMESTAMP,'staging-e2e');
INSERT INTO merchant_ordering_settings(merchant_id,display_name,enabled,require_member,ordering_open,accepting_orders)
VALUES(${quote(merchantId)},'STAGING AI 智慧商城完整版',1,1,1,1);
INSERT INTO merchant_menu_categories(id,merchant_id,name,active) VALUES(${quote(categoryId)},${quote(merchantId)},'STAGING 商城商品',1);
INSERT INTO merchant_menu_items(id,merchant_id,category_id,sku,name,description,price_minor,image_url,status,available,daily_limit)
VALUES(${quote(productId)},${quote(merchantId)},${quote(categoryId)},'STAGE-AI-45000','STAGING 智慧商城測試商品','僅供 staging 購物車與訂單 QA',9900,'https://example.invalid/staging-product.jpg','active',1,20);
INSERT INTO merchant_ordering_qr_codes(id,merchant_id,code,label,purpose,table_label)
VALUES(${quote(qrId)},${quote(merchantId)},${quote(qrCode)},'STAGING 商城購物車','dine_in','WEB');`;

const tempDir = mkdtempSync(join(tmpdir(), "baiye-commerce-ai-45000-"));
const seedPath = join(tempDir, "seed.sql");
writeFileSync(seedPath, sql, { encoding: "utf8", mode: 0o600 });
try {
  const executable = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npx";
  const prefix = process.platform === "win32" ? ["/d", "/s", "/c", "npx"] : [];
  execFileSync(executable, [...prefix, "wrangler", "d1", "execute", "FINANCE_DB", "--remote", "--config", "wrangler.contract-staging.jsonc", `--file=${seedPath}`], { cwd: resolve("cloudflare-worker"), stdio: "inherit" });
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

const merchantHeaders = { Origin: origin, cookie: `baiye_merchant_session=${sessionToken}`, "x-csrf-token": csrfToken };
async function call(path, options = {}) {
  const response = await fetch(`${workerUrl}${path}`, { ...options, headers: { Origin: origin, ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {}) } });
  const contentType = response.headers.get("content-type") || "";
  const value = contentType.includes("json") ? await response.json() : new Uint8Array(await response.arrayBuffer());
  if (!response.ok) {
    const detail = value instanceof Uint8Array ? new TextDecoder().decode(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500) : JSON.stringify(value);
    throw new Error(`${path} -> ${response.status}: ${detail}`);
  }
  return { response, value };
}

const current = await call("/api/merchant/contracts/current", { headers: merchantHeaders });
const signature = { strokes: [[[4,4],[18,18],[38,16],[52,30],[71,25],[94,34]],[[11,52],[28,64],[49,60],[72,68],[96,63],[121,70]]] };
const signBody = { signatory_legal_name: "STAGING 測試代表", signatory_role: "legal_representative", legal_representative_name: "STAGING 測試代表", tax_id: "00000000", read: true, commercial_terms: true, authority: true, signature_evidence: true, electronic: true, signature };
const preview = await call("/api/merchant/contracts/sign-preview", { method: "POST", headers: merchantHeaders, body: JSON.stringify(signBody) });
const signKey = `commerce-ai-45000-sign-${runId}`;
const signed = await call("/api/merchant/contracts/sign", { method: "POST", headers: { ...merchantHeaders, "idempotency-key": signKey }, body: JSON.stringify(signBody) });
const replay = await call("/api/merchant/contracts/sign", { method: "POST", headers: { ...merchantHeaders, "idempotency-key": signKey }, body: JSON.stringify(signBody) });
const pdf = await call(`/api/merchant/contracts/${signed.value.signature_id}/pdf`, { headers: merchantHeaders });
const dashboard = await call("/api/merchant-admin/dashboard", { headers: merchantHeaders });
const commerce = await call("/api/merchant-admin/commerce", { headers: merchantHeaders });
const productUpdate = await call(`/api/merchant-admin/ordering/items/${productId}`, { method: "PATCH", headers: merchantHeaders, body: JSON.stringify({ price_minor: 10800, status: "active", image_url: "https://example.invalid/staging-product-v2.jpg" }) });
const joinResult = await call(`/api/ordering/qr/${qrCode}/join`, { method: "POST", body: JSON.stringify({ phone: `092${String(Date.now()).slice(-7)}`, privacy_consent: true, consent_version: "2026-08-27", device_id: `staging-cart-${runId}` }) });
const order = await call(`/api/ordering/qr/${qrCode}/orders`, { method: "POST", headers: { authorization: `Bearer ${joinResult.value.session.token}`, "idempotency-key": `staging-cart-order-${runId}` }, body: JSON.stringify({ order_type: "dine_in", table_label: "WEB", items: [{ item_id: productId, quantity: 2 }] }) });

const result = {
  ok: true,
  environment: "STAGING_ONLY",
  merchant_id: merchantId,
  plan_id: current.value.terms.plan_code,
  contract_version: current.value.contract.version,
  rendered_total_minor: current.value.terms.discount_price_minor,
  attachment_count: current.value.attachments.length,
  preview_total_minor: preview.value.total_minor,
  signature_id: signed.value.signature_id,
  public_id: signed.value.public_id,
  replay_same_signature: replay.value.signature_id === signed.value.signature_id,
  pdf_bytes: pdf.value.byteLength,
  pdf_hash: signed.value.pdf_hash,
  document_hash: signed.value.document_hash,
  administrator_status: dashboard.value.administrator.status,
  product_edit_status: productUpdate.response.status,
  cart_enabled: commerce.value.entitlements.cart,
  order_code: order.value.order.order_code,
  order_payment_status: order.value.order.payment_status,
  payment_production_enabled: commerce.value.payment_readiness.production_payment_enabled,
};

if (result.plan_id !== "baiye_commerce_ai_45000" || result.contract_version !== "merchant_commerce_ai_v1_0_45000" || result.rendered_total_minor !== 4500000 || result.preview_total_minor !== 4500000 || result.attachment_count !== 1 || !result.replay_same_signature || result.pdf_bytes < 1000 || result.administrator_status !== "ACTIVE" || result.product_edit_status !== 200 || result.cart_enabled !== true || result.order_payment_status !== "unpaid" || result.payment_production_enabled !== false) {
  throw new Error(`Staging E2E assertion failed: ${JSON.stringify(result)}`);
}
console.log(JSON.stringify(result, null, 2));
