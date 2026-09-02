PRAGMA foreign_keys = ON;

ALTER TABLE merchant_bookings ADD COLUMN booking_source TEXT NOT NULL DEFAULT 'website'
  CHECK(booking_source IN ('website','line','google_maps','manual'));
ALTER TABLE merchant_bookings ADD COLUMN platform_member_id TEXT;
ALTER TABLE merchant_bookings ADD COLUMN idempotency_key_hash TEXT;
ALTER TABLE merchant_booking_routes ADD COLUMN referral_source TEXT NOT NULL DEFAULT 'website'
  CHECK(referral_source IN ('website','line','google_maps','manual'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_idempotency
  ON merchant_bookings(merchant_id,idempotency_key_hash)
  WHERE idempotency_key_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_source_month
  ON merchant_bookings(merchant_id,booking_source,created_at);

CREATE TABLE google_maps_booking_applications (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'UNDER_REVIEW' CHECK(status IN (
    'UNDER_REVIEW','GOOGLE_PROFILE_VERIFYING','BOOKING_PAGE_CONFIGURING',
    'TESTING','ACTIVE','NEEDS_INFO','SUSPENDED'
  )),
  merchant_name TEXT NOT NULL,
  google_maps_url TEXT NOT NULL,
  google_business_profile_url TEXT,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  merchant_type TEXT NOT NULL,
  services_json TEXT NOT NULL,
  has_staff_schedule INTEGER NOT NULL DEFAULT 0 CHECK(has_staff_schedule IN (0,1)),
  business_hours_json TEXT NOT NULL,
  has_google_profile INTEGER NOT NULL DEFAULT 0 CHECK(has_google_profile IN (0,1)),
  has_booking_system INTEGER NOT NULL DEFAULT 0 CHECK(has_booking_system IN (0,1)),
  note TEXT,
  missing_info_note TEXT,
  internal_note TEXT,
  checklist_json TEXT NOT NULL DEFAULT '{}',
  booking_route_slug TEXT UNIQUE,
  booking_url TEXT,
  line_add_friend_url TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id) REFERENCES merchants(id)
);

CREATE TABLE google_maps_booking_events (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('merchant','admin','system')),
  actor_id TEXT,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(application_id) REFERENCES google_maps_booking_applications(id),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id)
);

CREATE INDEX idx_google_maps_booking_status
  ON google_maps_booking_applications(status,updated_at);
CREATE INDEX idx_google_maps_booking_events_application
  ON google_maps_booking_events(application_id,created_at);
