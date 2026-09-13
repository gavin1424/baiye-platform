import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { orderingRouteFromQrValue } from "../src/qr-scanner-validation.mjs";

const origin = "https://baiyeconnect.com";
const token = "y6KGFA0pQkEKLjf41zNBS6Nb1u1hCHUR";

test("scanner accepts only a valid Baiye or same-origin ordering route", () => {
  assert.equal(orderingRouteFromQrValue(`${origin}/#/q/${token}`, origin), `/q/${token}`);
  assert.equal(orderingRouteFromQrValue(`#/q/${token}`, origin), `/q/${token}`);
  assert.equal(orderingRouteFromQrValue(`${origin}/q/${token}`, origin), `/q/${token}`);
});

test("scanner rejects external, active-content, malformed and unknown QR values", () => {
  for (const value of [
    `https://example.com/#/q/${token}`,
    "javascript:alert(1)",
    "data:text/html,hello",
    `${origin}/#/merchant/login`,
    `${origin}/#/q/short`,
    `${origin}/#/q/contains.dot`,
  ]) assert.equal(orderingRouteFromQrValue(value, origin), "", value);
});

test("customer UI exposes guest ordering without a membership gate or camera UI", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const qr = readFileSync(new URL("../src/pages/QrOrderingPage.tsx", import.meta.url), "utf8");
  const entry = readFileSync(new URL("../src/pages/GeneralOrderingEntryPage.tsx", import.meta.url), "utf8");
  const storefront = readFileSync(new URL("../src/pages/BeefNoodleDemoPage.tsx", import.meta.url), "utf8");
  assert.match(app, /path="\/scan" element=\{<GeneralOrderingEntryPage \/>\}/);
  assert.match(app, /百工牛肉麵｜桌邊 QR 點餐/);
  assert.doesNotMatch(app, /掃碼加入會員與手機點餐/);
  for (const copy of ["百工牛肉麵", "手機點餐", "開始點餐", "不用下載 App"]) assert.match(entry, new RegExp(copy));
  assert.match(entry, /GENERAL_ORDERING_URL/);
  assert.match(entry, /baiye-beef-noodle-demo\.pages\.dev/);
  assert.doesNotMatch(entry, /BarcodeDetector|@zxing\/browser|getUserMedia|相機|Camera Preview|<video/);
  for (const copy of ["已進入線上點餐", "已掃描此桌 QR Code", "查看購物車"]) assert.match(qr, new RegExp(copy));
  for (const forbidden of ["加入會員後即可送出訂單", "新會員加入", "已有會員登入", "手機號碼", "8 位數字會員密碼", "會員登入並開始點餐", "加入會員並開始點餐", "加入會員後結帳"]) assert.doesNotMatch(qr, new RegExp(forbidden));
  for (const confirmation of ["訂單已成功送出", "訂購資訊", "餐點明細", "付款狀態", "待付款", "總計金額"]) assert.match(qr, new RegExp(confirmation));
  assert.doesNotMatch(qr, /您的訂單已付款成功|加入百工牛肉麵|加入後方便接收優惠與店家消息|>加入 LINE</);
  assert.doesNotMatch(qr, /\/member-session/);
  assert.match(qr, /lineFriendFlag === false/);
  assert.doesNotMatch(qr, /掃碼會員/);
  assert.match(storefront, /GENERAL_ORDERING_PATH/);
  assert.equal((storefront.match(/to=\{GENERAL_ORDERING_PATH\}/g) || []).length, 5);
  assert.doesNotMatch(storefront, /to="\/scan"/);
  assert.doesNotMatch(`${qr}\n${entry}`, /Provider 尚未啟用|手機或 LINE 身分驗證|Platform Member canonical identity/);
});

test("LIFF entry document cannot retain a stale ordering bundle", () => {
  const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  assert.match(headers, /\/liff-ordering\s+Cache-Control: no-store, no-cache, must-revalidate/);
  assert.match(headers, /\/index\.html\s+Cache-Control: no-store, no-cache, must-revalidate/);
});

test("changing or rejecting a QR clears the previous merchant and menu state", () => {
  const source = readFileSync(new URL("../src/pages/QrOrderingPage.tsx", import.meta.url), "utf8");
  assert.match(source, /<QrOrderingView key=\{code\} code=\{code\} \/>/);
  assert.match(source, /lastOrder\.order\.table_label === ctx\.qr\.table_label/);
  assert.match(source, /if \(belongsToCurrentQr\) setOrder\(lastOrder\.order\)/);
  const initialize = source.slice(source.indexOf("const initialize = useCallback"), source.indexOf("useEffect(() => {\n    void initialize()"));
  for (const reset of ["setContext(null)", "setToken(\"\")", "setItems([])", "setCart({})"]) assert.match(initialize, new RegExp(reset.replace(/[()[\]{}]/g, "\\$&")));
});
