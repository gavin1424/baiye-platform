import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sections = await readFile(new URL("../src/ordering-sections.ts", import.meta.url), "utf8");
const merchantAdmin = await readFile(new URL("../src/pages/MerchantAdminPages.tsx", import.meta.url), "utf8");
const orderingAdmin = await readFile(new URL("../src/pages/AdminQrOrderingPage.tsx", import.meta.url), "utf8");
const storefront = await readFile(new URL("../src/pages/QrOrderingPage.tsx", import.meta.url), "utf8");
const publicNavigation = [merchantAdmin, orderingAdmin, storefront].join("\n");

test("ordering sections have one canonical query-to-element mapping", () => {
  const expected = {
    overview: "ordering-overview",
    orders: "ordering-orders",
    qrs: "ordering-qrs",
    menu: "ordering-menu",
    options: "ordering-options",
    members: "ordering-members",
    settings: "ordering-settings",
    invoice: "ordering-invoice",
  };
  for (const [query, id] of Object.entries(expected)) {
    assert.match(sections, new RegExp(`${query}: "${id}"`));
  }
  assert.match(sections, /`\/merchant-admin\/ordering\?section=\$\{section\}`/);
});

test("HashRouter navigation never uses a second ordering hash", () => {
  assert.doesNotMatch(publicNavigation, /merchant-admin\/ordering#ordering-/);
  assert.doesNotMatch(publicNavigation, /href=(?:\{|\")?[^\n]*#ordering-/);
  assert.match(storefront, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
});

test("dashboard, bottom navigation and tabs use query parameters", () => {
  assert.ok((merchantAdmin.match(/orderingSectionPath\("menu"\)/g) || []).length >= 3);
  assert.ok((merchantAdmin.match(/orderingSectionPath\("orders"\)/g) || []).length >= 3);
  assert.match(orderingAdmin, /useSearchParams\(\)/);
  assert.match(orderingAdmin, /setSearchParams\(\{ section \}\)/);
  assert.match(orderingAdmin, /ORDERING_SECTION_TABS\.map/);
  assert.match(orderingAdmin, /id="ordering-members"/);
});
