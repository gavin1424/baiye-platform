import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { handleBookingRequest } from "../src/booking.js";
import {
  googleMapsBookingChecklistKeys,
  handleGoogleMapsBookingAdmin,
  handleMerchantGoogleMapsBooking,
  validateGoogleMapsUrl,
} from "../src/google-maps-booking.js";
import { ensureStandardCommercialTerms } from "../src/merchant-standard-terms.js";

class Statement {
  constructor(statement, sql) { this.statement = statement; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async run() { const result = this.statement.run(...this.values); return { meta: { changes: Number(result.changes || 0) } }; }
  async first() { return this.statement.get(...this.values) || null; }
  async all() { return { results: this.statement.all(...this.values) }; }
}
class D1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    for (const name of readdirSync(new URL("../migrations", import.meta.url)).filter((x) => /^\d+.*\.sql$/.test(x)).sort()) {
      this.sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n"));
    }
  }
  prepare(sql) { return new Statement(this.sqlite.prepare(sql), sql); }
  async batch(statements) {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => {
        if (/RETURNING/i.test(statement.sql)) {
          const rows = statement.statement.all(...statement.values);
          return { results: rows, meta: { changes: rows.length } };
        }
        const result = statement.statement.run(...statement.values);
        return { meta: { changes: Number(result.changes || 0) } };
      });
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

