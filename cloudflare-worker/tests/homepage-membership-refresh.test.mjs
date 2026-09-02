import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../../src/pages/HomePage.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");
const memberPages = readFileSync(new URL("../../src/pages/PlatformMemberPages.tsx", import.meta.url), "utf8");
const qrPages = readFileSync(new URL("../../src/pages/QrOrderingPage.tsx", import.meta.url), "utf8");
const membership = readFileSync(new URL("../src/platform-membership.js", import.meta.url), "utf8");
const integration = readFileSync(new URL("../src/member-integrations.js", import.meta.url), "utf8");
const staging = readFileSync(new URL("../wrangler.contract-staging.jsonc", import.meta.url), "utf8");

test("HOME01 headline and multi-industry positioning are exact", () => {
  assert.match(home, /全業態數位升級，/);
  assert.match(home, /一站完成/);
  assert.match(home, /餐飲 × 美業 × 零售，多產業整合的智慧經營平台/);
  assert.match(home, /baiye-multi-industry-isometric-hero\.png/);
});

test("HOME02 all eight interactive features are present", () => {
  for (const name of ["官網建置", "AI智能客服", "LINE官方帳號", "會員回購", "預約管理", "免POS機點餐", "Google地圖預約", "承攬 \/ 商家簽約"]) assert.match(home, new RegExp(name));
  assert.match(home, /aria-haspopup="dialog"/);
  assert.match(home, /role="dialog"/);
});

test("HOME03 feature details include audience value list and CTA", () => {
  for (const label of ["適用對象", "核心價值", "主要功能"]) assert.match(home, new RegExp(label));
  assert.match(home, /selected\.cta/);
});

test("HOME04 responsive detail becomes full-screen on mobile", () => {
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /\.home-feature-detail\{align-items:stretch;padding:0\}/);
  assert.match(styles, /\.home-feature-panel\{width:100%;max-height:100vh;border-radius:0/);
});

test("MEMREF01 member and QR customer UI expose no coupon entry", () => {
  for (const source of [memberPages, qrPages]) {
    assert.doesNotMatch(source, /我的優惠券|會員禮券|迎新禮券|加入即領迎新券/);
  }
});

test("MEMREF02 platform issuance is opt-in and disabled by default", () => {
  assert.match(membership, /couponIssuanceEnabled = false/);
  assert.match(membership, /coupons: \[\], disabled: true/);
  assert.match(membership, /COUPON_FEATURE_DISABLED/);
});

test("MEMREF03 merchant welcome issuance is disabled by default", () => {
  assert.match(integration, /issuanceEnabled=false/);
  assert.match(integration, /if\(!issuanceEnabled\|\|!newlyCreated\)return null/);
});

test("MEMREF04 Contract Staging explicitly disables issuance", () => {
  assert.match(staging, /"MEMBERSHIP_COUPON_ISSUANCE_ENABLED": "0"/);
});
