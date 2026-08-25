import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { deriveAdminPassword, handleAdminAuth, requireAdmin } from "../src/admin-auth.js";

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
    this.sqlite.exec(readFileSync(new URL("../migrations/0001_finance_core.sql", import.meta.url), "utf8"));
    this.sqlite.exec(readFileSync(new URL("../migrations/0002_partner_portal.sql", import.meta.url), "utf8"));
    this.sqlite.exec(readFileSync(new URL("../migrations/0009_production_admin_auth.sql", import.meta.url), "utf8"));
  }
  prepare(sql) { return new Statement(this.sqlite.prepare(sql)); }
  async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); }
}
const cors = { "access-control-allow-origin": "https://baiyeconnect.com", "access-control-allow-credentials": "true" };

test("正式管理員使用雜湊密碼、HttpOnly session 與 CSRF 保護", async () => {
  const db = new D1();
  const salt = "MDEyMzQ1Njc4OWFiY2RlZg";
  const hash = await deriveAdminPassword("A-secure-admin-password-2026", salt);
  db.sqlite.prepare("INSERT INTO admin_users (id,email,display_name,password_hash,password_salt,role) VALUES (?,?,?,?,?,'super_admin')").run("admin-1", "owner@example.com", "平台管理員", hash, salt);
  const env = { FINANCE_DB: db };
  const bad = new Request("https://worker.test/api/admin/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "owner@example.com", password: "wrong" }) });
  assert.equal((await handleAdminAuth(bad, env, new URL(bad.url), cors)).status, 401);
  const login = new Request("https://worker.test/api/admin/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "owner@example.com", password: "A-secure-admin-password-2026" }) });
  const response = await handleAdminAuth(login, env, new URL(login.url), cors);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=None/);
  const body = await response.json();
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const unsafe = new Request("https://worker.test/api/admin/value", { method: "PATCH", headers: { cookie } });
  assert.equal(await requireAdmin(unsafe, env), null);
  const safe = new Request("https://worker.test/api/admin/value", { method: "PATCH", headers: { cookie, "x-csrf-token": body.csrf_token } });
  assert.equal((await requireAdmin(safe, env)).email, "owner@example.com");
});
