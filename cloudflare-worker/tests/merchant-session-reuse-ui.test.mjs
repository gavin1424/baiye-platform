import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("ordering and kitchen pages authorize through the protected overview resource", () => {
  const ordering = read("../../src/pages/MerchantOrderingPage.tsx");
  const kitchen = read("../../src/pages/MerchantKitchenDisplayPage.tsx");
  for (const source of [ordering, kitchen]) {
    assert.doesNotMatch(source, /\/api\/merchant-auth\/session/);
    assert.match(source, /\/api\/merchant-admin\/ordering\/overview/);
    assert.match(source, /merchantProtectedResourceState/);
  }
});

test("protected resource errors distinguish auth, permission, activation, rate limit and availability", () => {
  const client = read("../../src/qr-ordering-client.ts");
  for (const expected of ["unauthenticated", "permission_denied", "activation_required", "rate_limited", "unavailable"]) assert.match(client, new RegExp(expected));
  for (const status of [401, 403, 423, 429]) assert.match(client, new RegExp(`status === ${status}`));
  assert.match(client, /credentials:\s*"include"/);
  assert.match(client, /VITE_PLATFORM_API_URL/);
});

test("kitchen status cards use WCAG AA dark text while the live board keeps its dark theme", () => {
  const css = read("../../src/qr-ordering.css");
  assert.match(css, /\.ordering-kds-page \.ordering-center-card\s*\{[^}]*background:\s*#fff;[^}]*color:\s*var\(--ordering-ink\)/s);
  assert.match(css, /\.ordering-kds-page \.ordering-center-card h1\s*\{\s*color:\s*#172335/);
  assert.match(css, /\.ordering-kds-page \.ordering-center-card p\s*\{\s*color:\s*#657185/);
  const luminance = (hex) => {
    const values = hex.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  };
  const contrast = (foreground, background = "ffffff") => (luminance(background) + 0.05) / (luminance(foreground) + 0.05);
  assert.ok(contrast("172335") >= 4.5);
  assert.ok(contrast("657185") >= 4.5);
});

test("GET merchant authorization remains CSRF-free while mutations stay protected", () => {
  const auth = read("../src/merchant-auth.js");
  assert.doesNotMatch(auth, /getSession\(/);
  assert.match(auth, /authenticateMerchantSession\(request, env\)/);
  assert.match(auth, /!\["GET",\s*"HEAD",\s*"OPTIONS"\]\.includes\(request\.method\)/);
});
