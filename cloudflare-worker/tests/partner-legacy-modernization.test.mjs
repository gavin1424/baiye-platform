import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { handlePartnerRequest } from "../src/partner.js";

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
    const files = readdirSync(new URL("../migrations", import.meta.url)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
    for (const file of files) this.sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  }
  prepare(sql) { return new Statement(this.sqlite.prepare(sql)); }
  async batch(statements) { const results = []; for (const statement of statements) results.push(await statement.run()); return results; }
}

const cors = { "access-control-allow-origin": "https://staging.example" };
const env = (db) => ({ FINANCE_DB: db, PUBLIC_SITE_URL: "https://staging.example", PARTNER_OTP_MODE: "staging", CONTRACT_SIGNING_MODE: "staging", PARTNER_ID_FIELD_ENCRYPTION_KEY: "test-encryption-key-at-least-32-bytes", PARTNER_ID_HASH_SECRET: "test-hmac-secret-at-least-32-bytes" });
function request(path, data) {
  return new Request(`https://worker.test${path}`, { method: "POST", headers: { "content-type": "application/json", "CF-Connecting-IP": "198.51.100.18" }, body: JSON.stringify(data) });
}
async function call(db, path, data) {
  const req = request(path, data);
  const response = await handlePartnerRequest(req, env(db), new URL(req.url), cors);
  return { response, data: await response.json() };
}
function insertLegacy(db, overrides = {}) {
  const row = { id: "legacy_partner", partner_code: "AGLEGACY", legal_name: "歷史夥伴", display_name: "歷史夥伴", email: "legacy@example.test", phone: "+886912345678", status: "applicant", referral_code: "AGLEGACY", ...overrides };
  db.sqlite.prepare("INSERT INTO partners(id,partner_code,legal_name,display_name,email,phone,status,referral_code,approved_at) VALUES(?,?,?,?,?,?,?,?,?)")
    .run(row.id, row.partner_code, row.legal_name, row.display_name, row.email, row.phone, row.status, row.referral_code, row.approved_at || null);
  return row;
}

test("L01 Legacy Apply 自動核准且不建立第二筆 Partner", async () => {
  const db = new D1(); const legacy = insertLegacy(db);
  const result = await call(db, "/api/partner/apply", { legal_name: legacy.legal_name, id_number: "A123456789", email: legacy.email, phone: "0912-345-678", consent: true });
  assert.equal(result.response.status, 200); assert.equal(result.data.code, "PARTNER_LEGACY_MODERNIZED");
  const row = db.sqlite.prepare("SELECT status,approved_at,phone FROM partners WHERE id=?").get(legacy.id);
  assert.deepEqual([row.status, Boolean(row.approved_at), row.phone], ["pending_contract", true, "0912345678"]);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM partners").get().n, 1);
});

test("L02 手機 Status 自動 Modernize 並提供啟用入口", async () => {
  const db = new D1(); insertLegacy(db);
  const result = await call(db, "/api/partner/status", { phone: "886912345678" });
  assert.equal(result.response.status, 200); assert.equal(result.data.state, "pending_activation"); assert.match(result.data.activation_url, /partner\/activate\?token=/);
  assert.match(result.data.message, /資料已更新/);
});

test("L03 Login Start 自動 Modernize 並回安全啟用入口", async () => {
  const db = new D1(); insertLegacy(db);
  const result = await call(db, "/api/partner/login/start", { phone: "0912345678" });
  assert.equal(result.response.status, 202); assert.equal(result.data.code, "PARTNER_LEGACY_MODERNIZED"); assert.ok(result.data.activation_url);
});

test("L04 重複入口仍維持一 Partner、一 Member 且不發 Coupon", async () => {
  const db = new D1(); insertLegacy(db);
  await call(db, "/api/partner/status", { phone: "0912345678" });
  await call(db, "/api/partner/login/start", { phone: "0912345678" });
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM partners").get().n, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM platform_members").get().n, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM platform_member_coupons").get().n, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM partner_invites WHERE used_at IS NULL").get().n, 1);
});

test("L05 Modernize 寫入身份、會員連結及必要 Audit", async () => {
  const db = new D1(); insertLegacy(db);
  await call(db, "/api/partner/status", { phone: "0912345678" });
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM partner_application_identities").get().n, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM partner_platform_member_links").get().n, 1);
  const actions = db.sqlite.prepare("SELECT action FROM audit_logs WHERE actor_id='partner_legacy_modernizer'").all().map((row) => row.action);
  assert.ok(actions.includes("partner.legacy_auto_migrated")); assert.ok(actions.includes("partner.auto_approved")); assert.ok(actions.includes("partner.activation_invite_created"));
});

test("L06 Active Legacy 不重建 Partner 且進手機驗證", async () => {
  const db = new D1(); insertLegacy(db, { status: "active", approved_at: new Date().toISOString() });
  const result = await call(db, "/api/partner/login/start", { phone: "0912345678" });
  assert.equal(result.response.status, 202); assert.equal(result.data.code, "VERIFICATION_REQUIRED");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM partner_invites").get().n, 0);
});

test("L07 Suspended Legacy 不會被自動核准", async () => {
  const db = new D1(); insertLegacy(db, { status: "suspended" });
  const result = await call(db, "/api/partner/status", { phone: "0912345678" });
  assert.equal(result.data.state, "suspended"); assert.equal(db.sqlite.prepare("SELECT approved_at FROM partners").get().approved_at, null);
});

test("L08 缺合法手機才回遷移補手機錯誤", async () => {
  const db = new D1(); const legacy = insertLegacy(db, { phone: "invalid" });
  const result = await call(db, "/api/partner/status", { email: legacy.email });
  assert.equal(result.response.status, 422); assert.equal(result.data.code, "PARTNER_PHONE_REQUIRED_FOR_MIGRATION");
});

test("L09 Status UI 只顯示手機查詢且舊阻塞文案為零", () => {
  const source = readFileSync(new URL("../../src/pages/PartnerPages.tsx", import.meta.url), "utf8");
  const status = source.split("function PartnerStatusLookup()")[1].split("export function PartnerLanding()")[0];
  assert.match(status, /手機號碼/); assert.match(status, /JSON\.stringify\(\{ phone \}\)/); assert.doesNotMatch(status, /type=\u0022email\u0022|Email/);
  assert.doesNotMatch(source, /平台需完成一次性資料轉換後才能提供啟用方式/);
});

test("L10 Legal Review Gate 維持 pending_review", () => {
  const db = new D1(); const row = db.sqlite.prepare("SELECT legal_review_status,is_active FROM contract_versions WHERE id='contractor_partner_v1_4'").get();
  assert.deepEqual([row.legal_review_status, row.is_active], ["pending_review", 0]);
});
