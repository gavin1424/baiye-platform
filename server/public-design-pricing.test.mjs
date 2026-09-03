import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const page = readFileSync(new URL("../src/pages/CommercialV13Pages.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const components = readFileSync(new URL("../src/components.tsx", import.meta.url), "utf8");

test("pricing renders three server-provided merchant plans and no free plan card", () => {
  assert.match(page, /fetchCommercialCatalog/);
  assert.match(page, /plans\.map/);
  assert.doesNotMatch(page, /<h2>免費會員<\/h2>/);
  assert.doesNotMatch(page, /方案原價 NT\$30,000<br/);
});

test("merchant registration continues to the server-backed plan selector", () => {
  const app = read("src/App.tsx");
  const register = read("src/pages/MerchantLoginPage.tsx");
  assert.match(app, /path="\/merchant\/select-plan"/);
  assert.match(register, /navigate\(`\/merchant\/select-plan/);
});

test("public navigation is shared and routes to current merchant entry", () => {
  for (const label of ["平台功能", "商家方案", "商家加入", "承攬夥伴", "聯絡我們"]) assert.match(components, new RegExp(label));
  assert.match(components, /\/merchant\/login/);
  assert.match(components, /\/merchant\/register/);
});

test("all five motion layers and reduced motion are present", () => {
  for (const token of ["hero-enter", "baiye-reveal", "premium-card", "public-route-transition", "baiye-ambient"]) assert.match(styles, new RegExp(token));
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /transform/);
  assert.match(styles, /opacity/);
});

test("mobile comparison avoids an overflowing desktop table", () => {
  assert.match(page, /pricing-comparison-mobile/);
  assert.match(styles, /pricing-comparison-desktop\{display:none\}/);
  assert.match(styles, /pricing-mobile-selector/);
});
