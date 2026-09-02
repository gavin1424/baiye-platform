import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { handleMerchantContractAdmin, handleMerchantContractRequest } from "../src/merchant-contracts.js";
import { handleMerchantAdmin } from "../src/merchant-admin.js";
import { handleOrderingAdminRequest, handleOrderingRequest } from "../src/qr-ordering.js";
import { sha256 } from "../src/contract-pdf.js";
import {
  COMMERCE_AI_CONTRACT_CONTENT_HTML,
  COMMERCE_AI_CONTRACT_ID,
  COMMERCE_AI_PLAN_ID,
  commerceAiAttachmentA,
  commerceEntitlements,
  paymentReadiness,
} from "../src/commerce-ai-contract.js";
import { MERCHANT_SERVICE_V11_ID } from "../src/merchant-contract-v11.js";
import { testContractFontEnv } from "./contract-font-fixture.mjs";

class Statement {
  constructor(statement) { this.statement = statement; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async run() { const result = this.statement.run(...this.values); return { meta: { changes: Number(result.changes || 0) } }; }
  async first() { return this.statement.get(...this.values) || null; }
  async all() { return { results: this.statement.all(...this.values) }; }
}
class D1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    for (const name of readdirSync(new URL("../migrations", import.meta.url)).filter((value) => /^\d+.*\.sql$/.test(value)).sort()) {
      this.sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n"));
    }
    this.sqlite.exec(readFileSync(new URL("../migrations-ordering-demo/0034_merchant_inventory_v1.sql", import.meta.url), "utf8"));
  }
  prepare(sql) { return new Statement(this.sqlite.prepare(sql)); }
  async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); }
}
class R2 {
  objects = new Map();
  async put(key, value) { this.objects.set(key, { body: value instanceof Uint8Array ? value : new Uint8Array(value) }); }
  async get(key) { return this.objects.get(key) || null; }
  async delete(key) { this.objects.delete(key); }
}

const cors = {};
const merchantId = "staging-commerce-ai-45000";
const userId = "staging-commerce-owner";
const signature = { strokes: [[[4,4],[18,18],[38,16],[52,30],[71,25],[94,34]],[[11,52],[28,64],[49,60],[72,68],[96,63],[121,70]]] };
const signBody = { signatory_legal_name: "測試代表", signatory_role: "legal_representative", legal_representative_name: "測試代表", tax_id: "12345678", read: true, commercial_terms: true, authority: true, signature_evidence: true, electronic: true, signature };
const auth = { ok: true, session: { merchant_id: merchantId, user_id: userId, platform_member_id: "member-commerce", session_id: "session-commerce", display_name: "測試代表", merchant_name: "STAGING AI 商城測試商家", merchant_status: "contract_required", phone_normalized: "0911222333", roles: "owner" } };
const admin = { admin_user_id: "staging-admin" };
const request = (path, method = "GET", body, headers = {}) => new Request(`https://worker.test${path}`, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });

async function seed() {
  const db = new D1();
  db.sqlite.prepare("INSERT INTO platform_contract_legal_entity_configs(id,legal_name,tax_id,responsible_person,registered_address,support_contact,updated_by) VALUES('default','測試平台股份有限公司','12345678','測試負責人','台北市測試路 1 號','service@example.test','test')").run();
  db.sqlite.prepare("INSERT INTO merchants(id,merchant_code,name,contact_name,phone,email,status) VALUES(?,?,?,?,?,?,'contract_required')").run(merchantId,"STAGE-COMMERCE","STAGING AI 商城測試商家","測試代表","0911222333","commerce@example.test");
  db.sqlite.prepare("INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,status,display_name,phone_normalized,auth_mode) VALUES(?,?,?,'PASSWORDLESS_DISABLED','','active','測試代表','0911222333','passwordless_phone')").run(userId,merchantId,"commerce@example.test");
  db.sqlite.prepare("INSERT INTO merchant_roles(id,merchant_id,code,name) VALUES('commerce-owner-role',?,'owner','Owner')").run(merchantId);
  db.sqlite.prepare("INSERT INTO merchant_ordering_settings(merchant_id,display_name,enabled,require_member,ordering_open,accepting_orders) VALUES(?,'STAGING AI 商城測試商家',1,1,1,1)").run(merchantId);
  return db;
}

