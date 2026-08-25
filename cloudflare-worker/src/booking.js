const E = new TextEncoder();
const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"];
const CUSTOMER_ERROR = "預約系統目前暫時忙碌，請稍後再試，或透過 LINE 聯絡我們。";
const CONFLICT_ERROR = "此時段已被預約，請選擇其他時間。";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const uid = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const isoNow = () => new Date().toISOString();
const normalizePhone = (value) => String(value || "").replace(/[^0-9+]/g, "").slice(0, 24);
const clean = (value, max) => String(value || "").trim().slice(0, max);
const b64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const hash = async (value) => b64(await crypto.subtle.digest("SHA-256", E.encode(value)));

function bookingCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `BK-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function partsInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function zoneOffsetMs(date, timeZone) {
  const p = partsInZone(date, timeZone);
  const represented = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return represented - date.getTime() + date.getUTCSeconds() * 1000 + date.getUTCMilliseconds();
}

export function zonedLocalToUtc(dateText, timeText, timeZone = "Asia/Taipei") {
  const [year, month, day] = String(dateText).split("-").map(Number);
  const [hour, minute] = String(timeText).split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const first = new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
  return new Date(guess.getTime() - zoneOffsetMs(first, timeZone));
}

function localWeekday(dateText) {
  const [y, m, d] = dateText.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addMinutes(date, minutes) { return new Date(date.getTime() + Number(minutes) * 60000); }
function hhmm(date, timeZone) { const p = partsInZone(date, timeZone); return `${p.hour}:${p.minute}`; }
function localDate(date, timeZone) { const p = partsInZone(date, timeZone); return `${p.year}-${p.month}-${p.day}`; }
function publicBooking(row) {
  return { booking_code: row.booking_code, service_name: row.service_name, staff_name: row.staff_name, start_at: row.start_at, end_at: row.end_at, timezone: row.timezone, status: row.status };
}

async function routeContext(db, routeSlug) {
  return db.prepare(`SELECT r.route_slug,r.merchant_id,r.booking_url,s.* FROM merchant_booking_routes r JOIN merchant_booking_settings s ON s.merchant_id=r.merchant_id WHERE r.route_slug=? AND r.active=1`).bind(routeSlug).first();
}

async function serviceContext(db, merchantId, serviceId, staffId) {
  return db.prepare(`SELECT s.*,st.id staff_id,st.display_name staff_name,st.max_concurrent FROM merchant_booking_services s JOIN merchant_booking_service_staff ss ON ss.merchant_id=s.merchant_id AND ss.service_id=s.id JOIN merchant_booking_staff st ON st.merchant_id=ss.merchant_id AND st.id=ss.staff_id WHERE s.merchant_id=? AND s.id=? AND st.id=? AND s.active=1 AND st.active=1`).bind(merchantId, serviceId, staffId).first();
}

async function validateSlot(db, route, service, dateText, timeText, partySize, excludeBookingId = "") {
  const start = zonedLocalToUtc(dateText, timeText, route.timezone);
  if (!start) return { ok: false, error: "日期或時間格式不正確。", status: 400 };
  const end = addMinutes(start, service.duration_minutes);
  const blockedStart = addMinutes(start, -Number(service.buffer_before_minutes || route.default_buffer_before_minutes || 0));
  const blockedEnd = addMinutes(end, Number(service.buffer_after_minutes || route.default_buffer_after_minutes || 0));
  const now = new Date();
  if (start.getTime() < now.getTime() + Number(route.minimum_notice_minutes) * 60000) return { ok: false, error: "此時段已超過最晚預約時間。", status: 409 };
  if (start.getTime() > now.getTime() + Number(route.maximum_advance_days) * 86400000) return { ok: false, error: "此日期尚未開放預約。", status: 409 };
  const weekday = localWeekday(dateText), startLocal = hhmm(start, route.timezone), endLocal = hhmm(end, route.timezone);
  const hours = await db.prepare(`SELECT id FROM merchant_booking_hours WHERE merchant_id=? AND weekday=? AND active=1 AND (staff_id IS NULL OR staff_id=?) AND start_time<=? AND end_time>=? LIMIT 1`).bind(route.merchant_id, weekday, service.staff_id, startLocal, endLocal).first();
  if (!hours) return { ok: false, error: "此時段不在商家開放預約時間內。", status: 409 };
  const blackout = await db.prepare(`SELECT id FROM merchant_booking_blackouts WHERE merchant_id=? AND active=1 AND (staff_id IS NULL OR staff_id=?) AND start_at<? AND end_at>? LIMIT 1`).bind(route.merchant_id, service.staff_id, blockedEnd.toISOString(), blockedStart.toISOString()).first();
  if (blackout) return { ok: false, error: "此時段目前不開放預約。", status: 409 };
  const occupied = await db.prepare(`SELECT COALESCE(SUM(party_size),0) used FROM merchant_bookings WHERE merchant_id=? AND staff_id=? AND status IN ('pending','confirmed') AND id<>? AND blocked_start_at<? AND blocked_end_at>?`).bind(route.merchant_id, service.staff_id, excludeBookingId, blockedEnd.toISOString(), blockedStart.toISOString()).first();
  const capacity = Math.min(Number(service.max_capacity), Number(service.max_concurrent));
  if (Number(occupied?.used || 0) + partySize > capacity) return { ok: false, error: CONFLICT_ERROR, status: 409 };
  return { ok: true, start, end, blockedStart, blockedEnd, weekday, startLocal, endLocal, capacity };
}

const ATOMIC_CREATE_SQL = `INSERT INTO merchant_bookings (id,merchant_id,booking_code,manage_token_hash,service_id,staff_id,customer_name,customer_phone,customer_email,line_user_id,start_at,end_at,blocked_start_at,blocked_end_at,timezone,party_size,status,source,note,rescheduled_from_booking_id)
SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?
WHERE EXISTS (SELECT 1 FROM merchant_booking_services s WHERE s.merchant_id=? AND s.id=? AND s.active=1 AND ?<=s.max_capacity)
AND EXISTS (SELECT 1 FROM merchant_booking_staff st JOIN merchant_booking_service_staff ss ON ss.merchant_id=st.merchant_id AND ss.staff_id=st.id AND ss.service_id=? WHERE st.merchant_id=? AND st.id=? AND st.active=1 AND ?<=st.max_concurrent)
AND EXISTS (SELECT 1 FROM merchant_booking_hours h WHERE h.merchant_id=? AND h.weekday=? AND h.active=1 AND (h.staff_id IS NULL OR h.staff_id=?) AND h.start_time<=? AND h.end_time>=?)
AND NOT EXISTS (SELECT 1 FROM merchant_booking_blackouts x WHERE x.merchant_id=? AND x.active=1 AND (x.staff_id IS NULL OR x.staff_id=?) AND x.start_at<? AND x.end_at>?)
AND COALESCE((SELECT SUM(b.party_size) FROM merchant_bookings b WHERE b.merchant_id=? AND b.staff_id=? AND b.status IN ('pending','confirmed') AND b.id<>? AND b.blocked_start_at<? AND b.blocked_end_at>?),0)+? <= ?
RETURNING id`;

function createStatement(db, data, slot, excludeBookingId = "") {
  return db.prepare(ATOMIC_CREATE_SQL).bind(
    data.id, data.merchantId, data.code, data.tokenHash, data.service.id, data.service.staff_id, data.name, data.phone, data.email, data.lineUserId,
    slot.start.toISOString(), slot.end.toISOString(), slot.blockedStart.toISOString(), slot.blockedEnd.toISOString(), data.timezone, data.partySize, data.source, data.note, data.rescheduledFrom,
    data.merchantId, data.service.id, data.partySize,
    data.service.id, data.merchantId, data.service.staff_id, data.partySize,
    data.merchantId, slot.weekday, data.service.staff_id, slot.startLocal, slot.endLocal,
    data.merchantId, data.service.staff_id, slot.blockedEnd.toISOString(), slot.blockedStart.toISOString(),
    data.merchantId, data.service.staff_id, excludeBookingId, slot.blockedEnd.toISOString(), slot.blockedStart.toISOString(), data.partySize, slot.capacity,
  );
}

async function audit(db, merchantId, bookingId, actorType, action, metadata = {}) {
  await db.prepare(`INSERT INTO merchant_booking_audit_logs (id,merchant_id,booking_id,actor_type,action,metadata) VALUES (?,?,?,?,?,?)`).bind(uid("bookaudit"), merchantId, bookingId, actorType, action, JSON.stringify(metadata)).run();
}

function lineAccessToken(env, merchantId) { return merchantId === "meiling_patchwork" ? env.LINE_MEILING_CHANNEL_ACCESS_TOKEN : null; }
async function sendLinePush(env, booking, type, text) {
  if (!booking.line_user_id || !env.FINANCE_DB) return false;
  const inserted = await env.FINANCE_DB.prepare(`INSERT OR IGNORE INTO merchant_booking_notifications (id,merchant_id,booking_id,notification_type,channel,status) VALUES (?,?,?,?,?,'pending')`).bind(uid("booknotify"), booking.merchant_id, booking.id, type, "line").run();
  if (Number(inserted.meta?.changes || 0) !== 1) return false;
  const token = lineAccessToken(env, booking.merchant_id);
  if (!token) { await env.FINANCE_DB.prepare(`UPDATE merchant_booking_notifications SET status='skipped',error_code='TOKEN_NOT_CONFIGURED' WHERE booking_id=? AND notification_type=? AND channel='line'`).bind(booking.id, type).run(); return false; }
  const response = await fetch("https://api.line.me/v2/bot/message/push", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ to: booking.line_user_id, messages: [{ type: "text", text: text.slice(0, 5000) }] }) });
  await env.FINANCE_DB.prepare(`UPDATE merchant_booking_notifications SET status=?,provider_status=?,error_code=?,sent_at=? WHERE booking_id=? AND notification_type=? AND channel='line'`).bind(response.ok ? "sent" : "failed", response.status, response.ok ? null : "LINE_PUSH_FAILED", response.ok ? isoNow() : null, booking.id, type).run();
  return response.ok;
}

async function detailedBooking(db, merchantId, bookingCode) {
  return db.prepare(`SELECT b.*,s.name service_name,st.display_name staff_name FROM merchant_bookings b JOIN merchant_booking_services s ON s.merchant_id=b.merchant_id AND s.id=b.service_id JOIN merchant_booking_staff st ON st.merchant_id=b.merchant_id AND st.id=b.staff_id WHERE b.merchant_id=? AND b.booking_code=?`).bind(merchantId, bookingCode).first();
}

export async function availableSlots(db, route, serviceId, dateText, staffId = "") {
  const services = await db.prepare(`SELECT s.*,st.id staff_id,st.display_name staff_name,st.max_concurrent FROM merchant_booking_services s JOIN merchant_booking_service_staff ss ON ss.merchant_id=s.merchant_id AND ss.service_id=s.id JOIN merchant_booking_staff st ON st.merchant_id=ss.merchant_id AND st.id=ss.staff_id WHERE s.merchant_id=? AND s.id=? AND s.active=1 AND st.active=1 AND (?='' OR st.id=?) ORDER BY st.display_name`).bind(route.merchant_id, serviceId, staffId, staffId).all();
  if (!services.results.length) return [];
  const weekday = localWeekday(dateText);
  const hours = await db.prepare(`SELECT * FROM merchant_booking_hours WHERE merchant_id=? AND weekday=? AND active=1 ORDER BY start_time`).bind(route.merchant_id, weekday).all();
  if (!hours.results.length) return [];
  const slots = [];
  for (const service of services.results) {
    for (const window of hours.results.filter((row) => !row.staff_id || row.staff_id === service.staff_id)) {
      let cursor = zonedLocalToUtc(dateText, window.start_time, route.timezone);
      const close = zonedLocalToUtc(dateText, window.end_time, route.timezone);
      while (cursor && close && addMinutes(cursor, service.duration_minutes) <= close) {
        const timeText = hhmm(cursor, route.timezone);
        const slot = await validateSlot(db, route, service, dateText, timeText, 1);
        if (slot.ok) slots.push({ start_at: slot.start.toISOString(), end_at: slot.end.toISOString(), time: timeText, staff_id: service.staff_id, staff_name: service.staff_name });
        cursor = addMinutes(cursor, route.slot_interval_minutes);
      }
    }
  }
  return slots;
}

export async function createBooking(db, route, input, source = "website") {
  const service = await serviceContext(db, route.merchant_id, clean(input.service_id, 100), clean(input.staff_id, 100));
  if (!service) return { ok: false, status: 400, error: "找不到可預約的服務或服務人員。" };
  const name = clean(input.customer_name, 80), phone = normalizePhone(input.customer_phone), partySize = Math.max(1, Number(input.party_size || 1));
  if (!name || phone.length < 8 || !Number.isInteger(partySize)) return { ok: false, status: 400, error: "請完整填寫姓名、手機與預約人數。" };
  const slot = await validateSlot(db, route, service, clean(input.date, 10), clean(input.time, 5), partySize);
  if (!slot.ok) return slot;
  const rawToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const data = { id: uid("booking"), merchantId: route.merchant_id, code: bookingCode(), tokenHash: await hash(rawToken), service, name, phone, email: clean(input.customer_email, 160) || null, lineUserId: clean(input.line_user_id, 100) || null, timezone: route.timezone, partySize, source, note: clean(input.note, 1000) || null, rescheduledFrom: null };
  const created = await createStatement(db, data, slot).first();
  if (!created) return { ok: false, status: 409, error: CONFLICT_ERROR };
  await audit(db, route.merchant_id, data.id, "customer", "booking_created", { source });
  const booking = await detailedBooking(db, route.merchant_id, data.code);
  return { ok: true, booking, manage_token: rawToken };
}

async function manageAuth(db, merchantId, bookingCode, token) {
  const row = await detailedBooking(db, merchantId, bookingCode);
  if (!row || !token || row.manage_token_hash !== await hash(String(token))) return null;
  return row;
}

async function financeAdmin(request, env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !env.FINANCE_SESSION_SECRET) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const key = await crypto.subtle.importKey("raw", E.encode(env.FINANCE_SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = b64(await crypto.subtle.sign("HMAC", key, E.encode(payload)));
  if (signature !== expected) return false;
  try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((payload.length + 3) % 4)), (c) => c.charCodeAt(0)))).exp > Date.now(); } catch { return false; }
}

export async function handleBookingRequest(request, env, url, cors = {}) {
  const db = env.FINANCE_DB;
  if (!db) return json({ error: CUSTOMER_ERROR }, 503, cors);
  const match = url.pathname.match(/^\/api\/merchant\/([^/]+)\/booking(?:\/([^/]+))?(?:\/([^/]+))?$/);
  if (!match) return null;
  const route = await routeContext(db, decodeURIComponent(match[1]));
  if (!route) return json({ error: "找不到此商家的預約服務。" }, 404, cors);
  const resource = match[2] || "", action = match[3] || "";
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!route.enabled && resource !== "services") return json({ error: "目前預約功能尚未開放，請透過 LINE 詢問。" }, 409, cors);
  try {
    if (request.method === "GET" && resource === "services") {
      const rows = await db.prepare(`SELECT s.id,s.name,s.description,s.duration_minutes,s.price_text,s.max_capacity,st.id staff_id,st.display_name staff_name FROM merchant_booking_services s JOIN merchant_booking_service_staff ss ON ss.merchant_id=s.merchant_id AND ss.service_id=s.id JOIN merchant_booking_staff st ON st.merchant_id=ss.merchant_id AND st.id=ss.staff_id WHERE s.merchant_id=? AND s.active=1 AND st.active=1 ORDER BY s.sort_order,s.name`).bind(route.merchant_id).all();
      return json({ merchant_id: route.merchant_id, enabled: Boolean(route.enabled), timezone: route.timezone, booking_url: route.booking_url, items: rows.results }, 200, cors);
    }
    if (request.method === "GET" && resource === "availability") {
      const serviceId = clean(url.searchParams.get("service_id"), 100), date = clean(url.searchParams.get("date"), 10), staffId = clean(url.searchParams.get("staff_id"), 100);
      if (!serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "請提供服務與日期。" }, 400, cors);
      const slots = await availableSlots(db, route, serviceId, date, staffId);
      return json({ date, timezone: route.timezone, items: slots, message: slots.length ? null : "目前預約時段尚未開放，請透過 LINE 詢問。" }, 200, cors);
    }
    if (request.method === "POST" && !resource) {
      const input = await request.json();
      const result = await createBooking(db, route, input, "website");
      if (!result.ok) return json({ error: result.error }, result.status, cors);
      const text = `您的預約已收到\n服務：${result.booking.service_name}\n時間：${result.booking.start_at}\n預約編號：${result.booking.booking_code}`;
      await sendLinePush(env, result.booking, "booking_created", text);
      return json({ message: "預約已送出", booking: publicBooking(result.booking), manage_token: result.manage_token }, 201, cors);
    }
    if (request.method === "POST" && resource === "lookup") {
      const input = await request.json(), code = clean(input.booking_code, 40), phone = normalizePhone(input.customer_phone);
      const row = await detailedBooking(db, route.merchant_id, code);
      if (!row || row.customer_phone !== phone) return json({ error: "預約編號或手機驗證不正確。" }, 404, cors);
      const rawToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      await db.prepare(`UPDATE merchant_bookings SET manage_token_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(await hash(rawToken), row.id).run();
      return json({ booking: publicBooking(row), manage_token: rawToken }, 200, cors);
    }
    if (request.method === "POST" && resource && action === "cancel") {
      const input = await request.json(), row = await manageAuth(db, route.merchant_id, resource, input.manage_token);
      if (!row) return json({ error: "預約驗證失敗。" }, 403, cors);
      if (!ACTIVE_BOOKING_STATUSES.includes(row.status)) return json({ error: "此預約目前無法取消。" }, 409, cors);
      if (new Date(row.start_at).getTime() - Date.now() < Number(route.cancellation_cutoff_minutes) * 60000) return json({ error: "已超過可線上取消時間，請透過 LINE 聯絡店家。" }, 409, cors);
      await db.prepare(`UPDATE merchant_bookings SET status='cancelled',cancelled_at=CURRENT_TIMESTAMP,cancellation_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('pending','confirmed')`).bind(clean(input.reason, 500) || null, row.id).run();
      await audit(db, route.merchant_id, row.id, "customer", "booking_cancelled");
      const updated = await detailedBooking(db, route.merchant_id, resource);
      await sendLinePush(env, updated, "booking_cancelled", `您的預約已取消\n服務：${updated.service_name}\n預約編號：${updated.booking_code}`);
      return json({ message: "預約已取消", booking: publicBooking(updated) }, 200, cors);
    }
    if (request.method === "POST" && resource && action === "reschedule") {
      const input = await request.json(), old = await manageAuth(db, route.merchant_id, resource, input.manage_token);
      if (!old) return json({ error: "預約驗證失敗。" }, 403, cors);
      if (!ACTIVE_BOOKING_STATUSES.includes(old.status)) return json({ error: "此預約目前無法改期。" }, 409, cors);
      if (new Date(old.start_at).getTime() - Date.now() < Number(route.reschedule_cutoff_minutes) * 60000) return json({ error: "已超過可線上改期時間，請透過 LINE 聯絡店家。" }, 409, cors);
      const service = await serviceContext(db, route.merchant_id, old.service_id, clean(input.staff_id || old.staff_id, 100));
      const slot = service && await validateSlot(db, route, service, clean(input.date, 10), clean(input.time, 5), Number(old.party_size), old.id);
      if (!slot?.ok) return json({ error: slot?.error || CONFLICT_ERROR }, slot?.status || 409, cors);
      const rawToken = `${crypto.randomUUID()}${crypto.randomUUID()}`, data = { id: uid("booking"), merchantId: route.merchant_id, code: bookingCode(), tokenHash: await hash(rawToken), service, name: old.customer_name, phone: old.customer_phone, email: old.customer_email, lineUserId: old.line_user_id, timezone: route.timezone, partySize: Number(old.party_size), source: "website", note: old.note, rescheduledFrom: old.id };
      const statements = [createStatement(db, data, slot, old.id), db.prepare(`UPDATE merchant_bookings SET status='cancelled',cancelled_at=CURRENT_TIMESTAMP,cancellation_reason='rescheduled',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('pending','confirmed')`).bind(old.id)];
      const results = await db.batch(statements);
      if (!results?.[0]?.results?.length && !results?.[0]?.meta?.changes) return json({ error: "此時段剛被其他客人預約，請重新選擇。" }, 409, cors);
      await audit(db, route.merchant_id, old.id, "customer", "booking_rescheduled_from", { new_booking_id: data.id });
      await audit(db, route.merchant_id, data.id, "customer", "booking_rescheduled_to", { old_booking_id: old.id });
      const updated = await detailedBooking(db, route.merchant_id, data.code);
      await sendLinePush(env, updated, "booking_rescheduled", `您的預約時間已更新\n服務：${updated.service_name}\n時間：${updated.start_at}\n預約編號：${updated.booking_code}`);
      return json({ message: "預約時間已更新", booking: publicBooking(updated), manage_token: rawToken }, 201, cors);
    }
    return json({ error: "找不到此預約服務。" }, 404, cors);
  } catch (error) {
    console.error(JSON.stringify({ service: "booking", route: route.route_slug, error: error instanceof Error ? error.message : "unknown" }));
    return json({ error: CUSTOMER_ERROR }, 500, cors);
  }
}

