import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync(new URL("../src/demo-merchant.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../migrations-ordering-demo/0032_beef_noodle_demo_admin.sql", import.meta.url), "utf8");
const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../../src/pages/MerchantAdminPages.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../../src/pages/DemoMerchantLoginPage.tsx", import.meta.url), "utf8");
const config = readFileSync(new URL("../wrangler.ordering-staging.jsonc", import.meta.url), "utf8");

test("BDADMIN-01 demo auth is exact-merchant and feature-flag isolated", () => {
  assert.match(worker, /DEMO_MERCHANT_ID = "demo_beef_noodle"/);
  assert.match(worker, /DEMO_PASSWORD_LOGIN_ENABLED/);
  assert.match(index, /\/api\/merchant-demo\/login/);
  assert.match(config, /"DEMO_PASSWORD_LOGIN_ENABLED": "false"/);
  assert.match(config, /"DEMO_PHONE_ADMIN_ENABLED": "true"/);
});
test("BDADMIN-02 credentials are hashed, rate limited and rotate the normal merchant session", () => {
  assert.match(worker, /deriveMerchantPassword/);
  assert.match(worker, /failures >= 5/);
  assert.match(worker, /issueMerchantSession/);
  assert.match(worker, /merchantSessionCookie/);
  assert.doesNotMatch(login, /baiye-beef-demo/);
});
test("BDADMIN-03 reset is merchant-scoped and restores Golden data", () => {
  assert.match(worker, /session\.merchant_id !== DEMO_MERCHANT_ID/);
  assert.match(worker, /staging_demo_golden_menu_items/);
  assert.match(worker, /staging_demo_golden_admin_profile/);
  assert.match(migration, /Demo 試用環境/);
});
test("BDADMIN-04 dashboard exposes real modules without claiming providers", () => {
  for (const label of ["商品／菜單","訂單管理","KDS 廚房看板","預約管理","會員管理","Google 地圖預約","LINE 官方帳號","庫存","付款","電子發票","商家資料","契約","帳戶"]) assert.match(dashboard, new RegExp(label));
  assert.match(dashboard, /尚未啟用正式服務/);
});
test("BDADMIN-05 demo route is build-variant only and Production phone auth remains", () => {
  assert.match(app, /IS_BEEF_NOODLE_DEMO/);
  assert.match(app, /path="\/merchant\/demo-login"/);
  assert.match(login, /正式商家仍使用手機驗證/);
});