async function assign(db, key = "assign-commerce-ai-45000") {
  const req = request(`/api/admin/merchants/${merchantId}/commerce-ai-45000-plan`, "POST", { plan_id: COMMERCE_AI_PLAN_ID, confirm_fixed_price: true }, { "idempotency-key": key });
  return handleMerchantContractAdmin(req, { FINANCE_DB: db }, new URL(req.url), cors, admin);
}

async function contractCall(db, path, method = "GET", body, headers = {}, extra = {}) {
  const req = request(path, method, body, headers);
  return handleMerchantContractRequest(req, { FINANCE_DB: db, CONTRACT_SIGNING_MODE: "staging", ...extra }, new URL(req.url), cors, auth);
}

test("CA45-01 migration creates immutable fixed plan and keeps v1.1 unchanged", async () => {
  const db = new D1();
  const plan = db.sqlite.prepare("SELECT * FROM merchant_service_plans WHERE plan_id=?").get(COMMERCE_AI_PLAN_ID);
  const contract = db.sqlite.prepare("SELECT * FROM merchant_contract_versions WHERE id=?").get(COMMERCE_AI_CONTRACT_ID);
  assert.equal(plan.fixed_price_minor, 4500000);
  assert.equal(plan.pricing_model, "fixed_complete_package");
  assert.equal(contract.version, "merchant_commerce_ai_v1_0_45000");
  assert.equal(contract.content_html, COMMERCE_AI_CONTRACT_CONTENT_HTML);
  assert.equal(contract.content_hash, await sha256(COMMERCE_AI_CONTRACT_CONTENT_HTML));
  assert.equal(contract.legal_review_status, "pending_review");
  assert.equal(contract.staging_signing_enabled, 1);
  assert.equal(contract.is_active, 0);
  assert.ok(db.sqlite.prepare("SELECT id FROM merchant_contract_versions WHERE id=?").get(MERCHANT_SERVICE_V11_ID));
  assert.throws(() => db.sqlite.prepare("UPDATE merchant_service_plans SET fixed_price_minor=1 WHERE plan_id=?").run(COMMERCE_AI_PLAN_ID), /IMMUTABLE/);
});

test("CA45-02 body and Attachment A are fixed-price with no legacy line-item quote", () => {
  for (const phrase of ["契約雙方","商城建置","商家管理者後台","AI 功能","訂單與購物車","第三方金流","第三方費用","商家資料義務","資料安全","個人資料","智慧財產權","維護","電子簽署","契約終止","準據法"]) assert.match(COMMERCE_AI_CONTRACT_CONTENT_HTML, new RegExp(phrase));
  assert.match(COMMERCE_AI_CONTRACT_CONTENT_HTML, /NT\$45,000/);
  assert.match(COMMERCE_AI_CONTRACT_CONTENT_HTML, /不適用「每修改一項 NT\$200」/);
  assert.match(COMMERCE_AI_CONTRACT_CONTENT_HTML, /包含標準金流串接建置；實際啟用仍依第三方支付服務商審核、帳號申請及技術可用性為準/);
  assert.doesNotMatch(COMMERCE_AI_CONTRACT_CONTENT_HTML, /NT\$(?:30,000|8,000|22,000|12,800)/);
  const [attachment] = commerceAiAttachmentA({ discount_price_minor: 4500000 });
  assert.match(attachment.contentHtml, /總價：NT\$45,000/);
  assert.match(attachment.contentHtml, /不產生細項報價/);
  assert.doesNotMatch(attachment.contentHtml, /NT\$(?:30,000|8,000|22,000|12,800)/);
});

test("CA45-03 assignment is idempotent and grants only the explicit commerce flags", async () => {
  const db = await seed();
  let response = await assign(db); const first = await response.json();
  assert.equal(response.status, 201);
  assert.equal(first.plan_id, COMMERCE_AI_PLAN_ID);
  assert.equal(first.fixed_price_minor, 4500000);
  assert.equal(first.payment_enabled, false);
  response = await assign(db); const replay = await response.json();
  assert.equal(response.status, 200);
  assert.equal(replay.assignment_id, first.assignment_id);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_plan_assignments WHERE merchant_id=?").get(merchantId).count, 1);
  const flags = await commerceEntitlements(db, merchantId);
  assert.deepEqual(flags, { plan_id: COMMERCE_AI_PLAN_ID, commerce_full: true, cart: true, merchant_product_edit: true, merchant_content_editable: true, merchant_product_editable: true });
  const terms = db.sqlite.prepare("SELECT * FROM merchant_contract_commercial_terms WHERE id=?").get(first.commercial_terms_id);
  assert.equal(terms.list_price_minor, 4500000);
  assert.equal(terms.discount_price_minor, 4500000);
  assert.deepEqual(JSON.parse(terms.included_services_json), ["AI 智慧商城完整版（固定完整方案）"]);
});

