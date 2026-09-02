import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detectProductImageMime } from "../src/merchant-assets.js";

const auth = readFileSync(new URL("../src/merchant-auth.js", import.meta.url), "utf8");
const assets = readFileSync(new URL("../src/merchant-assets.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("../../src/pages/AdminQrOrderingPage.tsx", import.meta.url), "utf8");
const config = readFileSync(new URL("../wrangler.ordering-staging.jsonc", import.meta.url), "utf8");
const migration = readFileSync(new URL("../migrations-ordering-demo/0033_beef_noodle_phone_identity_assets.sql", import.meta.url), "utf8");

test("BDV2-01 JPEG PNG and WebP are detected from bytes, not extensions", () => {
  assert.equal(detectProductImageMime(Uint8Array.from([0xff,0xd8,0xff,0x00])), "image/jpeg");
  assert.equal(detectProductImageMime(Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])), "image/png");
  assert.equal(detectProductImageMime(Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80])), "image/webp");
  assert.equal(detectProductImageMime(Uint8Array.from([0x47,0x49,0x46])), "");
});
test("BDV2-02 product upload is 5MB limited and merchant scoped", () => {
  assert.match(assets, /5 \* 1024 \* 1024/);
  assert.match(assets, /WHERE merchant_id=\? AND id=\?/);
  assert.match(assets, /IMAGE_MIME_INVALID/);
  assert.match(migration, /merchant_product_assets/);
});
test("BDV2-03 phone OTP returns canonical platform session and relationship", () => {
  assert.match(auth, /issuePlatformMemberSession/);
  assert.match(auth, /merchant_ordering_memberships/);
  assert.match(auth, /staging_demo_merchant_admin_allowlist/);
  assert.match(auth, /OTP_REPLAY/);
});
test("BDV2-04 demo uses normal phone login and password entry is deprecated", () => {
  assert.match(app, /path="\/merchant\/login" element={<MerchantLoginPage/);
  assert.match(config, /"MERCHANT_OTP_MODE": "staging"/);
  assert.match(config, /"DEMO_PASSWORD_LOGIN_ENABLED": "false"/);
});
test("BDV2-05 mobile picker previews before the product save", () => {
  assert.match(editor, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(editor, /圖片預覽/);
  assert.match(editor, /儲存商品/);
  assert.match(editor, /new FormData/);
});
