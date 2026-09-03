import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { handleMerchantAuth, handleMerchantCredentialAdmin, validateMerchantNumericPassword } from "../src/merchant-auth.js";

const migrations = ["0001_finance_core.sql","0002_partner_portal.sql","0003_partner_completion.sql","0004_contract_v1_hash.sql","0005_partner_activation_approval.sql","0006_contractor_v13_policy.sql","0007_merchant_ai_quota.sql","0008_merchant_booking_engine.sql","0009_production_admin_auth.sql","0010_merchant_settlements.sql","0011_qr_membership_ordering.sql","0012_member_benefits_integrations.sql","0013_growth_completion.sql","0013_qr_ordering_commercial_v1.sql","0014_merchant_contracts.sql","0015_phone_only_platform_membership.sql","0016_partner_auto_approval.sql","0017_partner_passwordless_login.sql","0018_beef_noodle_production_trial_v1.sql","0019_beef_noodle_production_trial_seed_v1.sql","0020_beef_noodle_production_options_qr_v1.sql","0021_beef_noodle_production_booking_golden_v1.sql","0022_beef_noodle_production_golden_menu_v1.sql","0023_beef_noodle_production_golden_options_v1.sql","0024_merchant_numeric_password_auth_v1.sql"];
class Statement { constructor(statement) { this.statement = statement; this.values = []; } bind(...values) { this.values = values; return this; } async run() { const result = this.statement.run(...this.values); return { meta: { changes: Number(result.changes || 0) } }; } async first() { return this.statement.get(...this.values) || null; } async all() { return { results: this.statement.all(...this.values) }; } }
class D1 { constructor() { this.sqlite = new DatabaseSync(":memory:"); this.sqlite.exec("PRAGMA foreign_keys=ON"); for (const migration of migrations) this.sqlite.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), "utf8")); this.seed(); } prepare(sql) { return new Statement(this.sqlite.prepare(sql)); } async batch(statements) { this.sqlite.exec("BEGIN IMMEDIATE"); try { for (const statement of statements) await statement.run(); this.sqlite.exec("COMMIT"); } catch (error) { this.sqlite.exec("ROLLBACK"); throw error; } } seed() { this.sqlite.exec(`
    INSERT INTO ordering_customers(id,display_name,phone_normalized,phone_display,phone_verified) VALUES('owner_customer','管理者','0900000026','0900000026',0);
    INSERT INTO platform_members(id,customer_id,member_no,status,joined_source,phone_verified,membership_origin_verified) VALUES('owner_member','owner_customer','BYM-OWNER','active','admin',0,0);
    INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,status,display_name,phone_normalized,platform_member_id,auth_mode) VALUES('owner_user','demo_beef_noodle','owner@example.test','CREDENTIAL_TABLE','CREDENTIAL_TABLE','active','百工牛肉麵管理者','0900000026','owner_member','password');
    INSERT INTO merchant_user_roles(merchant_id,user_id,role_id) VALUES('demo_beef_noodle','owner_user','demo_beef_owner_role');
    INSERT INTO merchant_owner_links(merchant_id,merchant_user_id,platform_member_id,phone_normalized) VALUES('demo_beef_noodle','owner_user','owner_member','0900000026');
  `); } }