test("CA45-04 contract renders 45,000 in Staging while Production legal gate stays locked", async () => {
  const db = await seed(); const assigned = await (await assign(db)).json();
  db.sqlite.prepare("INSERT INTO merchant_contract_invites(id,merchant_id,commercial_terms_id,email,token_hash,expires_at,used_at,created_by) VALUES('commerce-invite',?,?,?,'hash','2099-01-01',CURRENT_TIMESTAMP,'test')").run(merchantId,assigned.commercial_terms_id,"commerce@example.test");
  let response = await contractCall(db, "/api/merchant/contracts/current"); const current = await response.json();
  assert.equal(response.status, 200);
  assert.equal(current.contract.id, COMMERCE_AI_CONTRACT_ID);
  assert.equal(current.terms.discount_price_minor, 4500000);
  assert.equal(current.attachments.length, 1);
  const prodReq = request("/api/merchant/contracts/current");
  response = await handleMerchantContractRequest(prodReq, { FINANCE_DB: db, CONTRACT_SIGNING_MODE: "production" }, new URL(prodReq.url), cors, auth);
  assert.equal(response.status, 423);
  assert.equal((await response.json()).code, "LEGAL_REVIEW_REQUIRED");
});

test("CA45-05 preview/sign/PDF/Evidence activate merchant without faking payment", async () => {
  const db = await seed(); const assigned = await (await assign(db)).json();
  db.sqlite.prepare("INSERT INTO merchant_contract_invites(id,merchant_id,commercial_terms_id,email,token_hash,expires_at,used_at,created_by) VALUES('commerce-invite',?,?,?,'hash','2099-01-01',CURRENT_TIMESTAMP,'test')").run(merchantId,assigned.commercial_terms_id,"commerce@example.test");
  let response = await contractCall(db, "/api/merchant/contracts/sign-preview", "POST", signBody); const preview = await response.json();
  assert.equal(response.status, 200); assert.equal(preview.total_minor, 4500000); assert.equal(preview.version, "merchant_commerce_ai_v1_0_45000");
  const r2 = new R2(); const headers = { "idempotency-key": "commerce-ai-sign-once" };
  response = await contractCall(db, "/api/merchant/contracts/sign", "POST", signBody, headers, { CONTRACTS_BUCKET: r2, ...testContractFontEnv }); const signed = await response.json();
  assert.equal(response.status, 201); assert.ok(signed.pdf_hash); assert.ok(signed.document_hash); assert.equal(r2.objects.size, 2);
  const evidenceObject = [...r2.objects.entries()].find(([key]) => key.includes("/evidence-"));
  const evidence = JSON.parse(new TextDecoder().decode(evidenceObject[1].body));
  assert.equal(evidence.contract_version, "merchant_commerce_ai_v1_0_45000");
  assert.equal(evidence.environment, "STAGING_NOT_A_REAL_CONTRACT");
  assert.equal(db.sqlite.prepare("SELECT state FROM merchant_onboarding_states WHERE merchant_id=?").get(merchantId).state, "active");
  const readiness = await paymentReadiness(db, merchantId);
  assert.equal(readiness.production_payment_enabled, false);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM payments WHERE merchant_id=? AND status='paid'").get(merchantId).count, 0);
  response = await contractCall(db, "/api/merchant/contracts/sign", "POST", signBody, headers, { CONTRACTS_BUCKET: r2, ...testContractFontEnv });
  assert.equal(response.status, 200); assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_contract_signatures WHERE merchant_id=?").get(merchantId).count, 1);
});