const cors = {};
const merchantAuth = (merchantId = "merchant-google") => ({ session: { merchant_id: merchantId, user_id: `user-${merchantId}`, merchant_name: merchantId } });
const request = (path, method = "GET", body, headers = {}) => new Request(`https://worker.test${path}`, {
  method,
  headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const applicationBody = {
  merchant_name: "Google 預約測試商家",
  google_maps_url: "https://www.google.com/maps/place/Test",
  google_business_profile_url: "https://maps.app.goo.gl/TestOfficial1",
  contact_name: "測試聯絡人",
  contact_phone: "0912345678",
  merchant_type: "美業",
  services: ["剪髮", "護髮", "造型"],
  has_staff_schedule: true,
  business_hours: { description: "週一至週六 09:00–18:00" },
  has_google_profile: true,
  has_booking_system: false,
};

async function seedMerchant(db, id = "merchant-google", signed = true) {
  db.sqlite.prepare("INSERT INTO merchants(id,merchant_code,name,contact_name,phone,email,status) VALUES(?,?,?,?,?,?,'contract_required')")
    .run(id, id, `${id} 名稱`, "測試聯絡人", id === "merchant-google" ? "0912345678" : "0922333444", `${id}@example.test`);
  db.sqlite.prepare("INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,display_name,phone_normalized,auth_mode) VALUES(?,?,?,?,?,?,?,'passwordless_phone')")
    .run(`user-${id}`, id, `${id}@example.test`, "PASSWORDLESS_DISABLED", "", "測試聯絡人", id === "merchant-google" ? "0912345678" : "0922333444");
  db.sqlite.prepare("INSERT INTO merchant_roles(id,merchant_id,code,name) VALUES(?,?, 'owner','Owner')").run(`role-${id}`, id);
  const terms = (await ensureStandardCommercialTerms(db, id, new Date("2026-09-02T00:00:00+08:00"))).terms;
  if (signed) {
    db.sqlite.prepare("INSERT INTO merchant_contract_invites(id,merchant_id,commercial_terms_id,email,token_hash,expires_at,used_at,created_by) VALUES(?,?,?,?,?,'2099-01-01',CURRENT_TIMESTAMP,'test')")
      .run(`invite-${id}`, id, terms.id, `${id}@example.test`, `hash-${id}`);
    db.sqlite.prepare(`INSERT INTO merchant_contract_signatures(
      id,public_id,merchant_id,merchant_user_id,contract_version_id,commercial_terms_id,
      signatory_legal_name,signatory_role,legal_representative_name,company_name,signed_at,
      contract_content_hash,commercial_terms_hash,signature_hash,signature_data,document_hash,pdf_hash,
      consent_version,invite_id,session_id_hash,r2_key,evidence_object_key,status
    ) VALUES(?,?,?,?,?,?,'測試聯絡人','legal_representative','測試聯絡人',?,CURRENT_TIMESTAMP,
      'content','terms','signature','{}','document','pdf','v1',?,'session','private.pdf','private.json','VALID')`)
      .run(`signature-${id}`, `public-${id}`, id, `user-${id}`, "merchant_service_v1_1_18000", terms.id, `${id} 名稱`, `invite-${id}`);
  }
  return terms;
}

async function merchantCall(db, merchantId, path, method = "GET", body) {
  const req = request(path, method, body);
  return handleMerchantGoogleMapsBooking(req, { FINANCE_DB: db }, new URL(req.url), cors, merchantAuth(merchantId));
}
async function adminCall(db, path, body) {
  const req = request(path, body ? "PATCH" : "GET", body);
  return handleGoogleMapsBookingAdmin(req, { FINANCE_DB: db, PUBLIC_SITE_URL: "https://staging.example.test" }, new URL(req.url), cors, { id: "admin-1" });
}

test("GMB-01 Google URL allowlist rejects script and arbitrary redirect URLs", () => {
  assert.equal(validateGoogleMapsUrl("https://maps.google.com/maps?q=test"), true);
  assert.equal(validateGoogleMapsUrl("https://www.google.com/maps/place/test"), true);
  assert.equal(validateGoogleMapsUrl("https://maps.app.goo.gl/AbCdEf"), true);
  assert.equal(validateGoogleMapsUrl("javascript:alert(1)"), false);
  assert.equal(validateGoogleMapsUrl("data:text/html,bad"), false);
  assert.equal(validateGoogleMapsUrl("https://evil.example/redirect?to=maps.google.com"), false);
});

test("GMB-02 unsigned merchant is contract-gated", async () => {
  const db = new D1(); await seedMerchant(db, "merchant-google", false);
  const response = await merchantCall(db, "merchant-google", "/api/merchant/google-maps-booking", "POST", applicationBody);
  assert.equal(response.status, 423);
  assert.equal((await response.json()).code, "MERCHANT_CONTRACT_REQUIRED");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM google_maps_booking_applications").get().count, 0);
});

test("GMB-03 signed merchant can apply once and cannot self-activate", async () => {
  const db = new D1(); await seedMerchant(db);
  let response = await merchantCall(db, "merchant-google", "/api/merchant/google-maps-booking", "POST", applicationBody);
  assert.equal(response.status, 201);
  const first = await response.json();
  assert.equal(first.application.status, "UNDER_REVIEW");
  assert.match(first.application.contact_phone_masked, /\*+/);
  response = await merchantCall(db, "merchant-google", "/api/merchant/google-maps-booking", "POST", applicationBody);
  assert.equal(response.status, 409);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM google_maps_booking_applications").get().count, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM google_maps_booking_events WHERE event_type='application_submitted'").get().count, 1);
});

test("GMB-04 merchant isolation is session-derived", async () => {
  const db = new D1(); await seedMerchant(db); await seedMerchant(db, "merchant-other");
  await merchantCall(db, "merchant-google", "/api/merchant/google-maps-booking", "POST", applicationBody);
  const response = await merchantCall(db, "merchant-other", "/api/merchant/google-maps-booking");
  const data = await response.json();
  assert.equal(data.application.status, "NOT_APPLIED");
  assert.equal("google_maps_url" in data.application, false);
});

