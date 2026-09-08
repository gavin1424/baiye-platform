const STATUSES = [
  "UNDER_REVIEW",
  "GOOGLE_PROFILE_VERIFYING",
  "BOOKING_PAGE_CONFIGURING",
  "TESTING",
  "ACTIVE",
  "NEEDS_INFO",
  "SUSPENDED",
];

const CHECKLIST_KEYS = [
  "google_profile_exists",
  "merchant_name_matches",
  "business_information_confirmed",
  "booking_page_complete",
  "services_complete",
  "staff_hours_complete",
  "google_booking_url_configured",
  "physical_mobile_tested",
  "merchant_confirmed",
  "active_approved",
];

const TRANSITIONS = {
  UNDER_REVIEW: new Set(["GOOGLE_PROFILE_VERIFYING", "NEEDS_INFO", "SUSPENDED"]),
  NEEDS_INFO: new Set(["UNDER_REVIEW", "SUSPENDED"]),
  GOOGLE_PROFILE_VERIFYING: new Set(["BOOKING_PAGE_CONFIGURING", "NEEDS_INFO", "SUSPENDED"]),
  BOOKING_PAGE_CONFIGURING: new Set(["TESTING", "NEEDS_INFO", "SUSPENDED"]),
  TESTING: new Set(["ACTIVE", "NEEDS_INFO", "SUSPENDED"]),
  ACTIVE: new Set(["SUSPENDED"]),
  SUSPENDED: new Set(["UNDER_REVIEW", "TESTING"]),
};

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "private, no-store", ...headers },
});
const clean = (value, max = 500) => String(value || "").trim().slice(0, max);
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const opaqueRoute = () => `gmb_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
const maskPhone = (phone) => clean(phone, 32).replace(/.(?=.{3})/g, "*");

export function validateGoogleMapsUrl(value) {
  try {
    const url = new URL(clean(value, 1000));
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "maps.google.com") return true;
    if ((host === "www.google.com" || host === "google.com") && url.pathname.startsWith("/maps")) return true;
    return host === "maps.app.goo.gl" && url.pathname.length > 1;
  } catch {
    return false;
  }
}

function normalizeChecklist(input) {
  const source = input && typeof input === "object" ? input : {};
  return Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, source[key] === true]));
}

async function event(db, application, actorType, actorId, type, fromStatus = null, toStatus = null, metadata = {}) {
  await db.prepare(`INSERT INTO google_maps_booking_events
    (id,application_id,merchant_id,actor_type,actor_id,event_type,from_status,to_status,metadata)
    VALUES(?,?,?,?,?,?,?,?,?)`).bind(
    uid("gmbevent"), application.id, application.merchant_id, actorType, actorId || null,
    type, fromStatus, toStatus, JSON.stringify(metadata),
  ).run();
}

async function signedContract(db, merchantId) {
  return db.prepare("SELECT id FROM merchant_contract_signatures WHERE merchant_id=? AND status='VALID' LIMIT 1").bind(merchantId).first();
}

function publicApplication(row) {
  if (!row) return { status: "NOT_APPLIED" };
  return {
    id: row.id,
    status: row.status,
    merchant_name: row.merchant_name,
    google_maps_url: row.google_maps_url,
    google_business_profile_url: row.google_business_profile_url,
    contact_name: row.contact_name,
    contact_phone_masked: maskPhone(row.contact_phone),
    merchant_type: row.merchant_type,
    services: JSON.parse(row.services_json || "[]"),
    has_staff_schedule: Boolean(row.has_staff_schedule),
    business_hours: JSON.parse(row.business_hours_json || "{}"),
    has_google_profile: Boolean(row.has_google_profile),
    has_booking_system: Boolean(row.has_booking_system),
    note: row.note,
    missing_info_note: row.missing_info_note,
    booking_url: row.booking_url,
    submitted_at: row.submitted_at,
    activated_at: row.activated_at,
    updated_at: row.updated_at,
  };
}

function inputFrom(body, merchantName) {
  const mapsUrl = clean(body.google_maps_url, 1000);
  const profileUrl = clean(body.google_business_profile_url, 1000);
  if (!validateGoogleMapsUrl(mapsUrl) || (profileUrl && !validateGoogleMapsUrl(profileUrl))) {
    throw Object.assign(new Error("請輸入 Google 官方地圖網址。"), { code: "INVALID_GOOGLE_MAPS_URL", status: 422 });
  }
  const contactName = clean(body.contact_name, 100), contactPhone = clean(body.contact_phone, 32);
  const type = clean(body.merchant_type, 80), services = Array.isArray(body.services)
    ? body.services.map((item) => clean(item, 120)).filter(Boolean).slice(0, 50)
    : clean(body.services, 2000).split(/[,，\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 50);
  const businessHoursDescription = body.business_hours && typeof body.business_hours === "object"
    ? clean(body.business_hours.description, 2000)
    : clean(body.business_hours, 2000);
  const businessHours = { description: businessHoursDescription };
  if (!contactName || !/^09\d{8}$/.test(contactPhone.replace(/[^0-9]/g, "")) || !type || !services.length || !businessHoursDescription) {
    throw Object.assign(new Error("請完整填寫聯絡人、手機、商家類型、服務項目與營業時間。"), { code: "APPLICATION_INCOMPLETE", status: 422 });
  }
  return {
    merchant_name: clean(body.merchant_name, 160) || merchantName,
    google_maps_url: mapsUrl,
    google_business_profile_url: profileUrl || null,
    contact_name: contactName,
    contact_phone: contactPhone.replace(/[^0-9]/g, ""),
    merchant_type: type,
    services_json: JSON.stringify(services),
    has_staff_schedule: body.has_staff_schedule ? 1 : 0,
    business_hours_json: JSON.stringify(businessHours),
    has_google_profile: body.has_google_profile ? 1 : 0,
    has_booking_system: body.has_booking_system ? 1 : 0,
    note: clean(body.note, 2000) || null,
  };
}

export async function handleMerchantGoogleMapsBooking(request, env, url, cors, authorization) {
  const db = env.FINANCE_DB, merchantId = authorization.session.merchant_id;
  const existing = await db.prepare("SELECT * FROM google_maps_booking_applications WHERE merchant_id=?").bind(merchantId).first();

  if (request.method === "GET" && url.pathname === "/api/merchant/google-maps-booking") {
    const merchant = await db.prepare("SELECT id,name,status FROM merchants WHERE id=?").bind(merchantId).first();
    const signed = Boolean(await signedContract(db, merchantId));
    return json({ merchant: { name: merchant?.name || authorization.session.merchant_name }, contract_signed: signed, application: publicApplication(existing) }, 200, cors);
  }

  if (request.method === "GET" && url.pathname === "/api/merchant/google-maps-booking/stats") {
    const rows = await db.prepare(`SELECT booking_source,COUNT(*) count FROM merchant_bookings
      WHERE merchant_id=? AND datetime(created_at)>=datetime('now','start of month') GROUP BY booking_source`).bind(merchantId).all();
    return json({ month: new Date().toISOString().slice(0, 7), sources: Object.fromEntries((rows.results || []).map((row) => [row.booking_source, Number(row.count)])) }, 200, cors);
  }

  if (request.method === "POST" && url.pathname === "/api/merchant/google-maps-booking") {
    if (!await signedContract(db, merchantId)) return json({ error: "請先完成商家平台服務契約。", code: "MERCHANT_CONTRACT_REQUIRED", next_url: "/merchant/contract" }, 423, cors);
    if (existing && existing.status !== "NEEDS_INFO") return json({ error: "此商家已有 Google 地圖預約申請。", code: "APPLICATION_ALREADY_EXISTS", application: publicApplication(existing) }, 409, cors);
    try {
      const body = await request.json().catch(() => ({}));
      const merchant = await db.prepare("SELECT name FROM merchants WHERE id=?").bind(merchantId).first();
      const input = inputFrom(body, merchant?.name || "商家"), id = existing?.id || uid("gmbapp");
      if (existing) {
        await db.prepare(`UPDATE google_maps_booking_applications SET status='UNDER_REVIEW',merchant_name=?,google_maps_url=?,google_business_profile_url=?,contact_name=?,contact_phone=?,merchant_type=?,services_json=?,has_staff_schedule=?,business_hours_json=?,has_google_profile=?,has_booking_system=?,note=?,missing_info_note=NULL,submitted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?`).bind(
          input.merchant_name, input.google_maps_url, input.google_business_profile_url, input.contact_name, input.contact_phone,
          input.merchant_type, input.services_json, input.has_staff_schedule, input.business_hours_json,
          input.has_google_profile, input.has_booking_system, input.note, id, merchantId,
        ).run();
      } else {
        await db.prepare(`INSERT INTO google_maps_booking_applications
          (id,merchant_id,merchant_name,google_maps_url,google_business_profile_url,contact_name,contact_phone,merchant_type,services_json,has_staff_schedule,business_hours_json,has_google_profile,has_booking_system,note)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
          id, merchantId, input.merchant_name, input.google_maps_url, input.google_business_profile_url,
          input.contact_name, input.contact_phone, input.merchant_type, input.services_json, input.has_staff_schedule,
          input.business_hours_json, input.has_google_profile, input.has_booking_system, input.note,
        ).run();
      }
      const application = await db.prepare("SELECT * FROM google_maps_booking_applications WHERE id=?").bind(id).first();
      await event(db, application, "merchant", authorization.session.user_id, existing ? "application_resubmitted" : "application_submitted", existing?.status || null, "UNDER_REVIEW");
      return json({ application: publicApplication(application) }, existing ? 200 : 201, cors);
    } catch (error) {
      return json({ error: error?.message || "申請資料無法送出。", code: error?.code || "APPLICATION_FAILED" }, Number(error?.status || 500), cors);
    }
  }
  return null;
}

