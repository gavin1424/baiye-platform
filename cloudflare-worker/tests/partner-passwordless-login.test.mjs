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
    for (const file of readdirSync(new URL("../migrations", import.meta.url)).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) this.sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  }
  prepare(sql) { return new Statement(this.sqlite.prepare(sql)); }
  async batch(statements) { const results = []; for (const statement of statements) results.push(await statement.run()); return results; }
}
const cors = { "access-control-allow-origin": "https://staging.example" };
const stagingEnv = (db) => ({ FINANCE_DB: db, PUBLIC_SITE_URL: "https://staging.example", CONTRACT_SIGNING_MODE: "staging", PARTNER_OTP_MODE: "staging" });
const productionEnv = (db) => ({ FINANCE_DB: db, PUBLIC_SITE_URL: "https://baiyeconnect.com", PARTNER_OTP_MODE: "disabled" });
function req(path, data, headers = {}) { return new Request(`https://worker.test${path}`, { method: "POST", headers: { "content-type": "application/json", "CF-Connecting-IP": "203.0.113.20", "x-device-id": "test-device", ...headers }, body: JSON.stringify(data) }); }
async function call(db, path, data, headers = {}, env = stagingEnv(db)) { const request = req(path, data, headers); const response = await handlePartnerRequest(request, env, new URL(request.url), cors); return { response, data: await response.json() }; }
async function applied(db, suffix = "01") {
  return call(db, "/api/partner/apply", { legal_name: `免密夥伴${suffix}`, display_name: `免密${suffix}`, email: `passwordless-${suffix}@example.test`, phone: `09128888${suffix}`, consent: true });
}
async function activated(db) {
  const application = await applied(db);
  const token = decodeURIComponent(new URL(application.data.activation_url).hash.split("token=")[1]);
  const activation = await call(db, "/api/partner/accept-invite", { token });
  return { application, activation, cookie: activation.response.headers.get("set-cookie")?.split(";")[0] || "" };
}
async function challenge(db, phone = "0912888801", env = stagingEnv(db)) { return call(db, "/api/partner/login/start", { phone }, {}, env); }

