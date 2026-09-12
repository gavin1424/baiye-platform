import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { handleMerchantContractRequest } from "../src/merchant-contracts.js";
import { merchantOperationsAllowed } from "../src/merchant-auth.js";
import { sha256 } from "../src/contract-pdf.js";
import {
  INSTALLMENT_DISCLOSURE,
  SOFTPOS_CONTRACT_VERSION_ID,
  SOFTPOS_PLAN_ID,
  declineSoftposRenewal,
  deriveRenewalState,
  ensureSoftposCommercialTerms,
  prepareSoftposRenewal,
  softposCommercialTermsSnapshot,
  softposPlanSummary,
} from "../src/merchant-softpos-plan.js";
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
    for (const name of readdirSync(new URL("../migrations", import.meta.url)).filter((item) => /^\d+.*\.sql$/.test(item)).sort()) {
      this.sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n"));
    }
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

const signature = { strokes: [[[4,4],[18,18],[38,16],[52,30],[71,25],[94,34]],[[11,52],[28,64],[49,60],[72,68],[96,63],[121,70]]] };
const signBody = { signatory_legal_name: "測試代表", signatory_role: "legal_representative", legal_representative_name: "測試代表", tax_id: "12345678", read: true, commercial_terms: true, authority: true, signature_evidence: true, electronic: true, signature };
const auth = { ok: true, session: { merchant_id: "merchant-softpos", user_id: "user-softpos", session_id: "session-softpos", display_name: "測試代表", roles: "owner" } };
const request = (path, method = "GET", body, headers = {}) => new Request(`https://worker.test${path}`, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
async function call(db, path, method = "GET", body, headers = {}, extra = {}) {
  const req = request(path, method, body, headers);
  return handleMerchantContractRequest(req, { FINANCE_DB: db, CONTRACT_SIGNING_MODE: "staging", SOFTPOS_CONTRACT_STAGING_ENABLED: "true", ...extra }, new URL(req.url), {}, auth);
}

async function seed() {
  const db = new D1();
  db.sqlite.prepare("INSERT INTO platform_contract_legal_entity_configs(id,legal_name,tax_id,responsible_person,registered_address,support_contact,updated_by) VALUES('default','測試平台股份有限公司','12345678','測試負責人','台北市測試路 1 號','service@example.test','test')").run();
  db.sqlite.prepare("INSERT INTO merchants(id,merchant_code,name,contact_name,phone,email,status) VALUES('merchant-softpos','MSP','SoftPOS 測試商家','測試代表','0911222333','merchant@example.test','contract_required')").run();
  db.sqlite.prepare("INSERT INTO merchant_onboarding_states(merchant_id,registration_mode,state,operation_locked,commercial_terms_approval_required) VALUES('merchant-softpos','standard_self_service','contract_required',1,0)").run();
  const terms = (await ensureSoftposCommercialTerms(db, "merchant-softpos", new Date("2026-09-02T00:00:00+08:00"))).terms;
  db.sqlite.prepare("UPDATE merchant_onboarding_states SET commercial_terms_id=? WHERE merchant_id='merchant-softpos'").run(terms.id);
  db.sqlite.prepare("INSERT INTO merchant_contract_invites(id,merchant_id,commercial_terms_id,email,token_hash,expires_at,used_at,created_by) VALUES('invite-softpos','merchant-softpos',?,'merchant@example.test','hash-softpos','2099-01-01',CURRENT_TIMESTAMP,'test')").run(terms.id);
  db.sqlite.prepare("INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,display_name,phone_normalized,auth_mode) VALUES('user-softpos','merchant-softpos','merchant@example.test','PASSWORDLESS_DISABLED','','測試代表','0911222333','passwordless_phone')").run();
  db.sqlite.prepare("INSERT INTO merchant_roles(id,merchant_id,code,name) VALUES('role-softpos','merchant-softpos','owner','Owner')").run();
  return db;
}

test("SP01 migration keeps the unique 0023-0026 integration sequence and immutable integer plan data", async () => {
  const db = new D1();
  const plan = db.sqlite.prepare("SELECT * FROM merchant_service_plan_versions WHERE plan_id=?").get(SOFTPOS_PLAN_ID);
  assert.deepEqual([plan.activation_fee,plan.deposit,plan.trial_months,plan.cycle_months,plan.cycle_fee,plan.first_cycle_credit,plan.first_cycle_balance], [300000,600000,3,24,2400000,600000,1800000]);
  assert.equal(plan.legal_status, "pending_review"); assert.equal(plan.environment, "staging");
  assert.throws(() => db.sqlite.prepare("UPDATE merchant_service_plan_versions SET cycle_fee=1 WHERE plan_id=?").run(SOFTPOS_PLAN_ID), /IMMUTABLE/);
  const migrations = readdirSync(new URL("../migrations", import.meta.url));
  assert.ok(migrations.includes("0023_contract_commerce_ai_45000.sql"));
  assert.ok(migrations.includes("0024_contract_softpos_24000.sql"));
  assert.ok(migrations.includes("0025_contract_standard_addons.sql"));
  assert.ok(migrations.includes("0026_unified_registration_contract_center.sql"));
  for (const expected of ["0023_contract_commerce_ai_45000.sql","0024_contract_softpos_24000.sql","0025_contract_standard_addons.sql","0026_unified_registration_contract_center.sql"]) assert.equal(migrations.filter((name) => name === expected).length, 1);
});

test("SP02 new contract body keeps legal gate and states the 6k + 18k schedule", async () => {
  const db = new D1(); const row = db.sqlite.prepare("SELECT * FROM merchant_contract_versions WHERE id=?").get(SOFTPOS_CONTRACT_VERSION_ID);
  assert.equal(row.version, "merchant_softpos_v1_2_24000_payment"); assert.equal(row.legal_review_status, "pending_review"); assert.equal(row.is_active, 0); assert.equal(row.staging_signing_enabled, 1); assert.doesNotMatch(row.content_html,/QR|JKOPay|街口|qr_asset_key|deep_link/i);
  assert.equal(row.content_hash, "83yaTB1CAFALduFTVT0O93FIZKnbnxwFwPaRRRRh_nY");
  for (const phrase of ["契約總額為新臺幣 24,000 元","簽約時支付首期款新臺幣 6,000 元","三個月為試用期間","剩餘尾款新臺幣 18,000 元","免專用 POS 主機"]) assert.match(row.content_html, new RegExp(phrase));
  assert.doesNotMatch(row.content_html, /開通費新臺幣 3,000 元|保證金新臺幣 6,000 元/);
  assert.doesNotMatch(row.content_html, /完全零硬體。/);
});

test("SP03 payment schedule snapshot uses integers and a 3-month trial before the 24-month cycle", () => {
  const snapshot = softposCommercialTermsSnapshot(new Date("2026-09-02T00:00:00+08:00"));
  assert.equal(snapshot.plan_code, SOFTPOS_PLAN_ID); assert.equal(snapshot.start_date, "2026-12-02"); assert.equal(snapshot.service_period_end, "2028-12-01");
  assert.equal(snapshot.trial_period_months, 3); assert.equal(snapshot.contract_total_amount_minor, 2400000); assert.equal(snapshot.payment_due_at_signature_minor, 600000); assert.equal(snapshot.post_trial_payment_minor, 1800000);
  for (const value of [snapshot.list_price_minor,snapshot.discount_price_minor,snapshot.upfront_amount_minor,...Object.values(snapshot.attachments).filter(Number.isInteger)]) assert.equal(Number.isInteger(value), true);
});

test("SP04 Provider capability is separate and no installment transaction is faked", async () => {
  const plan = await softposPlanSummary(new D1());
  assert.deepEqual(plan.payment_terms, { installment_count: 24, interest_rate_bps: 0 });
  assert.equal(plan.payment_provider.ready, false); assert.equal(plan.payment_provider.transaction_created, false); assert.equal(plan.payment_provider.disclosure, INSTALLMENT_DISCLOSURE);
});

test("SP05 staging contract homepage exposes all required amounts and existing Core integrations", async () => {
  const db = await seed(); const response = await call(db, "/api/merchant/contracts/current"); const data = await response.json();
  assert.equal(response.status, 200); assert.equal(data.contract.id, SOFTPOS_CONTRACT_VERSION_ID); assert.equal(data.terms.contract_total_amount_minor, 2400000); assert.equal(data.terms.payment_due_at_signature_minor, 600000); assert.equal(data.terms.trial_period_months, 3); assert.equal(data.terms.post_trial_payment_minor, 1800000);
  assert.match(JSON.stringify(data.terms), /QR Ordering/); assert.match(JSON.stringify(data.terms), /KDS/); assert.match(JSON.stringify(data.terms), /Merchant Admin/);
});

test("SP06 Production remains blocked while legal review is pending", async () => {
  const db = await seed(); const req = request("/api/merchant/contracts/current");
  const response = await handleMerchantContractRequest(req, { FINANCE_DB: db, CONTRACT_SIGNING_MODE: "production", SOFTPOS_CONTRACT_STAGING_ENABLED: "true" }, new URL(req.url), {}, auth);
  assert.equal(response.status, 423); assert.equal((await response.json()).code, "LEGAL_REVIEW_REQUIRED");
});

test("SP07 Common Contract Engine signs once, stores PDF/Evidence and creates only the 6k request", async () => {
  const db = await seed(), r2 = new R2();
  const response = await call(db, "/api/merchant/contracts/sign", "POST", signBody, { "idempotency-key": "softpos-sign-0001" }, { CONTRACTS_BUCKET: r2, ...testContractFontEnv }); const data = await response.json();
  assert.equal(response.status, 201); assert.ok(data.document_hash); assert.ok(data.pdf_hash); assert.equal(r2.objects.size, 2);
  assert.equal(data.lifecycle_status, "SIGNED_PENDING_PAYMENT"); assert.equal(data.payment.amount_due_minor, 600000);
  const schedules = db.sqlite.prepare("SELECT phase,amount_due_minor FROM merchant_contract_payment_schedules ORDER BY sequence_number").all(); assert.deepEqual(schedules.map((item) => [item.phase,item.amount_due_minor]), [["SIGNATURE",600000],["AFTER_TRIAL",1800000]]);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_service_subscriptions").get().count, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_contract_artifacts").get().count, 2);
});

