import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { deriveMerchantPassword } from "../cloudflare-worker/src/merchant-auth.js";

if (!process.argv.includes("--staging-only")) throw new Error("Refusing to provision without --staging-only.");
const database = "baiye-ordering-staging";
const username = "baiye-beef-demo";
const password = randomBytes(18).toString("base64url").slice(0, 18);
const salt = randomBytes(24).toString("base64url");
const hash = await deriveMerchantPassword(password, salt, 600000);
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sql = `
INSERT INTO staging_demo_password_credentials(
  username,merchant_id,merchant_user_id,password_hash,password_salt,password_iterations,password_algorithm,status
) VALUES(
  ${quote(username)},'demo_beef_noodle','demo_beef_owner',${quote(hash)},${quote(salt)},600000,'pbkdf2-sha256-segmented-v1','active'
) ON CONFLICT(username) DO UPDATE SET
  merchant_id='demo_beef_noodle',merchant_user_id='demo_beef_owner',password_hash=excluded.password_hash,
  password_salt=excluded.password_salt,password_iterations=600000,password_algorithm='pbkdf2-sha256-segmented-v1',
  failed_attempts=0,locked_until=NULL,status='active',updated_at=CURRENT_TIMESTAMP;
UPDATE merchant_users SET display_name='百工牛肉麵｜試用管理者',status='active',updated_at=CURRENT_TIMESTAMP
WHERE id='demo_beef_owner' AND merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_ordering_settings WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_ordering_settings SELECT * FROM merchant_ordering_settings WHERE merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_menu_categories WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_menu_categories SELECT * FROM merchant_menu_categories WHERE merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_menu_items WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_menu_items SELECT * FROM merchant_menu_items WHERE merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_option_groups WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_option_groups SELECT * FROM merchant_menu_option_groups WHERE merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_option_values WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_option_values SELECT * FROM merchant_menu_option_values WHERE merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_item_option_groups WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_item_option_groups SELECT * FROM merchant_menu_item_option_groups WHERE merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_qr_codes WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_qr_codes SELECT * FROM merchant_ordering_qr_codes WHERE merchant_id='demo_beef_noodle';
DELETE FROM staging_demo_golden_admin_profile WHERE merchant_id='demo_beef_noodle';
INSERT INTO staging_demo_golden_admin_profile SELECT * FROM merchant_admin_profiles WHERE merchant_id='demo_beef_noodle';
`;

const directory = await mkdtemp(path.join(tmpdir(), "baiye-beef-demo-admin-"));
const sqlPath = path.join(directory, "provision.sql");
try {
  await writeFile(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
  const child = spawn("npx", ["wrangler", "d1", "execute", database, "--remote", "--config", "cloudflare-worker/wrangler.ordering-staging.jsonc", "--file", sqlPath], { stdio: ["ignore", "inherit", "inherit"], shell: process.platform === "win32" });
  const exitCode = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (code) => resolve(code ?? 1)); });
  if (exitCode !== 0) throw new Error(`Wrangler exited with ${exitCode}.`);
} finally {
  await rm(directory, { recursive: true, force: true });
}

// This is the only plaintext disclosure. It is not written to Git, D1, logs, or a bundle.
process.stdout.write(JSON.stringify({ username, initial_password: password, merchant_id: "demo_beef_noodle" }));
