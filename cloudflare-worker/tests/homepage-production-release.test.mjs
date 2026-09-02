import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("production homepage exposes all eight interactive features", () => {
  const source = read("src/pages/HomePage.tsx");
  for (const label of ["官網建置", "AI智能客服", "LINE官方帳號", "會員回購", "預約管理", "免POS機點餐", "Google地圖預約", "承攬 / 商家簽約"]) {
    assert.match(source, new RegExp(label.replace("/", "\\/")));
  }
  assert.match(source, /setSelected\(feature\)/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /heroScene/);
});

test("immersive homepage restores the historical five-item mobile navigation", () => {
  const home = read("src/pages/HomePage.tsx");
  const components = read("src/components.tsx");
  const styles = read("src/styles.css");
  for (const item of [
    ['首頁', '/'],
    ['搜尋', '/businesses'],
    ['發布需求', '/collaborations/new'],
    ['私訊', '/messages'],
  ]) {
    assert.match(components, new RegExp(`label: "${item[0]}"[\\s\\S]{0,50}to: "${item[1].replaceAll('/', '\\/')}"`));
  }
  assert.match(components, /label: "我的"/);
  assert.match(components, /className=\{\(\{ isActive \}\)/);
  assert.match(home, /<MobileBottomNav \/>/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /body\.home-detail-open \.mobile-bottom-nav/);
  assert.doesNotMatch(styles, /body:has\(\.immersive-home\) \.ai-chat\{display:none\}/);
});

test("public membership and contract UI no longer presents coupons", () => {
  const publicUi = [
    "src/pages/HomePage.tsx",
    "src/pages/PlatformMemberPages.tsx",
    "src/pages/QrOrderingPage.tsx",
    "src/pages/PartnerPages.tsx",
    "src/pages/MerchantContractPages.tsx",
    "src/pages/FeaturesPage.tsx",
    "src/pages/GrowthIntegrationPages.tsx",
  ].map(read).join("\n");
  for (const forbidden of ["NT$100", "查看我的優惠券", "查看會員與優惠券", "立即領取", "迎新禮券"]) {
    assert.equal(publicUi.includes(forbidden), false, `unexpected public coupon copy: ${forbidden}`);
  }
});

test("coupon creation defaults off across every membership path", () => {
  const platform = read("cloudflare-worker/src/platform-membership.js");
  const integrations = read("cloudflare-worker/src/member-integrations.js");
  const qr = read("cloudflare-worker/src/qr-ordering.js");
  const config = JSON.parse(read("cloudflare-worker/wrangler.jsonc"));
  assert.match(platform, /couponIssuanceEnabled = false/);
  assert.match(platform, /couponIssuanceEnabled \? await claimWelcomeCoupon/);
  assert.match(integrations, /issuanceEnabled=false/);
  assert.match(integrations, /COUPON_FEATURE_DISABLED/);
  assert.match(qr, /issuanceEnabled: false/);
  assert.match(qr, /clean\(input\?\.coupon_id, 120\).*COUPON_FEATURE_DISABLED/);
  assert.equal(config.vars.MEMBERSHIP_COUPON_ISSUANCE_ENABLED, "0");
});

test("production gates and bindings remain production-safe", () => {
  const config = JSON.parse(read("cloudflare-worker/wrangler.jsonc"));
  assert.equal(config.name, "chuang-baiye-ai");
  assert.equal(config.d1_databases[0].database_name, "baiye-finance");
  assert.equal(config.r2_buckets[0].bucket_name, "baiye-contracts");
  assert.equal(config.vars.PARTNER_OTP_MODE, "disabled");
  assert.equal("CONTRACT_SIGNING_MODE" in config.vars, false);
});
