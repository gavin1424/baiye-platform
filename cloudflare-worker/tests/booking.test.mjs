import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { availableSlots, bookingAvailabilityReply, createBooking, handleBookingRequest } from "../src/booking.js";

class D1Statement {
  constructor(statement, sql) { this.statement = statement; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async run() { const result = this.statement.run(...this.values); return { meta: { changes: Number(result.changes || 0) } }; }
  async first() { return this.statement.get(...this.values) || null; }
  async all() { return { results: this.statement.all(...this.values) }; }
}
class TestD1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    for (const file of ["0001_finance_core.sql", "0007_merchant_ai_quota.sql", "0008_merchant_booking_engine.sql", "0022_google_maps_booking_referral.sql"]) this.sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n"));
  }
  prepare(sql) { return new D1Statement(this.sqlite.prepare(sql), sql); }
  async batch(statements) {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => {
        if (/RETURNING/i.test(statement.sql)) { const rows = statement.statement.all(...statement.values); return { results: rows, meta: { changes: rows.length } }; }
        const result = statement.statement.run(...statement.values); return { meta: { changes: Number(result.changes || 0) } };
      });
      this.sqlite.exec("COMMIT"); return results;
    } catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
  row(sql, ...values) { return this.sqlite.prepare(sql).get(...values); }
}

const route = { route_slug: "meiling", merchant_id: "meiling_patchwork", booking_url: "https://meilingpatchwork.com/booking/", enabled: 1, timezone: "Asia/Taipei", slot_interval_minutes: 30, minimum_notice_minutes: 0, maximum_advance_days: 60, cancellation_cutoff_minutes: 0, reschedule_cutoff_minutes: 0, default_buffer_before_minutes: 0, default_buffer_after_minutes: 0 };
const futureDate = (days = 7) => { const d = new Date(Date.now() + days * 86400000); return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); };
function openEveryDay(db) {
  for (let weekday = 0; weekday < 7; weekday++) db.sqlite.prepare("INSERT INTO merchant_booking_hours (id,merchant_id,weekday,start_time,end_time,active) VALUES (?,?,?,?,?,1)").run(`hours-${weekday}`, "meiling_patchwork", weekday, "09:00", "18:00");
}
const input = (date = futureDate(), time = "10:00") => ({ service_id: "meiling_patchwork_course_consult", staff_id: "meiling_booking_staff", date, time, customer_name: "測試顧客", customer_phone: "0912345678", customer_email: "", note: "", party_size: 1 });

test("A/B: atomic conditional insert allows only one concurrent booking", async () => {
  const db = new TestD1(); openEveryDay(db);
  const [a, b] = await Promise.all([createBooking(db, route, input(), "website"), createBooking(db, route, input(), "website")]);
  assert.equal([a.ok, b.ok].filter(Boolean).length, 1);
  assert.equal([a, b].find((result) => !result.ok).status, 409);
  assert.equal(db.row("SELECT COUNT(*) count FROM merchant_bookings").count, 1);
});

test("C: secure lookup and cancellation preserve the row and release the slot", async () => {
  const db = new TestD1(); openEveryDay(db);
  const created = await createBooking(db, route, input(), "website");
  const lookupRequest = new Request("https://worker.test/api/merchant/meiling/booking/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ booking_code: created.booking.booking_code, customer_phone: "0912345678" }) });
  const lookupResponse = await handleBookingRequest(lookupRequest, { FINANCE_DB: db }, new URL(lookupRequest.url), {});
  assert.equal(lookupResponse.status, 200);
  const lookup = await lookupResponse.json();
  assert.ok(lookup.manage_token);
  assert.equal("customer_phone" in lookup.booking, false);
  const cancelRequest = new Request(`https://worker.test/api/merchant/meiling/booking/${created.booking.booking_code}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ manage_token: lookup.manage_token, reason: "行程變更" }) });
  const cancelResponse = await handleBookingRequest(cancelRequest, { FINANCE_DB: db }, new URL(cancelRequest.url), {});
  assert.equal(cancelResponse.status, 200);
  const replacement = await createBooking(db, route, input(), "website");
  assert.equal(replacement.ok, true);
  assert.equal(db.row("SELECT COUNT(*) count FROM merchant_bookings WHERE status='cancelled'").count, 1);
});

test("D: reschedule transaction releases old slot and occupies the new one", async () => {
  const db = new TestD1(); openEveryDay(db);
  const created = await createBooking(db, route, input(), "website");
  const request = new Request(`https://worker.test/api/merchant/meiling/booking/${created.booking.booking_code}/reschedule`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ manage_token: created.manage_token, date: futureDate(8), time: "11:00", staff_id: "meiling_booking_staff" }) });
  const response = await handleBookingRequest(request, { FINANCE_DB: db }, new URL(request.url), {});
  assert.equal(response.status, 201);
  assert.equal(db.row("SELECT status FROM merchant_bookings WHERE booking_code=?", created.booking.booking_code).status, "cancelled");
  assert.equal(db.row("SELECT COUNT(*) count FROM merchant_bookings WHERE status='pending'").count, 1);
});

test("E/F/G: invalid service, closed hours and blackout are rejected", async () => {
  const db = new TestD1();
  assert.equal((await createBooking(db, route, { ...input(), service_id: "missing" }, "website")).status, 400);
  const availability = new Request(`https://worker.test/api/merchant/meiling/booking/availability?service_id=missing&date=${futureDate()}`);
  assert.equal((await handleBookingRequest(availability, { FINANCE_DB: db }, new URL(availability.url), {})).status, 400);
  assert.equal((await createBooking(db, route, input(), "website")).status, 409);
  openEveryDay(db);
  const start = new Date(`${futureDate()}T01:30:00.000Z`), end = new Date(start.getTime() + 3 * 3600000);
  db.sqlite.prepare("INSERT INTO merchant_booking_blackouts (id,merchant_id,start_at,end_at,reason) VALUES (?,?,?,?,?)").run("blackout", "meiling_patchwork", start.toISOString(), end.toISOString(), "closed");
  assert.equal((await createBooking(db, route, input(), "website")).status, 409);
});

test("H: availability is based on real hours and never invented", async () => {
  const db = new TestD1();
  assert.deepEqual(await availableSlots(db, route, "meiling_patchwork_course_consult", futureDate()), []);
  assert.equal(await bookingAvailabilityReply("這週有空嗎", { FINANCE_DB: db }), "目前預約時段尚未開放，請透過 LINE 詢問。");
  openEveryDay(db);
  const slots = await availableSlots(db, route, "meiling_patchwork_course_consult", futureDate());
  assert.ok(slots.length > 0);
  assert.match(await bookingAvailabilityReply("這週有空嗎", { FINANCE_DB: db }), /https:\/\/meilingpatchwork.com\/booking\//);
});

test("merchant isolation rejects cross-tenant service IDs", async () => {
  const db = new TestD1(); openEveryDay(db);
  db.sqlite.exec("INSERT INTO merchant_booking_settings (merchant_id,enabled) VALUES ('tenant_b',1); INSERT INTO merchant_booking_services (id,merchant_id,name,duration_minutes) VALUES ('service_b','tenant_b','B service',60); INSERT INTO merchant_booking_staff (id,merchant_id,display_name) VALUES ('staff_b','tenant_b','B staff'); INSERT INTO merchant_booking_service_staff VALUES ('tenant_b','service_b','staff_b');");
  const result = await createBooking(db, route, { ...input(), service_id: "service_b", staff_id: "staff_b" }, "website");
  assert.equal(result.status, 400);
});
