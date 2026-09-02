import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { handleMerchantContractRequest } from "../src/merchant-contracts.js";
import { hashCanonical } from "../src/contract-engine.js";
import { sha256 } from "../src/contract-pdf.js";
import { MERCHANT_SERVICE_V11_CONTENT_HTML, MERCHANT_SERVICE_V11_ID, merchantServiceV11AttachmentA } from "../src/merchant-contract-v11.js";
import { testContractFontEnv } from "./contract-font-fixture.mjs";

class Statement {
  constructor(statement) { this.statement = statement; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async run() { const result = this.statement.run(...this.values); return { meta: { changes: Number(result.changes || 0) } }; }
  async first() { return this.statement.get(...this.values) || null; }
  async all() { return { results: this.statement.all(...this.values) }; }
}
class D1 {
  constructor() { this.sqlite = new DatabaseSync(":memory:"); for (const name of readdirSync(new URL("../migrations", import.meta.url)).filter((x) => /^\d+.*\.sql$/.test(x)).sort()) this.sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n")); }
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
const signature = { strokes: [[[4, 4], [18, 18], [38, 16], [52, 30], [71, 25], [94, 34]], [[11, 52], [28, 64], [49, 60], [72, 68], [96, 63], [121, 70]]] };
const signBody = { signatory_legal_name: "測試代表", signatory_role: "legal_representative", legal_representative_name: "測試代表", tax_id: "12345678", read: true, commercial_terms: true, authority: true, signature_evidence: true, electronic: true, signature };

async function seed({ legalEntity = true } = {}) {
  const db = new D1();
  db.sqlite.prepare("UPDATE merchant_contract_versions SET staging_signing_enabled=1 WHERE id=?").run(MERCHANT_SERVICE_V11_ID);
  if (legalEntity) db.sqlite.prepare("INSERT INTO platform_contract_legal_entity_configs(id,legal_name,tax_id,responsible_person,registered_address,support_contact,updated_by) VALUES('default','測試平台股份有限公司','12345678','測試負責人','台北市測試路 1 號','service@example.test','test')").run();
  db.sqlite.prepare("INSERT INTO merchants(id,merchant_code,name,contact_name,phone,email,status) VALUES('merchant-v11','MV11','標準測試商家','測試代表','0911222333','merchant@example.test','contract_required')").run();
  db.sqlite.prepare("INSERT INTO merchant_onboarding_states(merchant_id,registration_mode,state,operation_locked,commercial_terms_approval_required) VALUES('merchant-v11','standard_self_service','contract_required',1,0)").run();
  const legacySnapshot = { plan_code: "baiye_standard_18000", plan_name: "創百業智慧鏈｜AI 行銷推廣及數位服務方案", list_price_minor: 3000000, discount_price_minor: 1800000, currency: "TWD", contract_term_months: 24, payment_plan: "upfront_18000", upfront_amount_minor: 1800000, offset_target_amount_minor: 0, tax_reserve_enabled: 0, withholding_enabled: 0, included_services: [], excluded_services: [], attachments: {}, start_date: "2026-09-02", service_period_end: "2028-09-01", renewal_terms: "第三年起續約依契約", custom_quote_reference: null };
  const legacyHash = await hashCanonical(legacySnapshot);
  db.sqlite.prepare(`INSERT INTO merchant_contract_commercial_terms(id,merchant_id,plan_code,plan_name,list_price_minor,discount_price_minor,contract_term_months,payment_plan,upfront_amount_minor,offset_target_amount_minor,included_services_json,excluded_services_json,attachments_json,start_date,service_period_end,renewal_terms,status,created_by,approved_by,approved_at,terms_hash,source_preset_id)
    VALUES('terms-v11','merchant-v11','baiye_standard_18000','創百業智慧鏈｜AI 行銷推廣及數位服務方案',3000000,1800000,24,'upfront_18000',1800000,0,'[]','[]','{}','2026-09-02','2028-09-01','第三年起續約依契約','approved','test','test',CURRENT_TIMESTAMP,?,'baiye_standard_18000')`).run(legacyHash);
  const terms = db.sqlite.prepare("SELECT * FROM merchant_contract_commercial_terms WHERE id='terms-v11'").get();
  db.sqlite.prepare("UPDATE merchant_onboarding_states SET commercial_terms_id=? WHERE merchant_id='merchant-v11'").run(terms.id);
  db.sqlite.prepare("INSERT INTO merchant_contract_invites(id,merchant_id,commercial_terms_id,email,token_hash,expires_at,used_at,created_by) VALUES('invite-v11','merchant-v11',?,'merchant@example.test','hash','2099-01-01',CURRENT_TIMESTAMP,'test')").run(terms.id);
  db.sqlite.prepare("INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,display_name,phone_normalized,auth_mode) VALUES('user-v11','merchant-v11','merchant@example.test','PASSWORDLESS_DISABLED','','測試代表','0911222333','passwordless_phone')").run();
  db.sqlite.prepare("INSERT INTO merchant_roles(id,merchant_id,code,name) VALUES('role-v11','merchant-v11','owner','Owner')").run();
  return { db, auth: { ok: true, session: { merchant_id: "merchant-v11", user_id: "user-v11", session_id: "merchant-session-v11", display_name: "測試代表", roles: "owner" } } };
}
function request(path, method = "GET", body = undefined, headers = {}) { return new Request(`https://worker.test${path}`, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
async function call(fixture, path, method = "GET", body = undefined, headers = {}, envExtra = {}) {
  const req = request(path, method, body, headers);
  return handleMerchantContractRequest(req, { FINANCE_DB: fixture.db, CONTRACT_SIGNING_MODE: "staging", ...envExtra }, new URL(req.url), cors, fixture.auth);
}

test("MCV11-01 v1.1 is immutable pending-review and inactive by default", async () => {
  const db = new D1(); const row = db.sqlite.prepare("SELECT * FROM merchant_contract_versions WHERE id=?").get(MERCHANT_SERVICE_V11_ID);
  assert.equal(row.version, "v1.1"); assert.equal(row.legal_review_status, "pending_review"); assert.equal(row.is_active, 0); assert.equal(row.staging_signing_enabled, 0); assert.equal(row.requires_resign, 0);
  assert.equal(row.content_html, MERCHANT_SERVICE_V11_CONTENT_HTML); assert.equal(row.content_hash, await sha256(MERCHANT_SERVICE_V11_CONTENT_HTML));
});
test("MCV11-02 body and Attachment A contain the approved standard terms", () => {
  assert.match(MERCHANT_SERVICE_V11_CONTENT_HTML, /NT\$18,000/); assert.match(MERCHANT_SERVICE_V11_CONTENT_HTML, /24 個月/); assert.match(MERCHANT_SERVICE_V11_CONTENT_HTML, /第三年起續約/);
  const [attachment] = merchantServiceV11AttachmentA({ plan_name: "創百業智慧鏈｜AI 行銷推廣及數位服務方案", list_price_minor: 3000000, discount_price_minor: 1800000, contract_term_months: 24, payment_plan: "upfront_18000" });
  assert.match(attachment.contentHtml, /標準網站建置費：NT\$0/); assert.match(attachment.contentHtml, /NT\$7,000/);
});
test("MCV11-03 Staging current returns a complete v1.1 body, terms and attachment", async () => {
  const fixture = await seed(); const response = await call(fixture, "/api/merchant/contracts/current"); const data = await response.json();
  assert.equal(response.status, 200); assert.equal(data.contract.id, MERCHANT_SERVICE_V11_ID); assert.ok(data.contract.content_html); assert.equal(data.terms.discount_price_minor, 1800000); assert.equal(data.terms.contract_term_months, 24); assert.equal(data.attachments[0].title, "附件 A｜商業條件"); assert.equal(data.signed, false);
});
test("MCV11-03A standard 18000 terms cannot be hijacked by a newer unrelated Staging contract", async () => {
  const fixture = await seed();
  fixture.db.sqlite.prepare("INSERT INTO merchant_contract_versions(id,version,title,content_html,content_hash,effective_date,legal_review_status,legal_review_required,is_active,staging_signing_enabled) VALUES('unrelated-newer','v9','其他方案','<p>其他</p>','other','2099-01-01','pending_review',1,0,1)").run();
  const response = await call(fixture, "/api/merchant/contracts/current");
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.contract.id, MERCHANT_SERVICE_V11_ID);
});
test("MCV11-04 Production keeps pending-review version locked", async () => {
  const fixture = await seed(); const req = request("/api/merchant/contracts/current"); const response = await handleMerchantContractRequest(req, { FINANCE_DB: fixture.db, CONTRACT_SIGNING_MODE: "production" }, new URL(req.url), cors, fixture.auth); const data = await response.json();
  assert.equal(response.status, 423); assert.equal(data.code, "LEGAL_REVIEW_REQUIRED");
});
test("MCV11-05 missing legal entity is shown but cannot produce a signing preview", async () => {
  const fixture = await seed({ legalEntity: false }); let response = await call(fixture, "/api/merchant/contracts/current"); const current = await response.json();
  assert.equal(response.status, 200); assert.equal(current.contract.id, MERCHANT_SERVICE_V11_ID); assert.equal(current.legal_entity.configured, false);
  response = await call(fixture, "/api/merchant/contracts/sign-preview", "POST", signBody); const data = await response.json(); assert.equal(response.status, 409); assert.equal(data.code, "PLATFORM_LEGAL_ENTITY_CONFIGURATION_REQUIRED");
});
test("MCV11-06 preview requires exactly all five consents and a meaningful signature", async () => {
  const fixture = await seed(); let response = await call(fixture, "/api/merchant/contracts/sign-preview", "POST", { ...signBody, electronic: false }); let data = await response.json(); assert.equal(response.status, 422); assert.equal(data.code, "CONSENT_REQUIRED");
  response = await call(fixture, "/api/merchant/contracts/sign-preview", "POST", { ...signBody, signature: { strokes: [[[1, 1], [2, 2]]] } }); data = await response.json(); assert.equal(response.status, 422); assert.equal(data.code, "SIGNATURE_TOO_SHORT");
});
test("MCV11-07 successful v1.1 signing stores PDF/evidence once with party snapshot and hashes", async () => {
  const fixture = await seed(); const r2 = new R2(); const headers = { "idempotency-key": "merchant-v11-sign-0001" };
  const response = await call(fixture, "/api/merchant/contracts/sign", "POST", signBody, headers, { CONTRACTS_BUCKET: r2, ...testContractFontEnv }); const data = await response.json();
  assert.equal(response.status, 201); assert.ok(data.signature_id); assert.ok(data.document_hash); assert.ok(data.pdf_hash); assert.ok(data.signed_at); assert.equal(r2.objects.size, 2);
  const row = fixture.db.sqlite.prepare("SELECT party_snapshot_json,contract_content_hash,commercial_terms_hash FROM merchant_contract_signatures WHERE id=?").get(data.signature_id); assert.equal(row.contract_content_hash, await sha256(MERCHANT_SERVICE_V11_CONTENT_HTML)); assert.equal(JSON.parse(row.party_snapshot_json).platform.legal_name, "測試平台股份有限公司"); assert.ok(row.commercial_terms_hash);
  const replay = await call(fixture, "/api/merchant/contracts/sign", "POST", signBody, headers, { CONTRACTS_BUCKET: r2, ...testContractFontEnv }); assert.equal(replay.status, 200); assert.equal(fixture.db.sqlite.prepare("SELECT COUNT(*) c FROM merchant_contract_signatures").get().c, 1);
});
test("MCV11-08 v1.1 private PDF extracts the complete Chinese body and Attachment A", async () => {
  const fixture = await seed(); const r2 = new R2(); const response = await call(fixture, "/api/merchant/contracts/sign", "POST", signBody, { "idempotency-key": "merchant-v11-sign-0002" }, { CONTRACTS_BUCKET: r2, ...testContractFontEnv }); assert.equal(response.status, 201);
  const pdf = [...r2.objects.entries()].find(([key]) => key.endsWith(".pdf"))?.[1]?.body; const document = await pdfjs.getDocument({ data: Uint8Array.from(pdf), useWorkerFetch: false, isEvalSupported: false }).promise;
  let text = ""; for (let index = 1; index <= document.numPages; index += 1) text += (await (await document.getPage(index)).getTextContent()).items.map((item) => item.str).join("");
  assert.match(text, /商家平台服務契約/); assert.match(text, /新臺幣\s*18,000\s*元整/); assert.match(text, /附件\s*A｜商業條件/); assert.match(text, /NT\$7,000/); assert.doesNotMatch(new TextDecoder("latin1").decode(pdf), /MSung-Light|UniCNS-UTF16-H/);
});
test("MCV11-09 merchant UI exposes one private download label and no legacy completed copy for unsigned state", () => {
  const page = readFileSync(new URL("../../src/pages/MerchantContractPages.tsx", import.meta.url), "utf8"); const portal = readFileSync(new URL("../../src/pages/MerchantAccessPages.tsx", import.meta.url), "utf8");
  assert.match(page, /下載契約檔案/); assert.doesNotMatch(page, /查看已簽 PDF/); assert.match(page, /本人正楷手寫簽名/); assert.match(page, /NT\$18,000/);
  assert.match(portal, /完成契約簽署後，即可啟用商家正式營運功能/); assert.match(portal, /下載契約檔案/); assert.doesNotMatch(portal, /商家平台服務契約已完成。/);
});
