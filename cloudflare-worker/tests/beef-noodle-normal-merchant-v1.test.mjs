import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("homepage has no beef noodle trial promotion", () => {
  const home = read("src/pages/HomePage.tsx");
  const features = read("src/pages/FeaturesPage.tsx");
  for (const copy of ["立即試用完整商家系統", "百工牛肉麵試用", "完整功能試用店"]) {
    assert.doesNotMatch(`${home}\n${features}`, new RegExp(copy));
  }
});

test("normal merchant login is the only maintained login UI", () => {
  const app = read("src/App.tsx");
  const page = read("src/pages/MerchantLoginPage.tsx");
  const components = read("src/components.tsx");
  assert.match(app, /path="\/merchant\/login" element=\{<MerchantLoginPage \/>\}/);
  assert.match(app, /path="\/demo\/beef-noodle\/login" element=\{<Navigate to="\/merchant\/login" replace \/>\}/);
  assert.match(page, /\/api\/merchant-auth\/phone-login/);
  assert.match(page, /JSON\.stringify\(\{ phone, verification_code: verificationCode \}\)/);
  assert.doesNotMatch(page, /merchant_id|簡訊已寄出|帳號密碼/);
  assert.match(components, /to="\/merchant\/login"[\s\S]{0,100}商家登入/);
});

test("phone auth stays server-scoped and auto-resolves the sole merchant", () => {
  const login = read("cloudflare-worker/src/demo-merchant.js");
  const worker = read("cloudflare-worker/src/index.js");
  assert.match(login, /"\/api\/merchant-auth\/phone-login"/);
  assert.match(login, /phone === "0900000026"/);
  assert.match(login, /WHERE c\.merchant_id='demo_beef_noodle'/);
  assert.match(login, /merchant_resolution: \{ automatic: true, count: 1, requires_selection: false \}/);
  assert.match(login, /platform_member_sessions/);
  assert.match(login, /merchant_owner_links/);
  assert.match(worker, /handleMerchantAuth\(request, env, url, cors\)\)[\s\S]{0,100}handleProductionDemoLogin\(request, env, url, cors\)/);
});

test("merchant dashboard presents normal merchant language and 出餐看板", () => {
  const dashboard = read("src/pages/MerchantAdminPages.tsx");
  const kds = read("src/pages/MerchantKitchenDisplayPage.tsx");
  for (const label of ["商品／菜單", "庫存管理", "訂單管理", "出餐看板", "預約管理", "會員管理", "Google 地圖預約", "LINE 官方帳號", "商家設定", "帳戶", "商家狀態", "正常"]) assert.match(dashboard, new RegExp(label));
  for (const forbidden of ["百工官方示範", "試用商家", "開始試用", "廚房 KDS", "KDS 廚房看板", "重置試用資料"]) assert.doesNotMatch(`${dashboard}\n${kds}`, new RegExp(forbidden));
  assert.match(kds, /<h1>出餐看板<\/h1>/);
  assert.match(dashboard, />恢復初始資料<\/button>/);
  assert.doesNotMatch(`${read("src/pages/HomePage.tsx")}\n${read("src/pages/PosComparisonPage.tsx")}`, /KDS|Kitchen Display System/);
});

test("release adds no D1 migration and preserves internal safety flags", () => {
  const migrations = readdirSync(new URL("../migrations/", import.meta.url)).filter((name) => /^\d+.*\.sql$/.test(name));
  assert.equal(migrations.at(-1), "0023_beef_noodle_production_golden_options_v1.sql");
  const login = read("cloudflare-worker/src/demo-merchant.js");
  const admin = read("cloudflare-worker/src/merchant-admin.js");
  assert.match(login, /official_demo/);
  assert.match(login, /demo_contract_exemption/);
  assert.match(admin, /demo_environment/);
});