export async function handleBookingAdminRequest(request, env, url, cors = {}) {
  if (!env.FINANCE_DB) return json({ error: CUSTOMER_ERROR }, 503, cors);
  if (!(await financeAdmin(request, env))) return json({ error: "需要平台管理員授權。" }, 401, cors);
  const db = env.FINANCE_DB, merchantId = clean(url.searchParams.get("merchant_id") || "meiling_patchwork", 100);
  if (url.pathname === "/api/admin/bookings" && request.method === "GET") {
    const rows = await db.prepare(`SELECT b.booking_code,b.start_at,b.end_at,b.status,b.source,b.customer_name,b.customer_phone,s.name service_name,st.display_name staff_name FROM merchant_bookings b JOIN merchant_booking_services s ON s.merchant_id=b.merchant_id AND s.id=b.service_id JOIN merchant_booking_staff st ON st.merchant_id=b.merchant_id AND st.id=b.staff_id WHERE b.merchant_id=? ORDER BY datetime(b.start_at) DESC LIMIT 500`).bind(merchantId).all();
    return json({ merchant_id: merchantId, items: rows.results }, 200, cors);
  }
  if (url.pathname === "/api/admin/booking/settings" && request.method === "GET") {
    const settings = await db.prepare(`SELECT * FROM merchant_booking_settings WHERE merchant_id=?`).bind(merchantId).first();
    const [services, staff, hours, blackouts] = await Promise.all([db.prepare(`SELECT * FROM merchant_booking_services WHERE merchant_id=? ORDER BY sort_order`).bind(merchantId).all(), db.prepare(`SELECT * FROM merchant_booking_staff WHERE merchant_id=?`).bind(merchantId).all(), db.prepare(`SELECT * FROM merchant_booking_hours WHERE merchant_id=? ORDER BY weekday,start_time`).bind(merchantId).all(), db.prepare(`SELECT * FROM merchant_booking_blackouts WHERE merchant_id=? ORDER BY start_at DESC`).bind(merchantId).all()]);
    return json({ settings, services: services.results, staff: staff.results, hours: hours.results, blackouts: blackouts.results }, 200, cors);
  }
  if (url.pathname === "/api/admin/booking/settings" && request.method === "PATCH") {
    const input = await request.json();
    await db.prepare(`UPDATE merchant_booking_settings SET enabled=?,slot_interval_minutes=?,minimum_notice_minutes=?,maximum_advance_days=?,cancellation_cutoff_minutes=?,reschedule_cutoff_minutes=?,default_buffer_before_minutes=?,default_buffer_after_minutes=?,reminders_enabled=?,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=?`).bind(input.enabled ? 1 : 0, Number(input.slot_interval_minutes), Number(input.minimum_notice_minutes), Number(input.maximum_advance_days), Number(input.cancellation_cutoff_minutes), Number(input.reschedule_cutoff_minutes), Number(input.default_buffer_before_minutes || 0), Number(input.default_buffer_after_minutes || 0), input.reminders_enabled ? 1 : 0, merchantId).run();
    return json({ ok: true }, 200, cors);
  }
  if (url.pathname === "/api/admin/booking/hours" && request.method === "POST") {
    const input = await request.json();
    const weekday = Number(input.weekday), startTime = clean(input.start_time, 5), endTime = clean(input.end_time, 5);
    const staffId = clean(input.staff_id, 100) || null;
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) return json({ error: "請提供正確的星期與開始、結束時間。" }, 400, cors);
    if (staffId && !(await db.prepare(`SELECT id FROM merchant_booking_staff WHERE merchant_id=? AND id=?`).bind(merchantId, staffId).first())) return json({ error: "找不到此商家的服務人員。" }, 400, cors);
    const id = uid("bookhour");
    await db.prepare(`INSERT INTO merchant_booking_hours (id,merchant_id,staff_id,weekday,start_time,end_time,active) VALUES (?,?,?,?,?,?,1)`).bind(id, merchantId, staffId, weekday, startTime, endTime).run();
    await audit(db, merchantId, null, "admin", "booking_hours_created", { id, weekday, start_time: startTime, end_time: endTime });
    return json({ ok: true, id }, 201, cors);
  }
  const hourMatch = url.pathname.match(/^\/api\/admin\/booking\/hours\/([^/]+)$/);
  if (hourMatch && request.method === "PATCH") {
    const input = await request.json();
    const result = await db.prepare(`UPDATE merchant_booking_hours SET active=? WHERE merchant_id=? AND id=?`).bind(input.active ? 1 : 0, merchantId, hourMatch[1]).run();
    if (!Number(result.meta?.changes || 0)) return json({ error: "找不到此營業時段。" }, 404, cors);
    await audit(db, merchantId, null, "admin", "booking_hours_updated", { id: hourMatch[1], active: Boolean(input.active) });
    return json({ ok: true }, 200, cors);
  }
  if (url.pathname === "/api/admin/booking/blackouts" && request.method === "POST") {
    const input = await request.json();
    const startAt = new Date(input.start_at), endAt = new Date(input.end_at), staffId = clean(input.staff_id, 100) || null;
    if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || startAt >= endAt) return json({ error: "請提供正確的休息開始與結束時間。" }, 400, cors);
    if (staffId && !(await db.prepare(`SELECT id FROM merchant_booking_staff WHERE merchant_id=? AND id=?`).bind(merchantId, staffId).first())) return json({ error: "找不到此商家的服務人員。" }, 400, cors);
    const id = uid("bookblackout");
    await db.prepare(`INSERT INTO merchant_booking_blackouts (id,merchant_id,staff_id,start_at,end_at,reason,active) VALUES (?,?,?,?,?,?,1)`).bind(id, merchantId, staffId, startAt.toISOString(), endAt.toISOString(), clean(input.reason, 300) || null).run();
    await audit(db, merchantId, null, "admin", "booking_blackout_created", { id });
    return json({ ok: true, id }, 201, cors);
  }
  const blackoutMatch = url.pathname.match(/^\/api\/admin\/booking\/blackouts\/([^/]+)$/);
  if (blackoutMatch && request.method === "PATCH") {
    const input = await request.json();
    const result = await db.prepare(`UPDATE merchant_booking_blackouts SET active=? WHERE merchant_id=? AND id=?`).bind(input.active ? 1 : 0, merchantId, blackoutMatch[1]).run();
    if (!Number(result.meta?.changes || 0)) return json({ error: "找不到此休息時段。" }, 404, cors);
    await audit(db, merchantId, null, "admin", "booking_blackout_updated", { id: blackoutMatch[1], active: Boolean(input.active) });
    return json({ ok: true }, 200, cors);
  }
  const serviceMatch = url.pathname.match(/^\/api\/admin\/booking\/services\/([^/]+)$/);
  if (serviceMatch && request.method === "PATCH") {
    const input = await request.json();
    const duration = Number(input.duration_minutes), capacity = Number(input.max_capacity || 1);
    if (!clean(input.name, 120) || !Number.isInteger(duration) || duration < 15 || duration > 1440 || !Number.isInteger(capacity) || capacity < 1 || capacity > 100) return json({ error: "請提供正確的服務名稱、時間與人數上限。" }, 400, cors);
    const result = await db.prepare(`UPDATE merchant_booking_services SET name=?,description=?,duration_minutes=?,buffer_before_minutes=?,buffer_after_minutes=?,price_text=?,max_capacity=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND id=?`).bind(clean(input.name, 120), clean(input.description, 1000) || null, duration, Math.max(0, Number(input.buffer_before_minutes || 0)), Math.max(0, Number(input.buffer_after_minutes || 0)), clean(input.price_text, 120) || null, capacity, input.active ? 1 : 0, merchantId, serviceMatch[1]).run();
    if (!Number(result.meta?.changes || 0)) return json({ error: "找不到此服務。" }, 404, cors);
    await audit(db, merchantId, null, "admin", "booking_service_updated", { id: serviceMatch[1] });
    return json({ ok: true }, 200, cors);
  }
  const statusMatch = url.pathname.match(/^\/api\/admin\/bookings\/([^/]+)\/status$/);
  if (statusMatch && request.method === "PATCH") {
    const input = await request.json(), allowed = ["pending", "confirmed", "cancelled", "completed", "no_show"];
    if (!allowed.includes(input.status)) return json({ error: "不支援的預約狀態。" }, 400, cors);
    const result = await db.prepare(`UPDATE merchant_bookings SET status=?,cancelled_at=CASE WHEN ?='cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND booking_code=?`).bind(input.status, input.status, merchantId, statusMatch[1]).run();
    if (!Number(result.meta?.changes || 0)) return json({ error: "找不到預約。" }, 404, cors);
    return json({ ok: true, status: input.status }, 200, cors);
  }
  return json({ error: "找不到此預約管理服務。" }, 404, cors);
}