test("SP08 renewal state covers all six required states", () => {
  const base = { trial_ends_at: "2026-12-01", renewal_state: "TRIAL" };
  assert.equal(deriveRenewalState(base, null, "2026-10-01"), "TRIAL"); assert.equal(deriveRenewalState(base, null, "2026-11-15"), "TRIAL_ENDING"); assert.equal(deriveRenewalState(base, null, "2026-12-02"), "RENEWAL_REQUIRED");
  assert.equal(deriveRenewalState(base, { status:"ACTIVE",service_period_end:"2028-12-01" }, "2027-01-01"), "ACTIVE"); assert.equal(deriveRenewalState(base, { status:"ACTIVE",service_period_end:"2028-12-01" }, "2028-11-15"), "EXPIRING"); assert.equal(deriveRenewalState(base, { status:"EXPIRED",service_period_end:"2028-12-01" }, "2028-12-02"), "EXPIRED");
});

test("SP09 post-trial tail is scheduled as 18,000 and no fake paid transaction is created", async () => {
  const db = await seed(), r2 = new R2(); const signed = await call(db, "/api/merchant/contracts/sign", "POST", signBody, { "idempotency-key": "softpos-sign-0002" }, { CONTRACTS_BUCKET: r2, ...testContractFontEnv }); assert.equal(signed.status, 201);
  const tail = db.sqlite.prepare("SELECT * FROM merchant_contract_payment_schedules WHERE phase='AFTER_TRIAL'").get();
  assert.equal(tail.amount_due_minor, 1800000); assert.equal(tail.trial_period_months, 3); assert.equal(tail.status, "pending");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM payments WHERE merchant_id='merchant-softpos'").get().count, 0);
});

