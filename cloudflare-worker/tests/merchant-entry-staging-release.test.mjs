import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("unified join center exposes only the five public choices plus two logins", () => {
  const join = read("src/pages/JoinPages.tsx");
  for (const label of ["商家免費註冊", "承攬夥伴簽約", "選擇 NT$18,000 方案", "選擇 NT$45,000 商城", "申請免 POS 機方案"]) assert.match(join, new RegExp(label.replaceAll("$", "\\$")));
  for (const route of ["/partner/apply", "/merchant/register", "/partner/login", "/merchant/login"]) assert.match(join, new RegExp(route.replaceAll("/", "\\/")));
  assert.doesNotMatch(join, /to="\/merchant\/contract"|contract-18|contract-45|contract-pos/);
});

test("merchant register remains phone-only and has actionable network copy", () => {
  const access = read("src/pages/MerchantAccessPages.tsx");
  assert.match(access, /\/api\/merchant\/register/);
  assert.match(access, /phone, privacy_consent: consent/);
  assert.match(access, /目前無法連線至商家註冊服務，請稍後再試。/);
  assert.doesNotMatch(access, /type="password"|password_confirm|<label>Email/);
});

test("unauthenticated merchant contract offers login and register routes", () => {
  const contract = read("src/pages/MerchantContractPages.tsx");
  assert.match(contract, /請先登入商家帳號後進行簽約。/);
  assert.match(contract, /to="\/merchant\/login">\s*商家登入/);
  assert.match(contract, /to="\/merchant\/register">\s*尚未註冊/);
});

test("merchant contract reuses the reviewed staging v1.1 model", () => {
  const version = read("cloudflare-worker/src/merchant-contract-v11.js");
  assert.match(version, /merchant_service_v1_1_18000/);
  assert.match(version, /NT\$18,000/);
  assert.match(version, /24 個月/);
  assert.match(version, /標準網站建置費/);
  assert.match(version, /NT\$0/);
});

test("mobile bottom nav and coupon-disabled entry UI stay intact", () => {
  const home = read("src/pages/HomePage.tsx");
  const components = read("src/components.tsx");
  const partner = read("src/pages/PartnerPages.tsx");
  assert.match(home, /<MobileBottomNav \/>/);
  for (const label of ["首頁", "搜尋", "發布需求", "私訊", "我的"]) assert.match(components, new RegExp(`label: "${label}"`));
  for (const forbidden of ["迎新券", "優惠券", "折價券", "立即領取"]) assert.equal(partner.includes(forbidden), false);
});
