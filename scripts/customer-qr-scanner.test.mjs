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

test("customer UI exposes a general order entry, join and login without camera UI", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const qr = readFileSync(new URL("../src/pages/QrOrderingPage.tsx", import.meta.url), "utf8");
  const entry = readFileSync(new URL("../src/pages/GeneralOrderingEntryPage.tsx", import.meta.url), "utf8");
  const storefront = readFileSync(new URL("../src/pages/BeefNoodleDemoPage.tsx", import.meta.url), "utf8");
  assert.match(app, /path="\/scan" element=\{<GeneralOrderingEntryPage \/>\}/);
  for (const copy of ["百工牛肉麵", "手機點餐", "開始點餐", "不用下載 App"]) assert.match(entry, new RegExp(copy));
  assert.match(entry, /\/q\/\$\{GENERAL_ORDERING_CODE\}/);
  assert.doesNotMatch(entry, /BarcodeDetector|@zxing\/browser|getUserMedia|相機|Camera Preview|<video/);
  for (const copy of ["新會員加入", "已有會員登入", "會員登入並開始點餐", "已進入線上點餐", "已掃描此桌 QR Code"]) assert.match(qr, new RegExp(copy));
  assert.doesNotMatch(storefront, /to=\{`\/q\/\$\{A1_CODE\}`\}/);
  assert.ok((storefront.match(/to="\/scan"/g) || []).length >= 4);
  assert.doesNotMatch(`${qr}\n${entry}`, /Provider 尚未啟用|手機或 LINE 身分驗證|Platform Member canonical identity/);
});

test("changing or rejecting a QR clears the previous merchant and menu state", () => {
  const source = readFileSync(new URL("../src/pages/QrOrderingPage.tsx", import.meta.url), "utf8");
  assert.match(source, /<QrOrderingView key=\{code\} code=\{code\} \/>/);
  const initialize = source.slice(source.indexOf("const initialize = useCallback"), source.indexOf("useEffect(() => {\n    void initialize()"));
  for (const reset of ["setContext(null)", "setMember(null)", "setToken(\"\")", "setItems([])", "setCart({})"]) assert.match(initialize, new RegExp(reset.replace(/[()[\]{}]/g, "\\$&")));
});
