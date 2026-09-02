import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { handleMerchantContractRequest } from "../src/merchant-contracts.js";
import { sha256 } from "../src/contract-pdf.js";
import {
  INSTALLMENT_DISCLOSURE,
  SOFTPOS_CONTRACT_VERSION_ID,
  SOFTPOS_PLAN_ID,
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

test("SP01 migration reserves exactly 0024 and seeds immutable integer plan data", async () => {
  const db = new D1();
  const plan = db.sqlite.prepare("SELECT * FROM merchant_service_plan_versions WHERE plan_id=?").get(SOFTPOS_PLAN_ID);
  assert.deepEqual([plan.activation_fee,plan.deposit,plan.trial_months,plan.cycle_months,plan.cycle_fee,plan.first_cycle_credit,plan.first_cycle_balance], [300000,600000,3,24,2400000,600000,1800000]);
  assert.equal(plan.legal_status, "pending_review"); assert.equal(plan.environment, "staging");
  assert.throws(() => db.sqlite.prepare("UPDATE merchant_service_plan_versions SET cycle_fee=1 WHERE plan_id=?").run(SOFTPOS_PLAN_ID), /IMMUTABLE/);
  const migrations = readdirSync(new URL("../migrations", import.meta.url)); assert.ok(migrations.includes("0024_contract_softpos_24000.sql")); assert.equal(migrations.some((name) => name.startsWith("0025")), false);
});

test("SP02 contract body hash, legal gate and precise deposit clauses are present", async () => {
  const db = new D1(); const row = db.sqlite.prepare("SELECT * FROM merchant_contract_versions WHERE id=?").get(SOFTPOS_CONTRACT_VERSION_ID);
  assert.equal(row.version, "merchant_softpos_v1_0_24000"); assert.equal(row.legal_review_status, "pending_review"); assert.equal(row.is_active, 0); assert.equal(row.staging_signing_enabled, 1);
  assert.equal(row.content_hash, await sha256(row.content_html));
  for (const phrase of ["保證金用於","才依前條抵充","不進行前述服務費抵充","終止結算完成後 30 日內","未履行義務","免專用 POS 主機"]) assert.match(row.content_html, new RegExp(phrase));
  assert.doesNotMatch(row.content_html, /完全零硬體。/);
});

test("SP03 payment schedule snapshot uses integers and a 3-month trial before the 24-month cycle", () => {
  const snapshot = softposCommercialTermsSnapshot(new Date("2026-09-02T00:00:00+08:00"));
  assert.equal(snapshot.plan_code, SOFTPOS_PLAN_ID); assert.equal(snapshot.start_date, "2026-12-02"); assert.equal(snapshot.service_period_end, "2028-12-01");
  assert.equal(snapshot.attachments.trial_months, 3); assert.equal(snapshot.attachments.cycle_fee_minor, 2400000); assert.equal(snapshot.attachments.first_cycle_balance_minor, 1800000);
  for (const value of [snapshot.list_price_minor,snapshot.discount_price_minor,snapshot.upfront_amount_minor,...Object.values(snapshot.attachments).filter(Number.isInteger)]) assert.equal(Number.isInteger(value), true);
});

test("SP04 Provider capability is separate and no installment transaction is faked", async () => {
  const plan = await softposPlanSummary(new D1());
  assert.deepEqual(plan.payment_terms, { installment_count: 24, interest_rate_bps: 0 });
  assert.equal(plan.payment_provider.ready, false); assert.equal(plan.payment_provider.transaction_created, false); assert.equal(plan.payment_provider.disclosure, INSTALLMENT_DISCLOSURE);
});

test("SP05 staging contract homepage exposes all required amounts and existing Core integrations", async () => {
  const db = await seed(); const response = await call(db, "/api/merchant/contracts/current"); const data = await response.json();
  assert.equal(response.status, 200); assert.equal(data.contract.id, SOFTPOS_CONTRACT_VERSION_ID); assert.equal(data.plan.activation_fee, 300000); assert.equal(data.plan.deposit, 600000); assert.equal(data.plan.trial_months, 3); assert.equal(data.plan.cycle_fee, 2400000); assert.equal(data.plan.first_cycle_balance, 1800000); assert.equal(data.plan.renewal_fee, 2400000);
  assert.match(JSON.stringify(data.terms), /QR Ordering/); assert.match(JSON.stringify(data.terms), /KDS/); assert.match(JSON.stringify(data.terms), /Merchant Admin/);
});

test("SP06 Production remains blocked while legal review is pending", async () => {
  const db = await seed(); const req = request("/api/merchant/contracts/current");
  const response = await handleMerchantContractRequest(req, { FINANCE_DB: db, CONTRACT_SIGNING_MODE: "production", SOFTPOS_CONTRACT_STAGING_ENABLED: "true" }, new URL(req.url), {}, auth);
  assert.equal(response.status, 423); assert.equal((await response.json()).code, "LEGAL_REVIEW_REQUIRED");
});

test("SP07 Common Contract Engine signs once, stores PDF/Evidence and starts Trial without service receivable", async () => {
  const db = await seed(), r2 = new R2();
  const response = await call(db, "/api/merchant/contracts/sign", "POST", signBody, { "idempotency-key": "softpos-sign-0001" }, { CONTRACTS_BUCKET: r2, ...testContractFontEnv }); const data = await response.json();
  assert.equal(response.status, 201); assert.ok(data.document_hash); assert.ok(data.pdf_hash); assert.equal(r2.objects.size, 2);
  const subscription = db.sqlite.prepare("SELECT * FROM merchant_service_subscriptions WHERE merchant_id='merchant-softpos'").get(); assert.equal(subscription.renewal_state, "TRIAL"); assert.equal(subscription.activation_fee_minor, 300000); assert.equal(subscription.deposit_minor, 600000); assert.equal(subscription.current_cycle_number, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_service_cycles").get().count, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_contract_artifacts").get().count, 2);
});

