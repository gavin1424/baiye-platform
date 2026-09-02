import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const expectedDatabase = "baiye-contract-signing-staging";
const expectedWorker = "chuang-baiye-contract-signing-staging";
const workerDir = path.resolve("cloudflare-worker");
const configPath = path.join(workerDir, "wrangler.contract-staging.jsonc");
const config = readFileSync(configPath, "utf8");

if (!process.argv.includes("--staging-only")) throw new Error("Refusing to seed without --staging-only.");
if (!config.includes(`"name": "${expectedWorker}"`) || !config.includes(`"database_name": "${expectedDatabase}"`)) {
  throw new Error("Refusing to seed: Contract Signing Staging Worker/D1 guard failed.");
}
if (/production/i.test(config)) throw new Error("Refusing to seed a configuration containing production bindings.");

const route = "gmb_41e6f20782d749b98b525889389e20c6d8ae272e4a33";
const site = "https://baiye-platform-contract-signing-staging.pages.dev";
const checklist = JSON.stringify({
  google_profile_exists: true,
  merchant_name_matches: true,
  business_information_confirmed: true,
  booking_page_complete: true,
  services_complete: true,
  staff_hours_complete: true,
  google_booking_url_configured: true,
  physical_mobile_tested: false,
  merchant_confirmed: true,
  active_approved: false,
}).replaceAll("'", "''");

const hours = Array.from({ length: 7 }, (_, weekday) =>
  `INSERT OR IGNORE INTO merchant_booking_hours(id,merchant_id,weekday,start_time,end_time,active) VALUES('gmb-demo-hours-${weekday}','demo_google_maps_booking',${weekday},'09:00','18:00',1);`,
).join("\n");

const sql = `
PRAGMA foreign_keys=ON;
INSERT OR IGNORE INTO merchants(id,merchant_code,name,contact_name,phone,email,status)
VALUES('demo_google_maps_booking','demo_google_maps_booking','百工 Google 預約示範店','測試聯絡人','0900000000','google-booking-demo@example.test','active');

INSERT OR IGNORE INTO merchant_ordering_settings(merchant_id,display_name,enabled,require_member)
VALUES('demo_google_maps_booking','百工 Google 預約示範店',0,0);

INSERT OR IGNORE INTO merchant_booking_settings(merchant_id,enabled,timezone,slot_interval_minutes,minimum_notice_minutes,maximum_advance_days,cancellation_cutoff_minutes,reschedule_cutoff_minutes)
VALUES('demo_google_maps_booking',1,'Asia/Taipei',30,0,60,120,120);
UPDATE merchant_booking_settings SET enabled=1,timezone='Asia/Taipei',minimum_notice_minutes=0,updated_at=CURRENT_TIMESTAMP
WHERE merchant_id='demo_google_maps_booking';

INSERT OR IGNORE INTO merchant_booking_routes(route_slug,merchant_id,active,booking_url,referral_source)
VALUES('${route}','demo_google_maps_booking',1,'${site}/#/booking/${route}','google_maps');
UPDATE merchant_booking_routes SET active=1,booking_url='${site}/#/booking/${route}',referral_source='google_maps',updated_at=CURRENT_TIMESTAMP
WHERE route_slug='${route}' AND merchant_id='demo_google_maps_booking';

INSERT OR IGNORE INTO google_maps_booking_applications(
  id,merchant_id,status,merchant_name,google_maps_url,contact_name,contact_phone,merchant_type,
  services_json,has_staff_schedule,business_hours_json,has_google_profile,has_booking_system,
  checklist_json,booking_route_slug,booking_url,note
) VALUES(
  'gmbapp_demo_google_maps_booking','demo_google_maps_booking','TESTING','百工 Google 預約示範店',
  'https://www.google.com/maps/','測試聯絡人','0900000000','工作室',
  '["品牌諮詢","網站規劃","預約系統導入"]',1,'{"description":"每日 09:00–18:00"}',1,1,
  '${checklist}','${route}','${site}/#/booking/${route}','STAGING ONLY｜Google Maps Booking Link / Booking Referral Demo'
);
UPDATE google_maps_booking_applications SET status='TESTING',booking_route_slug='${route}',booking_url='${site}/#/booking/${route}',checklist_json='${checklist}',updated_at=CURRENT_TIMESTAMP
WHERE merchant_id='demo_google_maps_booking';

INSERT OR IGNORE INTO merchant_booking_services(id,merchant_id,name,description,duration_minutes,price_text,active,sort_order) VALUES
('gmb-demo-service-1','demo_google_maps_booking','品牌諮詢','品牌與數位入口需求諮詢。',60,'免費諮詢',1,10),
('gmb-demo-service-2','demo_google_maps_booking','網站規劃','官網、會員與 LINE 串接規劃。',60,'免費諮詢',1,20),
('gmb-demo-service-3','demo_google_maps_booking','預約系統導入','Google 導流與 Booking Core 開通評估。',45,'免費諮詢',1,30);

INSERT OR IGNORE INTO merchant_booking_staff(id,merchant_id,display_name,active,max_concurrent) VALUES
('gmb-demo-staff-1','demo_google_maps_booking','顧問 A',1,1),
('gmb-demo-staff-2','demo_google_maps_booking','顧問 B',1,1);

INSERT OR IGNORE INTO merchant_booking_service_staff(merchant_id,service_id,staff_id) VALUES
('demo_google_maps_booking','gmb-demo-service-1','gmb-demo-staff-1'),
('demo_google_maps_booking','gmb-demo-service-1','gmb-demo-staff-2'),
('demo_google_maps_booking','gmb-demo-service-2','gmb-demo-staff-1'),
('demo_google_maps_booking','gmb-demo-service-2','gmb-demo-staff-2'),
('demo_google_maps_booking','gmb-demo-service-3','gmb-demo-staff-1'),
('demo_google_maps_booking','gmb-demo-service-3','gmb-demo-staff-2');

${hours}
`;

const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "baiye-google-booking-seed-"));
const sqlPath = path.join(temporaryDirectory, "seed.sql");
writeFileSync(sqlPath, sql, "utf8");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npx, [
  "wrangler", "d1", "execute", "FINANCE_DB", "--remote",
  "--config", "wrangler.contract-staging.jsonc", `--file=${sqlPath}`,
], { cwd: workerDir, stdio: "inherit", shell: process.platform === "win32" });
rmSync(temporaryDirectory, { recursive: true, force: true });

if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Staging demo seed failed with exit code ${result.status}.`);
console.log(`Staging Google Maps Booking demo ready: ${site}/#/booking/${route}`);