test("SP10 signing replay preserves one signature and one two-phase schedule", async () => {
  const db = await seed(), r2 = new R2(); await call(db, "/api/merchant/contracts/sign", "POST", signBody, { "idempotency-key": "softpos-sign-0003" }, { CONTRACTS_BUCKET: r2, ...testContractFontEnv });
  await call(db, "/api/merchant/contracts/sign", "POST", signBody, { "idempotency-key": "softpos-sign-0003" }, { CONTRACTS_BUCKET: r2, ...testContractFontEnv });
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_contract_payment_schedules").get().count, 2);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_contract_payment_requests").get().count, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_contract_signatures WHERE merchant_id='merchant-softpos'").get().count, 1);
});

test("SP11 UI includes the new payment labels and never claims zero hardware", () => {
  const page = readFileSync(new URL("../../src/pages/MerchantContractPages.tsx", import.meta.url), "utf8");
  for (const phrase of ["契約總額","簽約首期款","試用期間","試用期結束尾款","分期方式須由合作銀行／金流服務商確認後提供"]) assert.match(page, new RegExp(phrase));
  assert.doesNotMatch(page, /假交易|Provider 實際 24 期能力/);
  assert.doesNotMatch(page, />完全零硬體</);
});

test("SP12 signed but unpaid locks operations and preserves evidence", async () => {
  const db = await seed(), r2 = new R2(); await call(db, "/api/merchant/contracts/sign", "POST", signBody, { "idempotency-key": "softpos-sign-0004" }, { CONTRACTS_BUCKET: r2, ...testContractFontEnv });
  const gate = await merchantOperationsAllowed(db, "merchant-softpos"); assert.equal(gate.ok, false); assert.equal(gate.error, "MERCHANT_PAYMENT_REQUIRED");
  assert.equal(db.sqlite.prepare("SELECT operation_locked FROM merchant_onboarding_states WHERE merchant_id='merchant-softpos'").get().operation_locked, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_contract_artifacts").get().count, 2);
});
