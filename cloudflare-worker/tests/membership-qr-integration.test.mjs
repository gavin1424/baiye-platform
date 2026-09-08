import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const platformMigration = read("../migrations/0015_phone_only_platform_membership.sql");
const orderingMigration = read("../migrations/0011_qr_membership_ordering.sql");
const ownerMigration = read("../migrations/0019_merchant_phone_registration.sql");
const platformCore = read("../src/platform-membership.js");
const orderingCore = read("../src/qr-ordering.js");
const compatibility = read("../src/membership-compat.js");
const worker = read("../src/index.js");
const app = read("../../src/App.tsx");

test("MQI-01 one normalized phone maps to one ordering customer", () => {
  assert.match(orderingMigration, /phone_normalized TEXT NOT NULL UNIQUE/);
});

test("MQI-02 one customer maps to one platform member", () => {
  assert.match(platformMigration, /customer_id TEXT NOT NULL UNIQUE/);
  assert.match(platformCore, /ensurePlatformMember/);
});

test("MQI-03 merchant memberships reuse the customer identity per merchant", () => {
  assert.match(orderingMigration, /UNIQUE\(merchant_id,customer_id\)/);
  assert.match(orderingCore, /ensurePlatformMember/);
});

test("MQI-04 merchant owner identity links to the same platform member", () => {
  assert.match(ownerMigration, /platform_member_id TEXT NOT NULL/);
  assert.match(ownerMigration, /FOREIGN KEY\(platform_member_id\) REFERENCES platform_members\(id\)/);
  assert.match(ownerMigration, /UNIQUE\(merchant_id,platform_member_id\)/);
});

test("MQI-05 legacy shared QR paths delegate to current ordering core", () => {
  assert.match(compatibility, /handleOrderingRequest/);
  assert.match(compatibility, /identity_core: "phone_only_platform_member"/);
  assert.match(worker, /handleSharedQrMembershipCompatibility/);
});

test("MQI-06 obsolete Email and password membership cannot create a second identity", () => {
  assert.doesNotMatch(compatibility, /platform_users|password_hash|password_salt/);
  assert.match(compatibility, /PHONE_ONLY_MEMBERSHIP_REQUIRED/);
});

test("MQI-07 main QR routes remain available through safe compatibility redirects", () => {
  assert.match(app, /path="\/join\/:merchantSlug"/);
  assert.match(app, /path="\/member\/login"/);
  assert.match(app, /path="\/dashboard\/qr-codes"/);
  assert.match(app, /QrMembershipJoinCompatibility/);
});
