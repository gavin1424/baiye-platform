import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("ordering price conversion has one authoritative minor-unit boundary", async () => {
  const money = await readFile(new URL("src/ordering-money.ts", root), "utf8");
  const storefront = await readFile(new URL("src/pages/QrOrderingPage.tsx", root), "utf8");
  const admin = await readFile(new URL("src/pages/AdminQrOrderingPage.tsx", root), "utf8");

  assert.match(money, /Number\(minor \|\| 0\) \/ 100/);
  assert.match(money, /Math\.round\(amount \* 100\)/);
  assert.match(storefront, /formatOrderingMoney as money/);
  assert.match(admin, /formatOrderingMoney as money/);
  assert.match(admin, /orderingDollarsToMinor/);
  assert.doesNotMatch(storefront, /Number\(minor \|\| 0\) \/ 10/);
});

test("mobile ordering cards use full-width aspect-ratio images and a separated price footer", async () => {
  const css = await readFile(new URL("src/qr-ordering.css", root), "utf8");
  const storefront = await readFile(new URL("src/pages/QrOrderingPage.tsx", root), "utf8");

  assert.match(css, /\.ordering-menu-item > img\s*\{[\s\S]*?width:\s*100%;[\s\S]*?aspect-ratio:\s*16 \/ 9;/);
  assert.match(css, /\.ordering-menu-section\s*\{[\s\S]*?width:\s*min\(100% - 28px, 960px\);[\s\S]*?padding:\s*10px 0 24px;/);
  assert.match(css, /\.ordering-menu-footer\s*\{[\s\S]*?justify-content:\s*space-between;/);
  assert.match(storefront, /className="ordering-menu-price"/);
  assert.match(storefront, /className="ordering-menu-footer"/);
});
