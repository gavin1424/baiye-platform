import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { assignMerchantPlan, listMerchantPlans } from "../src/merchant-plan-catalog.js";
import {
  handleMerchantContractPayments,
  handleMerchantContractPaymentsAdmin,
  paymentRequiredForMerchant,
  prepareSignaturePayment,
  validatePaymentAuthority,
} from "../src/merchant-contract-payments.js";

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
  async batch(items) { const results = []; for (const item of items) results.push(await item.run()); return results; }
}
class Bucket {
  constructor() { this.items = new Map(); }
  async put(key, value, options = {}) { this.items.set(key, { value, options }); }
  async get(key) {
    const item = this.items.get(key);
    return item ? { body: item.value, httpMetadata: item.options.httpMetadata } : null;
  }
  async delete(key) { this.items.delete(key); }
}

const plans = [
  ["baiye_standard_18000_addons", 1800000, 0, 0],
  ["baiye_commerce_ai_50000", 5000000, 0, 0],
  ["baiye_softpos_24000", 600000, 1800000, 3],
];

async function seedPayment(db, planId, suffix = planId) {
  const merchantId = `merchant-${suffix}`;
  const userId = `owner-${suffix}`;
  db.sqlite.prepare("INSERT INTO merchants(id,merchant_code,name,phone,status) VALUES(?,?,?,'0911222333','registration_started')").run(merchantId, `M-${suffix}`, `測試商家 ${suffix}`);
  db.sqlite.prepare("INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,status,display_name,phone_normalized,auth_mode) VALUES(?,?,?,'DISABLED','','active','管理者','0911222333','passwordless_phone')").run(userId, merchantId, `${userId}@test.invalid`);
  db.sqlite.prepare("INSERT INTO merchant_onboarding_states(merchant_id,registration_mode,state,operation_locked,commercial_terms_approval_required) VALUES(?,'standard_self_service','registered',1,0)").run(merchantId);
  const assignment = await assignMerchantPlan(db, merchantId, userId, planId, 24);
  const terms = db.sqlite.prepare("SELECT * FROM merchant_contract_commercial_terms WHERE id=?").get(assignment.commercial_terms_id);
  const invite = db.sqlite.prepare("SELECT id FROM merchant_contract_invites WHERE merchant_id=? AND commercial_terms_id=?").get(merchantId, assignment.commercial_terms_id);
  const signatureId = `signature-${suffix}`;
  const signedAt = "2026-09-11T04:00:00.000Z";
  db.sqlite.prepare(`INSERT INTO merchant_contract_signatures(
    id,public_id,merchant_id,merchant_user_id,contract_version_id,commercial_terms_id,
    signatory_legal_name,signatory_role,legal_representative_name,company_name,signed_at,
    contract_content_hash,commercial_terms_hash,signature_hash,signature_data,document_hash,
    pdf_hash,consent_version,invite_id,session_id_hash,r2_key,evidence_object_key,status,lifecycle_status
  ) VALUES(?,?,?,?,?,?,'葉耀仁','legal_representative','葉耀仁','陳靈有限公司',?,'content','terms','signature','{}','document','pdf','consent',?,'session','signed.pdf','signed.json','VALID','SIGNED_PENDING_PAYMENT')`)
    .run(signatureId, `BYMC-${suffix}`, merchantId, userId, assignment.plan.contract_version, assignment.commercial_terms_id, signedAt, invite.id);
  db.sqlite.prepare("INSERT INTO merchant_contract_lifecycle_states(contract_signature_id,merchant_id,lifecycle_status) VALUES(?,?,'SIGNED_PENDING_PAYMENT')").run(signatureId, merchantId);
  const prepared = await prepareSignaturePayment(db, { merchantId, signatureId, contractVersion: assignment.plan.contract_version, planId, terms, signedAt });
  await db.batch(prepared.statements);
  return { merchantId, userId, signatureId, assignment, terms, prepared };
}

test("PAY-V1 catalog has exactly 18k, new 50k, and SoftPOS; historical 45k is not selectable", async () => {
  const db = new D1();
  const current = await listMerchantPlans(db);
  assert.deepEqual(current.map((item) => item.plan_id), plans.map(([id]) => id));
  assert.equal(db.sqlite.prepare("SELECT is_public+is_selectable total FROM merchant_plan_catalog WHERE plan_id='baiye_commerce_ai_45000'").get().total, 0);
  assert.ok(db.sqlite.prepare("SELECT id FROM merchant_contract_versions WHERE id='merchant_commerce_ai_v1_0_45000'").get());
});