test("GMB-05 admin transition creates opaque route and ACTIVE requires all checklist items", async () => {
  const db = new D1(); await seedMerchant(db);
  const submitted = await (await merchantCall(db, "merchant-google", "/api/merchant/google-maps-booking", "POST", applicationBody)).json();
  const id = submitted.application.id;
  for (const status of ["GOOGLE_PROFILE_VERIFYING", "BOOKING_PAGE_CONFIGURING", "TESTING"]) {
    const response = await adminCall(db, `/api/admin/google-maps-booking/${id}/status`, { status, checklist: {} });
    assert.equal(response.status, 200);
  }
  let response = await adminCall(db, `/api/admin/google-maps-booking/${id}/status`, { status: "ACTIVE", checklist: {} });
  assert.equal(response.status, 409);
  const checklist = Object.fromEntries(googleMapsBookingChecklistKeys.map((key) => [key, true]));
  response = await adminCall(db, `/api/admin/google-maps-booking/${id}/status`, { status: "ACTIVE", checklist });
  assert.equal(response.status, 200);
  const row = db.sqlite.prepare("SELECT status,booking_route_slug,booking_url FROM google_maps_booking_applications WHERE id=?").get(id);
  assert.equal(row.status, "ACTIVE");
  assert.match(row.booking_route_slug, /^gmb_[a-f0-9]{44}$/);
  assert.equal(row.booking_url.includes("merchant-google"), false);
  assert.equal(db.sqlite.prepare("SELECT enabled FROM merchant_ordering_settings WHERE merchant_id='merchant-google'").get().enabled, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM google_maps_booking_events WHERE event_type='status_changed'").get().count, 4);
});

test("GMB-06 Google booking uses Booking Core, reuses one member and issues no coupon", async () => {
  const db = new D1(); await seedMerchant(db);
  db.sqlite.prepare("INSERT INTO merchant_ordering_settings(merchant_id,display_name,enabled,require_member) VALUES('merchant-google','測試店',1,0)").run();
  db.sqlite.prepare("INSERT INTO merchant_booking_settings(merchant_id,enabled,minimum_notice_minutes,maximum_advance_days) VALUES('merchant-google',1,0,60)").run();
  db.sqlite.prepare("INSERT INTO merchant_booking_routes(route_slug,merchant_id,active,booking_url,referral_source) VALUES('gmb_public_test','merchant-google',1,'https://staging.example.test/#/booking/gmb_public_test','google_maps')").run();
  db.sqlite.prepare("INSERT INTO merchant_booking_services(id,merchant_id,name,duration_minutes) VALUES('service-1','merchant-google','剪髮',60)").run();
  db.sqlite.prepare("INSERT INTO merchant_booking_staff(id,merchant_id,display_name) VALUES('staff-1','merchant-google','設計師 A')").run();
  db.sqlite.prepare("INSERT INTO merchant_booking_service_staff(merchant_id,service_id,staff_id) VALUES('merchant-google','service-1','staff-1')").run();
  for (let day = 0; day < 7; day += 1) db.sqlite.prepare("INSERT INTO merchant_booking_hours(id,merchant_id,weekday,start_time,end_time,active) VALUES(?,?,?,'09:00','18:00',1)").run(`hours-${day}`, "merchant-google", day);
  const target = new Date(Date.now() + 7 * 86400000);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(target);
  const body = { service_id: "service-1", staff_id: "staff-1", date, time: "10:00", customer_name: "Google 顧客", customer_phone: "0933444555", party_size: 1, privacy_consent: true, consent_version: "google-maps-booking-v1" };
  const make = (key) => request("/api/merchant/gmb_public_test/booking", "POST", body, { "idempotency-key": key });
  let response = await handleBookingRequest(make("booking-key-1"), { FINANCE_DB: db }, new URL("https://worker.test/api/merchant/gmb_public_test/booking"), cors);
  assert.equal(response.status, 201);
  response = await handleBookingRequest(make("booking-key-1"), { FINANCE_DB: db }, new URL("https://worker.test/api/merchant/gmb_public_test/booking"), cors);
  assert.equal(response.status, 200);
  response = await handleBookingRequest(make("booking-key-2"), { FINANCE_DB: db }, new URL("https://worker.test/api/merchant/gmb_public_test/booking"), cors);
  assert.equal(response.status, 409);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_bookings WHERE booking_source='google_maps'").get().count, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM platform_members").get().count, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_ordering_memberships").get().count, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM platform_member_coupons").get().count, 0);
});
