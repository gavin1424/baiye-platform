PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS merchant_booking_settings (
  merchant_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
  slot_interval_minutes INTEGER NOT NULL DEFAULT 30 CHECK(slot_interval_minutes BETWEEN 5 AND 240),
  minimum_notice_minutes INTEGER NOT NULL DEFAULT 120 CHECK(minimum_notice_minutes >= 0),
  maximum_advance_days INTEGER NOT NULL DEFAULT 60 CHECK(maximum_advance_days BETWEEN 1 AND 365),
  cancellation_cutoff_minutes INTEGER NOT NULL DEFAULT 120 CHECK(cancellation_cutoff_minutes >= 0),
  reschedule_cutoff_minutes INTEGER NOT NULL DEFAULT 120 CHECK(reschedule_cutoff_minutes >= 0),
  default_buffer_before_minutes INTEGER NOT NULL DEFAULT 0 CHECK(default_buffer_before_minutes >= 0),
  default_buffer_after_minutes INTEGER NOT NULL DEFAULT 0 CHECK(default_buffer_after_minutes >= 0),
  reminders_enabled INTEGER NOT NULL DEFAULT 0 CHECK(reminders_enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_booking_routes (
  route_slug TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  booking_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id) REFERENCES merchant_booking_settings(merchant_id)
);

CREATE TABLE IF NOT EXISTS merchant_booking_services (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 5 AND 1440),
  buffer_before_minutes INTEGER NOT NULL DEFAULT 0 CHECK(buffer_before_minutes >= 0),
  buffer_after_minutes INTEGER NOT NULL DEFAULT 0 CHECK(buffer_after_minutes >= 0),
  price_text TEXT,
  max_capacity INTEGER NOT NULL DEFAULT 1 CHECK(max_capacity BETWEEN 1 AND 100),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id) REFERENCES merchant_booking_settings(merchant_id)
);

CREATE TABLE IF NOT EXISTS merchant_booking_staff (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  max_concurrent INTEGER NOT NULL DEFAULT 1 CHECK(max_concurrent BETWEEN 1 AND 100),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id) REFERENCES merchant_booking_settings(merchant_id)
);

CREATE TABLE IF NOT EXISTS merchant_booking_service_staff (
  merchant_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  PRIMARY KEY(merchant_id,service_id,staff_id),
  FOREIGN KEY(merchant_id,service_id) REFERENCES merchant_booking_services(merchant_id,id),
  FOREIGN KEY(merchant_id,staff_id) REFERENCES merchant_booking_staff(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS merchant_booking_hours (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  staff_id TEXT,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id) REFERENCES merchant_booking_settings(merchant_id),
  FOREIGN KEY(merchant_id,staff_id) REFERENCES merchant_booking_staff(merchant_id,id),
  CHECK(start_time < end_time)
);

CREATE TABLE IF NOT EXISTS merchant_booking_blackouts (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  staff_id TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  reason TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id) REFERENCES merchant_booking_settings(merchant_id),
  FOREIGN KEY(merchant_id,staff_id) REFERENCES merchant_booking_staff(merchant_id,id),
  CHECK(start_at < end_at)
);

CREATE TABLE IF NOT EXISTS merchant_bookings (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  booking_code TEXT NOT NULL UNIQUE,
  manage_token_hash TEXT NOT NULL,
  service_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  line_user_id TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  blocked_start_at TEXT NOT NULL,
  blocked_end_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1 CHECK(party_size BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','completed','no_show')),
  source TEXT NOT NULL CHECK(source IN ('website','line','admin','ai')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TEXT,
  cancellation_reason TEXT,
  rescheduled_from_booking_id TEXT,
  FOREIGN KEY(merchant_id,service_id) REFERENCES merchant_booking_services(merchant_id,id),
  FOREIGN KEY(merchant_id,staff_id) REFERENCES merchant_booking_staff(merchant_id,id),
  FOREIGN KEY(rescheduled_from_booking_id) REFERENCES merchant_bookings(id),
  CHECK(start_at < end_at),
  CHECK(blocked_start_at < blocked_end_at)
);

CREATE TABLE IF NOT EXISTS merchant_booking_audit_logs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  booking_id TEXT,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('customer','merchant','admin','system')),
  action TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(booking_id) REFERENCES merchant_bookings(id)
);

CREATE TABLE IF NOT EXISTS merchant_booking_notifications (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('line','email')),
  status TEXT NOT NULL CHECK(status IN ('pending','sent','failed','skipped')),
  provider_status INTEGER,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  UNIQUE(booking_id,notification_type,channel),
  FOREIGN KEY(booking_id) REFERENCES merchant_bookings(id)
);

CREATE INDEX IF NOT EXISTS idx_booking_services_merchant ON merchant_booking_services(merchant_id,active,sort_order);
CREATE INDEX IF NOT EXISTS idx_booking_staff_merchant ON merchant_booking_staff(merchant_id,active);
CREATE INDEX IF NOT EXISTS idx_booking_hours_lookup ON merchant_booking_hours(merchant_id,weekday,active);
CREATE INDEX IF NOT EXISTS idx_booking_blackouts_lookup ON merchant_booking_blackouts(merchant_id,start_at,end_at,active);
CREATE INDEX IF NOT EXISTS idx_bookings_collision ON merchant_bookings(merchant_id,staff_id,blocked_start_at,blocked_end_at,status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON merchant_bookings(merchant_id,booking_code,customer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_calendar ON merchant_bookings(merchant_id,start_at,status);

INSERT OR IGNORE INTO merchant_booking_settings (merchant_id,enabled,timezone,slot_interval_minutes,minimum_notice_minutes,maximum_advance_days,cancellation_cutoff_minutes,reschedule_cutoff_minutes)
VALUES ('meiling_patchwork',1,'Asia/Taipei',30,120,60,120,120);

INSERT OR IGNORE INTO merchant_booking_routes (route_slug,merchant_id,booking_url)
VALUES ('meiling','meiling_patchwork','https://meilingpatchwork.com/booking/');

INSERT OR IGNORE INTO merchant_booking_services (id,merchant_id,name,description,duration_minutes,price_text,active,sort_order)
VALUES
('meiling_patchwork_course_consult','meiling_patchwork','拼布課程諮詢','了解拼布與生活布藝課程方向，實際課程內容與時間由店家確認。',60,'依課程／需求確認',1,10),
('meiling_handcraft_course','meiling_patchwork','手作課程預約','預約手作課程時段，材料、授課內容與費用依實際課程確認。',120,'依課程／需求確認',1,20),
('meiling_custom_consult','meiling_patchwork','客製需求諮詢','討論拼布、刺繡、生活布藝與客製贈禮需求。',60,'依課程／需求確認',1,30);

INSERT OR IGNORE INTO merchant_booking_staff (id,merchant_id,display_name,active,max_concurrent)
VALUES ('meiling_booking_staff','meiling_patchwork','預約服務人員',1,1);

INSERT OR IGNORE INTO merchant_booking_service_staff (merchant_id,service_id,staff_id)
SELECT 'meiling_patchwork',id,'meiling_booking_staff' FROM merchant_booking_services WHERE merchant_id='meiling_patchwork';

-- Deliberately no default booking hours: the storefront must remain closed until the merchant confirms real availability.
