import { createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const phone = "0900000026";
const code = randomBytes(18).toString("base64url");
const salt = randomBytes(24).toString("base64url");
let material = Buffer.from(code);
for (let index = 0; index < 6; index += 1) material = pbkdf2Sync(material, `${salt}:${index}`, 100000, 32, "sha256");
const codeHash = material.toString("base64url");
const phoneHash = createHash("sha256").update(`phone:${phone}`).digest("base64url");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sql = `
INSERT OR IGNORE INTO ordering_customers(id,display_name,phone_normalized,phone_display,phone_verified,privacy_consent_version,privacy_consented_at)
VALUES('demo_beef_customer','百工牛肉麵試用管理者','0900000026','0900000026',1,'production-demo-access-v1',CURRENT_TIMESTAMP);
UPDATE ordering_customers SET phone_verified=1,updated_at=CURRENT_TIMESTAMP WHERE phone_normalized='0900000026';
INSERT OR IGNORE INTO platform_members(id,customer_id,member_no,status,joined_source,phone_verified,membership_origin_verified)
SELECT 'demo_beef_platform_member',c.id,'BYM-BEEF-DEMO-OWNER','active','admin',1,1 FROM ordering_customers c
WHERE c.phone_normalized='0900000026' AND NOT EXISTS(SELECT 1 FROM platform_members p WHERE p.customer_id=c.id);
UPDATE platform_members SET status='active',phone_verified=1,membership_origin_verified=1,updated_at=CURRENT_TIMESTAMP
WHERE customer_id=(SELECT id FROM ordering_customers WHERE phone_normalized='0900000026');
INSERT OR IGNORE INTO merchant_users(id,merchant_id,email,password_hash,password_salt,status,display_name,phone_normalized,platform_member_id,auth_mode)
SELECT 'demo_beef_owner','demo_beef_noodle','demo-owner@baiyeconnect.com','PASSWORDLESS_DISABLED','PASSWORDLESS_DISABLED','active','百工牛肉麵｜試用管理者','0900000026',p.id,'passwordless_phone'
FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized='0900000026';
UPDATE merchant_users SET status='active',phone_normalized='0900000026',platform_member_id=(SELECT p.id FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized='0900000026'),auth_mode='passwordless_phone',updated_at=CURRENT_TIMESTAMP
WHERE merchant_id='demo_beef_noodle' AND id='demo_beef_owner';
INSERT OR IGNORE INTO merchant_user_roles(merchant_id,user_id,role_id) VALUES('demo_beef_noodle','demo_beef_owner','demo_beef_owner_role');
INSERT OR IGNORE INTO merchant_owner_links(merchant_id,merchant_user_id,platform_member_id,phone_normalized)
SELECT 'demo_beef_noodle','demo_beef_owner',p.id,'0900000026' FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized='0900000026';
INSERT INTO merchant_ordering_memberships(id,merchant_id,customer_id,membership_no,status,consent_version,consented_at,visit_count,last_seen_at)
SELECT 'demo_beef_owner_membership','demo_beef_noodle',c.id,'MBR-BEEF-DEMO-OWNER','active','production-demo-access-v1',CURRENT_TIMESTAMP,1,CURRENT_TIMESTAMP FROM ordering_customers c WHERE c.phone_normalized='0900000026'
ON CONFLICT(merchant_id,customer_id) DO UPDATE SET status='active',last_seen_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP;
INSERT INTO production_demo_access_credentials(merchant_id,platform_member_id,phone_hash,code_hash,code_salt,code_iterations,failed_attempts,locked_until,status,provisioned_at)
SELECT 'demo_beef_noodle',p.id,${quote(phoneHash)},${quote(codeHash)},${quote(salt)},600000,0,NULL,'active',CURRENT_TIMESTAMP FROM platform_members p JOIN ordering_customers c ON c.id=p.customer_id WHERE c.phone_normalized='0900000026'
ON CONFLICT(merchant_id) DO UPDATE SET platform_member_id=excluded.platform_member_id,phone_hash=excluded.phone_hash,code_hash=excluded.code_hash,code_salt=excluded.code_salt,code_iterations=excluded.code_iterations,failed_attempts=0,locked_until=NULL,status='active',provisioned_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP;
INSERT INTO merchant_security_events(id,merchant_id,user_id,action,metadata) VALUES('mse_'||lower(hex(randomblob(16))),'demo_beef_noodle','demo_beef_owner','production_demo_access_provisioned','{"identity":"canonical_platform_member","role":"merchant_owner","secret_storage":"hash_only"}');
`;
const directory = mkdtempSync(join(tmpdir(), "baiye-production-demo-access-"));
const sqlFile = join(directory, "provision-hash-only.sql");
writeFileSync(sqlFile, sql, { encoding: "utf8", mode: 0o600 });
const cwd = fileURLToPath(new URL("../cloudflare-worker/", import.meta.url));
const executable = process.platform === "win32" ? "cmd.exe" : "npx";
const args = process.platform === "win32"
  ? ["/d", "/s", "/c", `npx wrangler d1 execute FINANCE_DB --remote --file "${sqlFile}"`]
  : ["wrangler", "d1", "execute", "FINANCE_DB", "--remote", "--file", sqlFile];
const result = spawnSync(executable, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
rmSync(directory, { recursive: true, force: true });
if (result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout || "Production demo credential provisioning failed.");
console.log(JSON.stringify({ merchant_id: "demo_beef_noodle", phone, access_code: code, stored: "PBKDF2 hash and salt only", display_once: true }));
