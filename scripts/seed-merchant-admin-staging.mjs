import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const workerDir = path.resolve("cloudflare-worker");
const configPath = path.join(workerDir, "wrangler.contract-staging.jsonc");
const config = readFileSync(configPath, "utf8");
if (!process.argv.includes("--staging-only")) throw new Error("Refusing to seed without --staging-only.");
if (!config.includes('"name": "chuang-baiye-contract-signing-staging"') || !config.includes('"database_name": "baiye-contract-signing-staging"') || /production/i.test(config)) throw new Error("Staging Worker/D1 guard failed.");

const sql = `PRAGMA foreign_keys=ON;
INSERT OR IGNORE INTO merchants(id,merchant_code,name,contact_name,phone,email,status) VALUES('merchant_admin_demo','merchant_admin_demo','百工商家管理中心示範店','STAGING 測試管理者','0900000023','merchant-admin-demo@staging.invalid','contract_required');
INSERT OR IGNORE INTO ordering_customers(id,display_name,phone_normalized,phone_display,phone_verified,privacy_consent_version,privacy_consented_at) VALUES
('merchant-admin-owner-customer','STAGING 測試管理者','0900000023','0900***023',1,'merchant-admin-v1',CURRENT_TIMESTAMP),
('merchant-admin-customer-1','會員甲','0900000024','0900***024',1,'merchant-admin-v1',CURRENT_TIMESTAMP),
('merchant-admin-customer-2','會員乙','0900000025','0900***025',1,'merchant-admin-v1',CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO platform_members(id,customer_id,member_no,status,joined_source,phone_verified,membership_origin_verified) VALUES
('merchant-admin-owner-member','merchant-admin-owner-customer','MBR-MERCHANT-ADMIN','active','merchant_contract',1,1),
('merchant-admin-member-1','merchant-admin-customer-1','MBR-MERCHANT-DEMO-1','active','phone',1,1),
('merchant-admin-member-2','merchant-admin-customer-2','MBR-MERCHANT-DEMO-2','active','phone',1,1);
INSERT OR IGNORE INTO merchant_users(id,merchant_id,email,password_hash,password_salt,status,display_name,phone_normalized,platform_member_id,auth_mode) VALUES('merchant-admin-demo-user','merchant_admin_demo','merchant-admin-demo@merchant.internal.invalid','PASSWORDLESS_DISABLED','','active','商家管理者','0900000023','merchant-admin-owner-member','passwordless_phone');
INSERT OR IGNORE INTO merchant_roles(id,merchant_id,code,name,is_system) VALUES('merchant-admin-demo-role','merchant_admin_demo','owner','管理者',1);
INSERT OR IGNORE INTO merchant_user_roles(merchant_id,user_id,role_id) VALUES('merchant_admin_demo','merchant-admin-demo-user','merchant-admin-demo-role');
INSERT OR IGNORE INTO merchant_role_permissions(role_id,permission_code) SELECT 'merchant-admin-demo-role',code FROM merchant_permissions WHERE code LIKE 'merchant.%' OR code LIKE 'ordering.%';
INSERT OR IGNORE INTO merchant_owner_links(merchant_id,merchant_user_id,platform_member_id,phone_normalized) VALUES('merchant_admin_demo','merchant-admin-demo-user','merchant-admin-owner-member','0900000023');
INSERT OR IGNORE INTO merchant_applications(id,merchant_id,platform_member_id,phone_hash,status,consent_version) VALUES('merchant-admin-demo-application','merchant_admin_demo','merchant-admin-owner-member','STAGING_HASH_ONLY','pending_contract','merchant-admin-v1');
INSERT OR IGNORE INTO merchant_contract_commercial_terms(id,merchant_id,plan_code,plan_name,list_price_minor,discount_price_minor,currency,contract_term_months,payment_plan,upfront_amount_minor,offset_target_amount_minor,included_services_json,excluded_services_json,attachments_json,start_date,service_period_end,renewal_terms,status,created_by,approved_by,approved_at,terms_hash,source_preset_id)
VALUES('merchant-admin-demo-terms','merchant_admin_demo','baiye_standard_18000','創百業智慧鏈｜AI 行銷推廣及數位服務方案',3000000,1800000,'TWD',24,'upfront_18000',1800000,0,'[]','[]','{}','2026-09-02','2028-09-01','第三年起依雙方確認之續約條件','approved','system_staging_demo','platform_default',CURRENT_TIMESTAMP,'STAGING-MERCHANT-ADMIN-DEMO-TERMS','baiye_standard_18000');
INSERT OR IGNORE INTO merchant_contract_invites(id,merchant_id,commercial_terms_id,email,token_hash,expires_at,used_at,created_by) VALUES('merchant-admin-demo-invite','merchant_admin_demo','merchant-admin-demo-terms','merchant-admin-demo@staging.invalid','STAGING-HASH-ONLY-MERCHANT-ADMIN-DEMO','2099-12-31T23:59:59.000Z',CURRENT_TIMESTAMP,'system_staging_demo');
INSERT OR IGNORE INTO merchant_onboarding_states(merchant_id,registration_mode,state,operation_locked,commercial_terms_approval_required,commercial_terms_id) VALUES('merchant_admin_demo','standard_self_service','contract_required',1,0,'merchant-admin-demo-terms');
INSERT OR IGNORE INTO merchant_ordering_settings(merchant_id,display_name,enabled,require_member,ordering_open,accepting_orders) VALUES('merchant_admin_demo','百工商家管理中心示範店',1,1,1,1);
INSERT OR IGNORE INTO merchant_menu_categories(id,merchant_id,name,sort_order,active) VALUES('merchant-admin-category','merchant_admin_demo','示範商品',10,1);
INSERT OR IGNORE INTO merchant_menu_items(id,merchant_id,category_id,sku,name,description,price_minor,available,sort_order,status) VALUES
('merchant-admin-product-1','merchant_admin_demo','merchant-admin-category','DEMO-001','品牌諮詢','STAGING 測試商品',60000,1,10,'active'),
('merchant-admin-product-2','merchant_admin_demo','merchant-admin-category','DEMO-002','網站規劃','STAGING 測試商品',80000,1,20,'active'),
('merchant-admin-product-3','merchant_admin_demo','merchant-admin-category','DEMO-003','預約系統導入','STAGING 測試商品',100000,1,30,'active');
INSERT OR IGNORE INTO merchant_ordering_memberships(id,merchant_id,customer_id,membership_no,consent_version,consented_at,visit_count) VALUES
('merchant-admin-relation-1','merchant_admin_demo','merchant-admin-customer-1','MBR-REL-DEMO-1','merchant-admin-v1',CURRENT_TIMESTAMP,2),
('merchant-admin-relation-2','merchant_admin_demo','merchant-admin-customer-2','MBR-REL-DEMO-2','merchant-admin-v1',CURRENT_TIMESTAMP,1);
INSERT OR IGNORE INTO merchant_booking_settings(merchant_id,enabled,minimum_notice_minutes) VALUES('merchant_admin_demo',1,0);
INSERT OR IGNORE INTO merchant_booking_services(id,merchant_id,name,duration_minutes,active) VALUES('merchant-admin-service','merchant_admin_demo','商家服務諮詢',60,1);
INSERT OR IGNORE INTO merchant_booking_staff(id,merchant_id,display_name,active) VALUES('merchant-admin-staff','merchant_admin_demo','示範顧問',1);
INSERT OR IGNORE INTO merchant_booking_service_staff(merchant_id,service_id,staff_id) VALUES('merchant_admin_demo','merchant-admin-service','merchant-admin-staff');
INSERT OR IGNORE INTO merchant_bookings(id,merchant_id,booking_code,manage_token_hash,service_id,staff_id,customer_name,customer_phone,start_at,end_at,blocked_start_at,blocked_end_at,timezone,status,source,booking_source) VALUES
('merchant-admin-booking-1','merchant_admin_demo','MA-DEMO-001','HASH-ONLY-1','merchant-admin-service','merchant-admin-staff','會員甲','0900000024','2026-09-10T02:00:00.000Z','2026-09-10T03:00:00.000Z','2026-09-10T02:00:00.000Z','2026-09-10T03:00:00.000Z','Asia/Taipei','pending','admin','manual'),
('merchant-admin-booking-2','merchant_admin_demo','MA-DEMO-002','HASH-ONLY-2','merchant-admin-service','merchant-admin-staff','會員乙','0900000025','2026-09-11T02:00:00.000Z','2026-09-11T03:00:00.000Z','2026-09-11T02:00:00.000Z','2026-09-11T03:00:00.000Z','Asia/Taipei','confirmed','admin','manual');
INSERT OR IGNORE INTO merchant_admin_profiles(merchant_id,brand_name,business_description,support_phone,business_hours) VALUES('merchant_admin_demo','百工商家管理中心示範店','STAGING ONLY｜管理者權限與 Activation Gate 測試。','0900000023','週一至週五 09:00–18:00');
`;
const dir=mkdtempSync(path.join(os.tmpdir(),"baiye-merchant-admin-seed-")); const file=path.join(dir,"seed.sql"); writeFileSync(file,sql,"utf8");
const executable=process.platform==="win32"?"npx.cmd":"npx";
const result=spawnSync(executable,["wrangler","d1","execute","baiye-contract-signing-staging","--remote","--config","wrangler.contract-staging.jsonc",`--file=${file}`],{cwd:workerDir,stdio:"inherit",shell:process.platform==="win32"});
rmSync(dir,{recursive:true,force:true}); if(result.error)throw result.error;if(result.status!==0)throw new Error(`Seed failed: ${result.status}`);
console.log("merchant_admin_demo ready (PENDING_ACTIVATION). Staging OTP login phone: 0900000023");
