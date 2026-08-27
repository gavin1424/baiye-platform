import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { authorizeMerchant, configuredMerchantPasswordIterations, deriveMerchantPassword, handleMerchantAuth } from "../src/merchant-auth.js";
import { permissionForRequest } from "../src/merchant-permissions.js";

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  first() { return this.db.prepare(this.sql).get(...this.values) || null; }
  all() { return { results: this.db.prepare(this.sql).all(...this.values) }; }
  run() { const result = this.db.prepare(this.sql).run(...this.values); return { success: true, meta: { changes: Number(result.changes) } }; }
}
class D1 {
  constructor(db) { this.db = db; }
  prepare(sql) { return new Statement(this.db, sql); }
  batch(statements) { this.db.exec("BEGIN IMMEDIATE"); try { const result = statements.map((statement) => statement.run()); this.db.exec("COMMIT"); return result; } catch (error) { this.db.exec("ROLLBACK"); throw error; } }
}
function setup() {
  const sqlite = new DatabaseSync(":memory:"); sqlite.exec("PRAGMA foreign_keys=ON");
  const root = path.resolve("cloudflare-worker/migrations");
  for (const file of fs.readdirSync(root).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) sqlite.exec(fs.readFileSync(path.join(root, file), "utf8"));
  sqlite.exec(`INSERT INTO merchants(id,merchant_code,name,status) VALUES('auth_merchant','AUTHMERCHANT','Auth Merchant','active');
    INSERT INTO merchant_roles(id,merchant_id,code,name,is_system) VALUES('role_readonly','auth_merchant','read_only','Read Only',1);
    INSERT INTO merchant_permissions(code,module,description) VALUES('site.read','site','Read site'),('site.write','site','Write site');
    INSERT INTO merchant_role_permissions(role_id,permission_code) VALUES('role_readonly','site.read');`);
  return { sqlite, db: new D1(sqlite), env: { FINANCE_DB: new D1(sqlite), APP_MODE: "staging" } };
}
const authRequest = (pathName, method = "GET", body, extra = {}) => new Request(`https://worker.test${pathName}`, { method, headers: { "content-type": "application/json", origin: "https://staging.test", "cf-connecting-ip": "203.0.113.10", "user-agent": "Gate0-Test", ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
async function authCall(env, pathName, method, body, extra) { const request = authRequest(pathName, method, body, extra); return handleMerchantAuth(request, env, new URL(request.url), {}); }

test("legacy 100k login upgrades to the 600k segmented production work factor", async () => {
  const { sqlite, env } = setup(); const salt = "legacy-salt"; const password = "Correct Horse Battery Staple 64 characters supported";
  const legacy = await deriveMerchantPassword(password, salt, 100000, "pbkdf2-sha256");
  sqlite.prepare("INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,password_iterations,password_algorithm,status,display_name) VALUES('legacy_user','auth_merchant','legacy@example.test',?,?,100000,'pbkdf2-sha256','active','Legacy')").run(legacy, salt);
  sqlite.prepare("INSERT INTO merchant_user_roles(merchant_id,user_id,role_id) VALUES('auth_merchant','legacy_user','role_readonly')").run();
  const response = await authCall(env, "/api/merchant-auth/login", "POST", { merchant_id: "auth_merchant", email: "legacy@example.test", password });
  assert.equal(response.status, 200);
  const upgraded = sqlite.prepare("SELECT password_iterations,password_algorithm FROM merchant_users WHERE id='legacy_user'").get();
  assert.equal(upgraded.password_iterations, 600000);
  assert.equal(upgraded.password_algorithm, "pbkdf2-sha256-segmented-v1");
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM merchant_security_events WHERE action='password_hash_upgraded'").get().n, 1);
});

test("test iterations are isolated and forbidden in production", () => {
  assert.equal(configuredMerchantPasswordIterations({ APP_MODE: "test", AUTH_TEST_ITERATIONS: "2000" }), 2000);
  assert.equal(configuredMerchantPasswordIterations({ APP_MODE: "staging", AUTH_TEST_ITERATIONS: "2000" }), 600000);
  assert.throws(() => configuredMerchantPasswordIterations({ APP_MODE: "production", AUTH_TEST_ITERATIONS: "2000" }), /FORBIDDEN/);
});

test("a different IP can still authenticate after one source exhausts its account bucket", async () => {
  const { sqlite, env } = setup(); const password = "A secure merchant passphrase"; const salt = "rate-salt";
  const hash = await deriveMerchantPassword(password, salt, 2000, "pbkdf2-sha256");
  sqlite.prepare("INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,password_iterations,password_algorithm,status,display_name) VALUES('rate_user','auth_merchant','rate@example.test',?,?,2000,'pbkdf2-sha256','active','Rate')").run(hash, salt);
  env.APP_MODE = "test"; env.AUTH_TEST_ITERATIONS = "2000";
  for (let count = 0; count < 5; count += 1) assert.equal((await authCall(env, "/api/merchant-auth/login", "POST", { merchant_id: "auth_merchant", email: "rate@example.test", password: "wrong-password" })).status, 401);
  const blocked = await authCall(env, "/api/merchant-auth/login", "POST", { merchant_id: "auth_merchant", email: "rate@example.test", password }); assert.equal(blocked.status, 429);
  const allowed = await authCall(env, "/api/merchant-auth/login", "POST", { merchant_id: "auth_merchant", email: "rate@example.test", password }, { "cf-connecting-ip": "203.0.113.11" }); assert.equal(allowed.status, 200);
});

test("read-only session is allowed to read and denied mutation by backend permission", async () => {
  const { sqlite, env } = setup(); const password = "Read only secure passphrase"; const salt = "read-salt";
  const hash = await deriveMerchantPassword(password, salt, 2000, "pbkdf2-sha256");
  sqlite.prepare("INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,password_iterations,password_algorithm,status,display_name) VALUES('read_user','auth_merchant','read@example.test',?,?,2000,'pbkdf2-sha256','active','Read')").run(hash, salt);
  sqlite.prepare("INSERT INTO merchant_user_roles(merchant_id,user_id,role_id) VALUES('auth_merchant','read_user','role_readonly')").run();
  env.APP_MODE = "test"; env.AUTH_TEST_ITERATIONS = "2000";
  const login = await authCall(env, "/api/merchant-auth/login", "POST", { merchant_id: "auth_merchant", email: "read@example.test", password });
  const cookie = login.headers.get("set-cookie").split(";")[0]; const loginBody = await login.json();
  const readRequest = authRequest("/api/commerce/pages", "GET", undefined, { cookie });
  const writeRequest = authRequest("/api/commerce/pages", "POST", {}, { cookie, "x-csrf-token": loginBody.csrf_token });
  assert.equal((await authorizeMerchant(readRequest, env, permissionForRequest("/api/commerce/pages", "GET"))).status, 200);
  assert.equal((await authorizeMerchant(writeRequest, env, permissionForRequest("/api/commerce/pages", "POST"))).status, 403);
});

test("password reset is single-use, rejects blocklisted values and revokes sessions", async () => {
  const { sqlite, env } = setup(); const password = "Initial secure passphrase"; const salt = "reset-salt";
  const hash = await deriveMerchantPassword(password, salt, 2000, "pbkdf2-sha256");
  sqlite.prepare("INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,password_iterations,password_algorithm,status,display_name) VALUES('reset_user','auth_merchant','reset@example.test',?,?,2000,'pbkdf2-sha256','active','Reset')").run(hash, salt);
  env.APP_MODE = "test"; env.AUTH_TEST_ITERATIONS = "2000";
  const login = await authCall(env, "/api/merchant-auth/login", "POST", { merchant_id: "auth_merchant", email: "reset@example.test", password }); assert.equal(login.status, 200);
  const issued = await authCall(env, "/api/merchant-auth/request-password-reset", "POST", { merchant_id: "auth_merchant", email: "reset@example.test" }); const token = (await issued.json()).reset_token; assert.ok(token);
  const blocked = await authCall(env, "/api/merchant-auth/reset-password", "POST", { token, new_password: "password123" }); assert.equal(blocked.status, 400);
  const completed = await authCall(env, "/api/merchant-auth/reset-password", "POST", { token, new_password: "Replacement secure passphrase" }); assert.equal(completed.status, 200);
  const replay = await authCall(env, "/api/merchant-auth/reset-password", "POST", { token, new_password: "Another secure passphrase" }); assert.equal(replay.status, 400);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM merchant_user_sessions WHERE user_id='reset_user' AND revoked_at IS NULL").get().n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM merchant_security_events WHERE user_id='reset_user' AND action='password_reset_completed'").get().n, 1);
});
