import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const phone = String(process.env.DEMO_ADMIN_PHONE || "").replace(/[\s()-]/g, "");
if (!/^09\d{8}$/.test(phone)) throw new Error("DEMO_ADMIN_PHONE must be a normalized Taiwan mobile number.");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const eventId = `mse_${randomUUID().replaceAll("-", "")}`;
const sql = `
INSERT OR IGNORE INTO ordering_customers(id,display_name,phone_normalized,phone_display,phone_verified,privacy_consent_version,privacy_consented_at)
VALUES('customer_demo_beef_admin_v2','百工牛肉麵試用管理者',${quote(phone)},${quote(phone)},1,'staging-demo-admin-v2',CURRENT_TIMESTAMP);
UPDATE ordering_customers SET phone_verified=1,updated_at=CURRENT_TIMESTAMP WHERE phone_normalized=${quote(phone)};
INSERT OR IGNORE INTO platform_members(id,customer_id,member_no,joined_source,phone_verified,membership_origin_verified)
SELECT 'pmember_demo_beef_admin_v2',id,'BYM-DEMO-BEEF-ADMIN-V2','merchant_phone_login',1,1 FROM ordering_customers WHERE phone_normalized=${quote(phone)};
UPDATE platform_members SET phone_verified=1,membership_origin_verified=1,updated_at=CURRENT_TIMESTAMP WHERE customer_id=(SELECT id FROM ordering_customers WHERE phone_normalized=${quote(phone)});
INSERT OR IGNORE INTO platform_member_welcome_events(id,member_id,source)
SELECT 'pwelcome_demo_beef_admin_v2',p.id,'phone' FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized=${quote(phone)};
INSERT OR IGNORE INTO merchant_users(id,merchant_id,email,password_hash,password_salt,status,display_name,phone_normalized,platform_member_id,auth_mode)
SELECT 'demo_beef_phone_owner_v2','demo_beef_noodle','demo_beef_phone_owner_v2@merchant.internal.invalid','PASSWORDLESS_DISABLED','','active','百工牛肉麵｜試用管理者',${quote(phone)},p.id,'passwordless_phone'
FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized=${quote(phone)};
INSERT OR IGNORE INTO merchant_user_roles(merchant_id,user_id,role_id) VALUES('demo_beef_noodle','demo_beef_phone_owner_v2','demo_beef_owner_role');
INSERT OR IGNORE INTO merchant_owner_links(merchant_id,merchant_user_id,platform_member_id,phone_normalized)
SELECT 'demo_beef_noodle','demo_beef_phone_owner_v2',p.id,${quote(phone)} FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized=${quote(phone)};
INSERT INTO staging_demo_merchant_admin_allowlist(merchant_id,platform_member_id,enabled,granted_by)
SELECT 'demo_beef_noodle',p.id,1,'staging_provisioning' FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized=${quote(phone)}
ON CONFLICT(merchant_id,platform_member_id) DO UPDATE SET enabled=1,updated_at=CURRENT_TIMESTAMP;
INSERT INTO merchant_ordering_memberships(id,merchant_id,customer_id,membership_no,status,joined_via_qr_id,consent_version,consented_at,visit_count,last_seen_at)
SELECT 'membership_demo_beef_admin_v2','demo_beef_noodle',c.id,'MBR-DEMO-BEEF-ADMIN-V2','active',NULL,'merchant-phone-login-v2',CURRENT_TIMESTAMP,1,CURRENT_TIMESTAMP
FROM ordering_customers c WHERE c.phone_normalized=${quote(phone)}
ON CONFLICT(merchant_id,customer_id) DO UPDATE SET status='active',last_seen_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP;
UPDATE staging_demo_password_credentials SET status='disabled',updated_at=CURRENT_TIMESTAMP WHERE merchant_id='demo_beef_noodle';
INSERT INTO merchant_security_events(id,merchant_id,user_id,action,metadata,ip_hash,user_agent_hash)
VALUES(${quote(eventId)},'demo_beef_noodle','demo_beef_phone_owner_v2','merchant.demo_phone_administrator_provisioned','{"source":"staging_provisioning","role":"merchant_owner"}','staging-provisioning','staging-provisioning');
`;

const temporaryDirectory = mkdtempSync(join(tmpdir(), "baiye-demo-phone-"));
const sqlFile = join(temporaryDirectory, "provision.sql");
writeFileSync(sqlFile, sql, { encoding: "utf8", mode: 0o600 });
const command = `npx wrangler d1 execute baiye-ordering-staging --remote --config wrangler.ordering-staging.jsonc --file ${sqlFile}`;
const result = spawnSync(process.platform === "win32" ? "cmd.exe" : "sh", process.platform === "win32" ? ["/d", "/s", "/c", command] : ["-c", command], { cwd: fileURLToPath(new URL("../cloudflare-worker/", import.meta.url)), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
rmSync(temporaryDirectory, { recursive: true, force: true });
if (result.status !== 0) throw new Error(result.stderr || result.error?.message || "Staging provisioning failed.");
console.log(JSON.stringify({ ok: true, merchant_id: "demo_beef_noodle", platform_member: true, merchant_relationship: true, owner_allowlisted: true, password_login_disabled: true }));