test("PAY-V1 legal activation preserves every currently selectable plan contract", () => {
  const source = readFileSync(new URL("../src/merchant-contracts.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /UPDATE merchant_contract_versions SET is_active=0 WHERE is_active=1["'`]/);
  assert.match(source, /id NOT IN \(\s*SELECT contract_version_id FROM merchant_plan_catalog WHERE is_selectable=1\s*\)/);
});

test("PAY-V1 signed completion renders only the contract download action", () => {
  const source = readFileSync(new URL("../../src/pages/MerchantContractPages.tsx", import.meta.url), "utf8");
  const completion = source.match(/if \(context\.signed\)([\s\S]+?)const consentLabels/)?.[1] || "";
  assert.match(completion, />\s*合約下載\s*</);
  assert.match(completion, /契約編號/);
  assert.match(completion, /簽署方案/);
  assert.match(completion, /簽署時間/);
  for (const removed of ["查看正式契約", "繼續完成方案申請", "前往付款", "返回商家中心"]) assert.doesNotMatch(completion, new RegExp(removed));
  assert.equal((completion.match(/<button/g) || []).length, 1);
  assert.equal((completion.match(/<Link/g) || []).length, 0);
});

test("PAY-V1 explicit schedule authority is 18000, 50000, and SoftPOS 6000 + 18000", async () => {
  for (const [planId, signatureDue, remaining, trial] of plans) {
    const db = new D1();
    const seeded = await seedPayment(db, planId);
    const authority = validatePaymentAuthority(seeded.terms);
    assert.deepEqual([authority.signatureDue, authority.remaining, authority.trialMonths], [signatureDue, remaining, trial]);
    const request = db.sqlite.prepare("SELECT amount_due_minor,payment_method,provider FROM merchant_contract_payment_requests WHERE contract_signature_id=?").get(seeded.signatureId);
    assert.equal(request.amount_due_minor, signatureDue);
    assert.equal(request.payment_method, null);
    assert.equal(request.provider, null);
    const schedules = db.sqlite.prepare("SELECT phase,amount_due_minor FROM merchant_contract_payment_schedules WHERE contract_signature_id=? ORDER BY sequence_number").all(seeded.signatureId);
    assert.deepEqual(schedules.map((row) => [row.phase, row.amount_due_minor]), remaining ? [["SIGNATURE", signatureDue], ["AFTER_TRIAL", remaining]] : [["SIGNATURE", signatureDue]]);
  }
});

test("PAY-V1 payment flow has no QR, barcode, deep-link, or provider gate", async () => {
  const db = new D1(); const seeded = await seedPayment(db, "baiye_standard_18000_addons", "no-qr");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM sqlite_master WHERE type='table' AND name='platform_payment_configurations'").get().count, 0);
  const env = { FINANCE_DB: db, CONTRACTS_BUCKET: new Bucket() };
  const authorization = { session: { merchant_id: seeded.merchantId, user_id: seeded.userId } };
  const get = new Request(`https://worker.test/api/merchant/contract-payments/${seeded.prepared.request.id}`);
  const response = await handleMerchantContractPayments(get, env, new URL(get.url), {}, authorization);
  const payment = (await response.json()).payment;
  for (const removedField of ["qr_available", "qr_asset_key", "payment_deep_link", "payment_method_name", "recipient_display_name"]) assert.equal(removedField in payment, false);
  const qr = new Request(`https://worker.test/api/merchant/contract-payments/${seeded.prepared.request.id}/qr`);
  assert.equal(await handleMerchantContractPayments(qr, env, new URL(qr.url), {}, authorization), null);
});

test("PAY-V1 submit and admin confirm are idempotent and activate only after confirmation", async () => {
  const db = new D1(); const bucket = new Bucket(); const seeded = await seedPayment(db, "baiye_softpos_24000", "softpos-flow");
  const env = { FINANCE_DB: db, CONTRACTS_BUCKET: bucket };
  const authorization = { session: { merchant_id: seeded.merchantId, user_id: seeded.userId } };
  assert.equal((await paymentRequiredForMerchant(db, seeded.merchantId)).code, "MERCHANT_PAYMENT_REQUIRED");
  const submitRequest = new Request(`https://worker.test/api/merchant/contract-payments/${seeded.prepared.request.id}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payment_at: "2026-09-11T12:00", transaction_reference: "PAYMENT-TEST" }) });
  const submitted = await handleMerchantContractPayments(submitRequest, env, new URL(submitRequest.url), {}, authorization);
  assert.equal((await submitted.json()).payment.status, "submitted");
  assert.notEqual(db.sqlite.prepare("SELECT status FROM merchants WHERE id=?").get(seeded.merchantId).status, "active");
  const confirmRequest = new Request(`https://worker.test/api/admin/merchant-payments/${seeded.prepared.request.id}/confirm`, { method: "POST" });
  const confirmed = await handleMerchantContractPaymentsAdmin(confirmRequest, env, new URL(confirmRequest.url), {}, { admin_user_id: "admin-1" });
  const confirmedData = await confirmed.json();
  assert.equal(confirmedData.payment.status, "confirmed");
  assert.equal(db.sqlite.prepare("SELECT lifecycle_status FROM merchant_contract_lifecycle_states WHERE contract_signature_id=?").get(seeded.signatureId).lifecycle_status, "EFFECTIVE");
  assert.equal(db.sqlite.prepare("SELECT status FROM merchants WHERE id=?").get(seeded.merchantId).status, "active");
  assert.equal((await handleMerchantContractPaymentsAdmin(confirmRequest, env, new URL(confirmRequest.url), {}, { admin_user_id: "admin-1" })).status, 200);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_contract_activation_evidence WHERE contract_signature_id=?").get(seeded.signatureId).count, 1);
  assert.equal(db.sqlite.prepare("SELECT amount_due_minor FROM merchant_contract_payment_schedules WHERE contract_signature_id=? AND phase='AFTER_TRIAL'").get(seeded.signatureId).amount_due_minor, 1800000);
  assert.equal(await paymentRequiredForMerchant(db, seeded.merchantId), null);
});

test("PAY-V1 cross-merchant access and amount tampering are blocked", async () => {
  const db = new D1(); const bucket = new Bucket(); const seeded = await seedPayment(db, "baiye_standard_18000_addons", "security");
  const env = { FINANCE_DB: db, CONTRACTS_BUCKET: bucket };
  const get = new Request(`https://worker.test/api/merchant/contract-payments/${seeded.prepared.request.id}`);
  await assert.rejects(() => handleMerchantContractPayments(get, env, new URL(get.url), {}, { session: { merchant_id: "merchant-other", user_id: "other" } }), (error) => error.code === "PAYMENT_FORBIDDEN" && error.status === 403);
  db.sqlite.prepare("UPDATE merchant_contract_payment_requests SET status='submitted',amount_due_minor=100 WHERE id=?").run(seeded.prepared.request.id);
  const confirm = new Request(`https://worker.test/api/admin/merchant-payments/${seeded.prepared.request.id}/confirm`, { method: "POST" });
  await assert.rejects(() => handleMerchantContractPaymentsAdmin(confirm, env, new URL(confirm.url), {}, { admin_user_id: "admin-1" }), (error) => error.code === "PAYMENT_AMOUNT_MISMATCH");
  assert.equal(db.sqlite.prepare("SELECT lifecycle_status FROM merchant_contract_lifecycle_states WHERE contract_signature_id=?").get(seeded.signatureId).lifecycle_status, "SIGNED_PENDING_PAYMENT");
});

test("PAY-V1 expired and rejected requests never activate the contract", async () => {
  const db = new D1(); const bucket = new Bucket(); const seeded = await seedPayment(db, "baiye_standard_18000_addons", "expiry");
  const env = { FINANCE_DB: db, CONTRACTS_BUCKET: bucket };
  const authorization = { session: { merchant_id: seeded.merchantId, user_id: seeded.userId } };
  db.sqlite.prepare("UPDATE merchant_contract_payment_requests SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(seeded.prepared.request.id);
  const submit = new Request(`https://worker.test/api/merchant/contract-payments/${seeded.prepared.request.id}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  await assert.rejects(() => handleMerchantContractPayments(submit, env, new URL(submit.url), {}, authorization), (error) => error.code === "PAYMENT_NOT_SUBMITTABLE");
  assert.equal(db.sqlite.prepare("SELECT status FROM merchant_contract_payment_requests WHERE id=?").get(seeded.prepared.request.id).status, "expired");
  assert.equal(db.sqlite.prepare("SELECT lifecycle_status FROM merchant_contract_lifecycle_states WHERE contract_signature_id=?").get(seeded.signatureId).lifecycle_status, "SIGNED_PENDING_PAYMENT");
});