test("P01 Login UI 只有手機且無 Email/Password", () => { const source = readFileSync(new URL("../../src/pages/PartnerPages.tsx", import.meta.url), "utf8"); const login = source.split("export function PartnerLogin()")[1].split("export function PartnerDashboard()")[0]; assert.match(login, /手機號碼/); assert.doesNotMatch(login, /type=\"email\"|type=\"password\"|忘記密碼/); });
test("P02 台灣手機格式正規化登入", async () => { const db = new D1(); await activated(db); const a = await challenge(db, "+886912888801"); assert.equal(a.data.code, "VERIFICATION_REQUIRED"); });
test("P03 無效手機被拒絕", async () => { const db = new D1(); const result = await challenge(db, "0212345678"); assert.equal(result.data.code, "INVALID_PHONE"); });
test("P04 Activation 不要求密碼", async () => { const db = new D1(); const result = await activated(db); assert.equal(result.activation.response.status, 200); assert.equal(db.sqlite.prepare("SELECT password_hash FROM partners").get().password_hash, null); });
test("P05 Activation 建立 active Partner", async () => { const db = new D1(); await activated(db); assert.equal(db.sqlite.prepare("SELECT status FROM partners").get().status, "active"); });
test("P06 Activation Invite single-use", async () => { const db = new D1(); const app = await applied(db); const token = decodeURIComponent(new URL(app.data.activation_url).hash.split("token=")[1]); await call(db, "/api/partner/accept-invite", { token }); const replay = await call(db, "/api/partner/accept-invite", { token }); assert.equal(replay.response.status, 401); });
test("P07 Activation Session assurance", async () => { const db = new D1(); await activated(db); assert.equal(db.sqlite.prepare("SELECT assurance_level FROM partner_sessions").get().assurance_level, "activation_invite"); });
test("P08 Partner Session 只存 token hash", async () => { const db = new D1(); const result = await activated(db); const raw = result.cookie.split("=")[1]; const stored = db.sqlite.prepare("SELECT token_hash FROM partner_sessions").get().token_hash; assert.notEqual(raw, stored); assert.ok(stored.length >= 40); });
test("P09 Cookie 安全屬性完整", async () => { const db = new D1(); const result = await activated(db); const cookie = result.activation.response.headers.get("set-cookie"); assert.match(cookie, /HttpOnly/i); assert.match(cookie, /Secure/i); assert.match(cookie, /SameSite=None/i); });
test("P10 同裝置有效 Session 直接恢復", async () => { const db = new D1(); const result = await activated(db); const login = await call(db, "/api/partner/login/start", { phone: "0912888801" }, { cookie: result.cookie }); assert.equal(login.data.code, "SESSION_RESTORED"); });
test("P11 新裝置只輸入手機不能登入", async () => { const db = new D1(); await activated(db); const login = await challenge(db); assert.equal(login.response.status, 202); assert.equal(login.data.code, "VERIFICATION_REQUIRED"); assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM partner_sessions").get().n, 1); });
test("P12 Staging OTP 明確提供測試碼", async () => { const db = new D1(); await activated(db); const login = await challenge(db); assert.match(login.data.staging_code, /^\d{6}$/); assert.equal(login.data.verification_method, "staging_otp"); });
test("P13 Production 無 Provider 不提供固定 OTP", async () => { const db = new D1(); await activated(db); const login = await challenge(db, "0912888801", productionEnv(db)); assert.equal(login.data.verification_available, false); assert.equal(login.data.staging_code, undefined); });
test("P14 正確 OTP 建立 verified_phone Session", async () => { const db = new D1(); await activated(db); const start = await challenge(db); const verify = await call(db, "/api/partner/login/verify", { challenge_id: start.data.challenge_id, code: start.data.staging_code }); assert.equal(verify.response.status, 200); assert.equal(db.sqlite.prepare("SELECT assurance_level FROM partner_sessions WHERE login_challenge_id=?").get(start.data.challenge_id).assurance_level, "verified_phone"); });
test("P15 錯誤 OTP 被拒絕", async () => { const db = new D1(); await activated(db); const start = await challenge(db); const verify = await call(db, "/api/partner/login/verify", { challenge_id: start.data.challenge_id, code: "000000" }); assert.equal(verify.data.code, "INVALID_OTP"); });
test("P16 OTP 過期被拒絕", async () => { const db = new D1(); await activated(db); const start = await challenge(db); db.sqlite.prepare("UPDATE partner_login_challenges SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(start.data.challenge_id); const verify = await call(db, "/api/partner/login/verify", { challenge_id: start.data.challenge_id, code: start.data.staging_code }); assert.equal(verify.data.code, "OTP_EXPIRED"); });
test("P17 OTP 不可 replay", async () => { const db = new D1(); await activated(db); const start = await challenge(db); await call(db, "/api/partner/login/verify", { challenge_id: start.data.challenge_id, code: start.data.staging_code }); const replay = await call(db, "/api/partner/login/verify", { challenge_id: start.data.challenge_id, code: start.data.staging_code }); assert.equal(replay.data.code, "OTP_EXPIRED"); assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM partner_sessions WHERE login_challenge_id=?").get(start.data.challenge_id).n, 1); });
test("P18 未知手機不取得 Session", async () => { const db = new D1(); const start = await challenge(db, "0999999999"); assert.equal(start.data.code, "VERIFICATION_REQUIRED"); const verify = await call(db, "/api/partner/login/verify", { challenge_id: start.data.challenge_id, code: start.data.staging_code }); assert.equal(verify.data.code, "PARTNER_VERIFICATION_UNAVAILABLE"); assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM partner_sessions").get().n, 0); });
test("P19 Suspended 無法登入", async () => { const db = new D1(); const result = await activated(db); db.sqlite.prepare("UPDATE partners SET status='suspended' WHERE id=?").run(result.application.data.id); const login = await challenge(db); assert.equal(login.data.code, "PARTNER_SUSPENDED"); });
test("P20 Terminated 無法登入", async () => { const db = new D1(); const result = await activated(db); db.sqlite.prepare("UPDATE partners SET status='terminated' WHERE id=?").run(result.application.data.id); const login = await challenge(db); assert.equal(login.data.code, "PARTNER_TERMINATED"); });
test("P21 Partner 與平台會員建立唯一連結", async () => { const db = new D1(); const result = await applied(db); const link = db.sqlite.prepare("SELECT partner_id,member_id FROM partner_platform_member_links").get(); assert.equal(link.partner_id, result.data.id); assert.ok(link.member_id); });
test("P22 Platform Member Session 不可提升 Partner 權限", async () => { const db = new D1(); await activated(db); const start = await call(db, "/api/partner/login/start", { phone: "0912888801" }, { cookie: "partner_session=not-a-partner-session" }); assert.equal(start.data.code, "VERIFICATION_REQUIRED"); });
test("P23 舊密碼登入 Endpoint 已 deprecated", async () => { const db = new D1(); const result = await call(db, "/api/partner/login", { email: "x@example.test", password: "secret" }); assert.equal(result.response.status, 410); assert.equal(result.data.code, "PARTNER_PASSWORD_LOGIN_DEPRECATED"); });
test("P24 未簽契約登入導向 Contract", async () => { const db = new D1(); const result = await activated(db); assert.equal(result.activation.data.next_url, "/partner/contract"); });
test("P25 Logout 撤銷 Session", async () => { const db = new D1(); const result = await activated(db); const logout = await call(db, "/api/partner/logout", {}, { cookie: result.cookie }); assert.equal(logout.response.status, 200); assert.ok(db.sqlite.prepare("SELECT revoked_at FROM partner_sessions").get().revoked_at); });
test("P26 Audit 不保存完整手機與 OTP", async () => { const db = new D1(); await activated(db); const start = await challenge(db); const logs = db.sqlite.prepare("SELECT metadata FROM audit_logs").all().map((row) => String(row.metadata || "")).join(" "); assert.doesNotMatch(logs, /0912888801/); assert.doesNotMatch(logs, new RegExp(start.data.staging_code)); });
test("P27 Partner Login rate limit", async () => { const db = new D1(); await activated(db); let result; for (let i = 0; i < 10; i += 1) result = await challenge(db); assert.equal(result.data.code, "RATE_LIMITED"); });
test("P28 password_hash/password_salt 欄位保留相容", () => { const db = new D1(); const columns = db.sqlite.prepare("PRAGMA table_info(partners)").all().map((row) => row.name); assert.ok(columns.includes("password_hash")); assert.ok(columns.includes("password_salt")); });
test("P29 新申請回傳免密啟用入口", async () => { const db = new D1(); const result = await applied(db); assert.match(result.data.activation_url, /partner\/activate/); assert.equal("password" in result.data, false); });
test("P30 Legal Review Gate 保持 pending", async () => { const db = new D1(); const result = await applied(db); assert.equal(result.data.contract.legal_review_status, "pending_review"); assert.equal(result.data.contract.signing_available, false); });
test("P31 Link 不可改寫或刪除", async () => { const db = new D1(); await applied(db); assert.throws(() => db.sqlite.prepare("DELETE FROM partner_platform_member_links").run(), /IMMUTABLE/); });
test("P32 驗證碼 D1 只保存 Hash", async () => { const db = new D1(); await activated(db); const start = await challenge(db); const stored = db.sqlite.prepare("SELECT code_hash FROM partner_login_challenges WHERE id=?").get(start.data.challenge_id).code_hash; assert.notEqual(stored, start.data.staging_code); assert.ok(stored.length >= 40); });
