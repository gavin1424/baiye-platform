import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/pages/QrOrderingPage.tsx", import.meta.url);

test("QR menu keeps cents conversion and separates unit price from quantity", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /\.format\(Number\(minor \|\| 0\) \/ 100\)/);
  assert.match(source, /className="ordering-menu-price"/);
  assert.match(source, /<span>單價<\/span>/);
  assert.match(source, /context\.currency === "TWD" \? "NT" : ""/);
  assert.match(source, /const soldOut = menuItemSoldOut\(item\)/);
  assert.match(source, /function menuItemSoldOut\(item: OrderingMenuItem\)/);
  assert.doesNotMatch(source, /const soldOut =[^;]*inventory_enabled\s*&&/);

  const menuCopy = source.match(
    /<div className="ordering-menu-copy">([\s\S]*?)<\/div>\s*<div\s*className="ordering-quantity"/,
  );
  assert.ok(menuCopy, "menu copy and quantity controls should be distinct siblings");
  assert.doesNotMatch(menuCopy[1], /\{quantity\}/);
});