export async function bookingAvailabilityReply(message, env) {
  if (!/(預約|有空|時段|報名)/.test(String(message || "")) || !env.FINANCE_DB) return null;
  const route = await routeContext(env.FINANCE_DB, "meiling");
  if (!route?.enabled) return "目前預約時段尚未開放，請透過 LINE 詢問。";
  const service = await env.FINANCE_DB.prepare(`SELECT id,name FROM merchant_booking_services WHERE merchant_id=? AND active=1 ORDER BY sort_order LIMIT 1`).bind(route.merchant_id).first();
  if (!service) return "目前預約服務尚未開放，請透過 LINE 詢問。";
  for (let day = 0; day < 7; day++) {
    const target = addMinutes(new Date(), day * 1440), date = localDate(target, route.timezone);
    const slots = await availableSlots(env.FINANCE_DB, route, service.id, date);
    if (slots.length) return `目前可預約的近期時段：${date} ${slots.slice(0, 3).map((slot) => slot.time).join("、")}。請至 ${route.booking_url} 完成選擇與確認。`;
  }
  return "目前預約時段尚未開放，請透過 LINE 詢問。";
}

export async function runBookingReminders(env) {
  if (!env.FINANCE_DB) return { checked: 0, sent: 0 };
  const rows = await env.FINANCE_DB.prepare(`SELECT b.*,s.name service_name FROM merchant_bookings b JOIN merchant_booking_settings x ON x.merchant_id=b.merchant_id AND x.reminders_enabled=1 JOIN merchant_booking_services s ON s.merchant_id=b.merchant_id AND s.id=b.service_id WHERE b.status IN ('pending','confirmed') AND b.line_user_id IS NOT NULL AND datetime(b.start_at)>=datetime('now','+23 hours') AND datetime(b.start_at)<datetime('now','+25 hours')`).all();
  let sent = 0;
  for (const booking of rows.results) if (await sendLinePush(env, booking, "booking_reminder_24h", `提醒您明天有預約\n服務：${booking.service_name}\n時間：${booking.start_at}\n預約編號：${booking.booking_code}`)) sent++;
  return { checked: rows.results.length, sent };
}