const request = (path, body, headers = {}) => new Request(`https://worker.test${path}`, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.9", ...headers }, body: JSON.stringify(body) });
const call = async (db, path, body) => { const req = request(path, body); const response = await handleMerchantAuth(req, { FINANCE_DB: db }, new URL(req.url), {}); return { response, data: await response.json() }; };

test("8-digit policy accepts strong value and rejects invalid/weak/phone-tail values", () => {
  assert.equal(validateMerchantNumericPassword("48270615", "0900000026").ok, true);
  for (const value of ["1234567", "123456789", "abcd1234", "12345678", "00000000", "00000026", "12121212"]) assert.equal(validateMerchantNumericPassword(value, "0900000026").ok, false, value);
});

test("admin setup token stores only a hash, then phone/password login reuses owner identity", async () => {
  const db = new D1(), adminRequest = request("/api/admin/merchant-credentials/demo_beef_noodle/setup", {});
  const generated = await handleMerchantCredentialAdmin(adminRequest, { FINANCE_DB: db }, new URL(adminRequest.url), {}, { admin_user_id: "admin" });
  const setup = await generated.json(), stored = db.sqlite.prepare("SELECT token_hash FROM merchant_password_setup_tokens").get();
  assert.notEqual(stored.token_hash, setup.setup_token);
  const completed = await call(db, "/api/merchant-auth/password/setup", { token: setup.setup_token, password: "48270615", password_confirm: "48270615" });
  assert.equal(completed.response.status, 200);
  const credential = db.sqlite.prepare("SELECT * FROM merchant_login_credentials").get();
  assert.notEqual(credential.password_hash, "48270615"); assert.equal(credential.password_algorithm, "pbkdf2-sha256-segmented-v1");
  const login = await call(db, "/api/merchant-auth/login", { phone: "0900000026", password: "48270615" });
  assert.equal(login.response.status, 200); assert.equal(login.data.platform_member_id, "owner_member"); assert.equal(login.data.merchant.id, "demo_beef_noodle");
  assert.match(login.response.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=None/);
  assert.equal(db.sqlite.prepare("SELECT credential_assurance FROM merchant_user_sessions ORDER BY created_at DESC LIMIT 1").get().credential_assurance, "password_authenticated");
});

test("generic errors, five-failure lockout, locked correct rejection and expiry", async () => {
  const db = new D1(), adminRequest = request("/api/admin/merchant-credentials/demo_beef_noodle/setup", {}), generated = await handleMerchantCredentialAdmin(adminRequest, { FINANCE_DB: db }, new URL(adminRequest.url), {}, { admin_user_id: "admin" }), setup = await generated.json();
  await call(db, "/api/merchant-auth/password/setup", { token: setup.setup_token, password: "48270615", password_confirm: "48270615" });
  const missing = await call(db, "/api/merchant-auth/login", { phone: "0999999999", password: "48270615" });
  const wrong = await call(db, "/api/merchant-auth/login", { phone: "0900000026", password: "48270616" });
  assert.equal(missing.data.error, "手機號碼或密碼錯誤。"); assert.equal(wrong.data.error, missing.data.error);
  for (let index = 1; index < 5; index += 1) await call(db, "/api/merchant-auth/login", { phone: "0900000026", password: "48270616" });
  const locked = await call(db, "/api/merchant-auth/login", { phone: "0900000026", password: "48270615" }); assert.equal(locked.response.status, 429);
  db.sqlite.prepare("UPDATE merchant_login_credentials SET locked_until='2000-01-01T00:00:00.000Z'").run();
  const recovered = await call(db, "/api/merchant-auth/login", { phone: "0900000026", password: "48270615" }); assert.equal(recovered.response.status, 200);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM platform_members").get().count, 1);
});

test("ordinary member without owner link cannot enter merchant login", async () => {
  const db = new D1(); db.sqlite.exec("INSERT INTO ordering_customers(id,display_name,phone_normalized,phone_display) VALUES('ordinary_customer','會員','0911222333','0911222333'); INSERT INTO platform_members(id,customer_id,member_no,status,joined_source) VALUES('ordinary_member','ordinary_customer','BYM-ORDINARY','active','phone');");
  const result = await call(db, "/api/merchant-auth/login", { phone: "0911222333", password: "48270615" }); assert.equal(result.response.status, 401); assert.equal(result.data.error, "手機號碼或密碼錯誤。");
});

test("merchant registration reuses canonical member without claiming phone verification", async () => {
  const db = new D1();
  const result = await call(db, "/api/merchant-auth/register", { phone: "0911555777", password: "48270615", password_confirm: "48270615", privacy_consent: true, terms_consent: true });
  assert.equal(result.response.status, 201); assert.equal(result.data.phone_verified, false);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized='0911555777'").get().count, 1);
  assert.equal(db.sqlite.prepare("SELECT phone_verified FROM ordering_customers WHERE phone_normalized='0911555777'").get().phone_verified, 0);
  const application = db.sqlite.prepare("SELECT password_hash,password_salt,status FROM merchant_registration_applications WHERE phone_normalized='0911555777'").get();
  assert.notEqual(application.password_hash, "48270615"); assert.equal(application.status, "PENDING_IDENTITY_REVIEW");
  const replay = await call(db, "/api/merchant-auth/register", { phone: "0911555777", password: "48270615", password_confirm: "48270615", privacy_consent: true, terms_consent: true });
  assert.equal(replay.response.status, 202); assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized='0911555777'").get().count, 1);
});

test("merchant login frontend contains no OTP or SMS dependency", () => {
  const page = readFileSync(new URL("../../src/pages/MerchantLoginPage.tsx", import.meta.url), "utf8");
  assert.match(page, /\/api\/merchant-auth\/login/); assert.match(page, /8 位數字密碼/); assert.doesNotMatch(page, /OTP|取得驗證碼|輸入驗證碼|簡訊驗證|驗證碼已寄出|重新傳送驗證碼|phone-login|verification_code/);
});