test("SP08 renewal state covers all six required states", () => {
  const base = { trial_ends_at: "2026-12-01", renewal_state: "TRIAL" };
  assert.equal(deriveRenewalState(base, null, "2026-10-01"), "TRIAL"); assert.equal(deriveRenewalState(base, null, "2026-11-15"), "TRIAL_ENDING"); assert.equal(deriveRenewalState(base, null, "2026-12-02"), "RENEWAL_REQUIRED");
  assert.equal(deriveRenewalState(base, { status:"ACTIVE",service_period_end:"2028-12-01" }, "2027-01-01"), "ACTIVE"); assert.equal(deriveRenewalState(base, { status:"ACTIVE",service_period_end:"2028-12-01" }, "2028-11-15"), "EXPIRING"); assert.equal(deriveRenewalState(base, { status:"EXPIRED",service_period_end:"2028-12-01" }, "2028-12-02"), "EXPIRED");
});

test("SP09 first cycle credits deposit once and returns 18,000 without creating a payment", async () => {
  const db = await seed(), r2 = new R2(); const signed = await call(db, "/api/merchant/contracts/sign", "POST", signBody, { "idempotency-key": "softpos-sign-0002" }, { CONTRACTS_BUCKET: r2, ...testContractFontEnv }); assert.equal(signed.status, 201);
  db.sqlite.prepare("UPDATE merchant_service_subscriptions SET trial_ends_at='2026-01-01' WHERE merchant_id='merchant-softpos'").run();
  const cycle = await prepareSoftposRenewal(db, "merchant-softpos", new Date("2026-09-02T00:00:00+08:00"));
  assert.equal(cycle.cycle_number, 1); assert.equal(cycle.cycle_fee_minor, 2400000); assert.equal(cycle.deposit_credit_minor, 600000); assert.equal(cycle.balance_due_minor, 1800000); assert.equal(cycle.deposit_charge_minor, 0); assert.equal(cycle.status, "PAYMENT_REQUIRED");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM payments WHERE merchant_id='merchant-softpos'").get().count, 0);
});

test("SP10 subsequent renewal is a new 24-month cycle for 24,000 with no second deposit", async () => {
  const db = await seed(), r2 = new R2(); await call(db, "/api/merchant/contracts/sign", "POST", signBody, { "idempotency-key": "softpos-sign-0003" }, { CONTRACTS_BUCKET: r2, ...testContractFontEnv });
  db.sqlite.prepare("UPDATE merchant_service_subscriptions SET trial_ends_at='2026-01-01' WHERE merchant_id='merchant-softpos'").run();
  const first = await prepareSoftposRenewal(db, "merchant-softpos", new Date("2026-09-02T00:00:00+08:00"));
  db.sqlite.prepare("UPDATE merchant_service_cycles SET status='EXPIRED',service_period_start='2026-01-01',service_period_end='2026-08-31' WHERE id=?").run(first.id);
  db.sqlite.prepare("UPDATE merchant_service_subscriptions SET current_cycle_number=1,renewal_state='EXPIRED' WHERE merchant_id='merchant-softpos'").run();
  const second = await prepareSoftposRenewal(db, "merchant-softpos", new Date("2026-09-02T00:00:00+08:00"));
  assert.equal(second.cycle_number, 2); assert.equal(second.cycle_months, 24); assert.equal(second.cycle_fee_minor, 2400000); assert.equal(second.deposit_credit_minor, 0); assert.equal(second.balance_due_minor, 2400000); assert.equal(second.deposit_charge_minor, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_contract_signatures WHERE merchant_id='merchant-softpos'").get().count, 1);
});

test("SP11 UI includes the legal commercial labels and never claims zero hardware", () => {
  const page = readFileSync(new URL("../../src/pages/MerchantContractPages.tsx", import.meta.url), "utf8");
  for (const phrase of ["開通費","保證金","前三個月","正式方案","第一週期抵充後","後續週期","是否續用免 POS 機智慧點餐系統","不會產生假交易"]) assert.match(page, new RegExp(phrase));
  assert.doesNotMatch(page, />完全零硬體</);
});