test("CA45-06 active merchant can edit product fields and dashboard reports cart/payment gates", async () => {
  const db = await seed(); const assigned = await (await assign(db)).json();
  db.sqlite.prepare("INSERT INTO merchant_contract_invites(id,merchant_id,commercial_terms_id,email,token_hash,expires_at,used_at,created_by) VALUES('commerce-invite',?,?,?,'hash','2099-01-01',CURRENT_TIMESTAMP,'test')").run(merchantId,assigned.commercial_terms_id,"commerce@example.test");
  const r2 = new R2(); await contractCall(db, "/api/merchant/contracts/sign", "POST", signBody, { "idempotency-key": "commerce-ai-activate" }, { CONTRACTS_BUCKET: r2, ...testContractFontEnv });
  let req = request("/api/admin/ordering/categories", "POST", { name: "商城分類" });
  let response = await handleOrderingAdminRequest(req, { FINANCE_DB: db }, new URL(`${req.url}?merchant_id=${merchantId}`), cors, true, { actor_type: "merchant", actor_id: userId, actor_role: "owner" });
  const category = await response.json(); assert.equal(response.status, 201);
  req = request("/api/admin/ordering/items", "POST", { category_id: category.id, sku: "AI-001", name: "智慧商品", description: "測試商品", price_minor: 45000, image_url: "https://example.test/product.jpg", status: "active", daily_limit: 9 });
  response = await handleOrderingAdminRequest(req, { FINANCE_DB: db }, new URL(`${req.url}?merchant_id=${merchantId}`), cors, true, { actor_type: "merchant", actor_id: userId, actor_role: "owner" });
  const product = await response.json(); assert.equal(response.status, 201);
  req = request(`/api/admin/ordering/items/${product.id}`, "PATCH", { price_minor: 48000, status: "hidden", image_url: "https://example.test/product-v2.jpg" });
  response = await handleOrderingAdminRequest(req, { FINANCE_DB: db }, new URL(`${req.url}?merchant_id=${merchantId}`), cors, true, { actor_type: "merchant", actor_id: userId, actor_role: "owner" });
  assert.equal(response.status, 200);
  const stored = db.sqlite.prepare("SELECT price_minor,image_url,status,daily_limit FROM merchant_menu_items WHERE id=? AND merchant_id=?").get(product.id,merchantId);
  assert.deepEqual([stored.price_minor,stored.image_url,stored.status,stored.daily_limit],[48000,"https://example.test/product-v2.jpg","hidden",9]);
  req = request("/api/merchant-admin/dashboard");
  response = await handleMerchantAdmin(req, { FINANCE_DB: db }, new URL(req.url), cors, auth);
  const dashboard = await response.json();
  assert.equal(dashboard.plan.discount_price_minor, 4500000);
  assert.equal(dashboard.entitlements.cart, true);
  assert.equal(dashboard.entitlements.merchant_product_editable, true);
  assert.equal(dashboard.payment_readiness.production_payment_enabled, false);
});

test("CA45-07 cart creates an unpaid order and never implies Provider payment", async () => {
  const db = await seed(); await assign(db);
  db.sqlite.prepare("INSERT INTO merchant_ordering_qr_codes(id,merchant_id,code,label,purpose,table_label) VALUES('commerce-qr',?,'commerce-cart-code-45000','商城購物車','dine_in','WEB')").run(merchantId);
  db.sqlite.prepare("INSERT INTO merchant_menu_categories(id,merchant_id,name,active) VALUES('commerce-cat',?,'商城商品',1)").run(merchantId);
  db.sqlite.prepare("INSERT INTO merchant_menu_items(id,merchant_id,category_id,sku,name,price_minor,image_url,status,available) VALUES('commerce-product',?,'commerce-cat','SKU-45000','商城商品',9900,'https://example.test/item.jpg','active',1)").run(merchantId);
  let req = request("/api/ordering/qr/commerce-cart-code-45000/join", "POST", { phone: "0933444555", privacy_consent: true, consent_version: "2026-08-27", device_id: "commerce-cart-test" });
  let response = await handleOrderingRequest(req, { FINANCE_DB: db }, new URL(req.url), cors); const joined = await response.json();
  assert.equal(response.status, 201); assert.ok(joined.session.token);
  req = request("/api/ordering/qr/commerce-cart-code-45000/orders", "POST", { order_type: "dine_in", table_label: "WEB", items: [{ item_id: "commerce-product", quantity: 2 }] }, { authorization: `Bearer ${joined.session.token}`, "idempotency-key": "commerce-cart-order-once" });
  response = await handleOrderingRequest(req, { FINANCE_DB: db }, new URL(req.url), cors); const created = await response.json();
  assert.equal(response.status, 201);
  assert.equal(created.order.total_minor, 19800);
  assert.equal(created.order.payment_status, "unpaid");
  assert.equal(db.sqlite.prepare("SELECT payment_status FROM merchant_food_orders WHERE merchant_id=?").get(merchantId).payment_status, "unpaid");
  assert.equal((await paymentReadiness(db, merchantId)).production_payment_enabled, false);
});