async function ensureBookingRoute(db, application, publicSiteUrl) {
  if (application.booking_route_slug) return application;
  const slug = opaqueRoute(), base = clean(publicSiteUrl, 500) || "https://baiyeconnect.com";
  const bookingUrl = `${base.replace(/\/$/, "")}/#/booking/${slug}`;
  // Membership relationship storage is shared with the ordering core. Creating
  // the disabled container does not enable QR ordering or other merchant tools.
  await db.prepare("INSERT OR IGNORE INTO merchant_ordering_settings(merchant_id,display_name,enabled,require_member) VALUES(?,?,0,0)").bind(application.merchant_id, application.merchant_name).run();
  await db.prepare("INSERT OR IGNORE INTO merchant_booking_settings(merchant_id,enabled) VALUES(?,1)").bind(application.merchant_id).run();
  await db.prepare("UPDATE merchant_booking_settings SET enabled=1,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=?").bind(application.merchant_id).run();
  await db.prepare("INSERT INTO merchant_booking_routes(route_slug,merchant_id,active,booking_url,referral_source) VALUES(?,?,1,?,'google_maps')").bind(slug, application.merchant_id, bookingUrl).run();
  await db.prepare("UPDATE google_maps_booking_applications SET booking_route_slug=?,booking_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(slug, bookingUrl, application.id).run();
  return db.prepare("SELECT * FROM google_maps_booking_applications WHERE id=?").bind(application.id).first();
}

export async function handleGoogleMapsBookingAdmin(request, env, url, cors, adminSession) {
  const db = env.FINANCE_DB;
  if (request.method === "GET" && url.pathname === "/api/admin/google-maps-booking") {
    const rows = await db.prepare(`SELECT a.*,m.name current_merchant_name FROM google_maps_booking_applications a
      JOIN merchants m ON m.id=a.merchant_id ORDER BY datetime(a.updated_at) DESC`).all();
    return json({ items: (rows.results || []).map((row) => ({ ...publicApplication(row), merchant_id: row.merchant_id, current_merchant_name: row.current_merchant_name, checklist: normalizeChecklist(JSON.parse(row.checklist_json || "{}")), internal_note: row.internal_note })) }, 200, cors);
  }
  const match = url.pathname.match(/^\/api\/admin\/google-maps-booking\/([^/]+)\/status$/);
  if (match && request.method === "PATCH") {
    const application = await db.prepare("SELECT * FROM google_maps_booking_applications WHERE id=?").bind(decodeURIComponent(match[1])).first();
    if (!application) return json({ error: "找不到此申請。" }, 404, cors);
    const body = await request.json().catch(() => ({})), next = clean(body.status, 40);
    if (!STATUSES.includes(next) || !TRANSITIONS[application.status]?.has(next)) return json({ error: "不允許的開通狀態轉換。", code: "INVALID_STATUS_TRANSITION" }, 409, cors);
    const checklist = normalizeChecklist(body.checklist || JSON.parse(application.checklist_json || "{}"));
    if (next === "ACTIVE" && !CHECKLIST_KEYS.every((key) => checklist[key])) return json({ error: "全部開通 Checklist 完成後才能標記 ACTIVE。", code: "CHECKLIST_INCOMPLETE" }, 409, cors);
    let current = application;
    if (["BOOKING_PAGE_CONFIGURING", "TESTING", "ACTIVE"].includes(next)) current = await ensureBookingRoute(db, current, env.PUBLIC_SITE_URL);
    await db.prepare(`UPDATE google_maps_booking_applications SET status=?,missing_info_note=?,internal_note=?,checklist_json=?,activated_at=CASE WHEN ?='ACTIVE' THEN CURRENT_TIMESTAMP ELSE activated_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(
      next, next === "NEEDS_INFO" ? clean(body.missing_info_note, 2000) : null, clean(body.internal_note, 4000) || current.internal_note,
      JSON.stringify(checklist), next, current.id,
    ).run();
    const updated = await db.prepare("SELECT * FROM google_maps_booking_applications WHERE id=?").bind(current.id).first();
    await event(db, updated, "admin", adminSession?.id || adminSession?.email, "status_changed", application.status, next, { checklist });
    return json({ application: { ...publicApplication(updated), checklist } }, 200, cors);
  }
  return null;
}

export const googleMapsBookingChecklistKeys = CHECKLIST_KEYS;
