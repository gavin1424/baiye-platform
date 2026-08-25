import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || "");
const name = String(process.env.ADMIN_NAME || "平台超級管理員").trim();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 14) {
  throw new Error("請以環境變數提供 ADMIN_EMAIL 與至少 14 字元的 ADMIN_PASSWORD。憑證不會寫入 Git。" );
}
const salt = randomBytes(24).toString("base64url");
const iterations = 400000;
let derived = Buffer.from(password, "utf8");
for (let round = 0; round < iterations / 100000; round += 1) {
  derived = pbkdf2Sync(derived, Buffer.from(`${salt}:${round}`, "utf8"), 100000, 32, "sha256");
}
const hash = derived.toString("base64url");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sql = `INSERT INTO admin_users (id,email,display_name,password_hash,password_salt,password_iterations,role,status) VALUES (${quote(`admin_${randomUUID()}`)},${quote(email)},${quote(name)},${quote(hash)},${quote(salt)},${iterations},'super_admin','active') ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,password_hash=excluded.password_hash,password_salt=excluded.password_salt,password_iterations=excluded.password_iterations,role='super_admin',status='active',updated_at=CURRENT_TIMESTAMP;`;
const dir = await mkdtemp(join(tmpdir(), "baiye-admin-bootstrap-"));
const file = join(dir, "bootstrap.sql");
try {
  await writeFile(file, sql, { encoding: "utf8", mode: 0o600 });
  const result = spawnSync("npx", ["wrangler", "d1", "execute", "baiye-finance", "--remote", "--file", file], { stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status || 1);
  console.log("正式超級管理員已安全建立／更新。請立即清除目前 shell 的 ADMIN_PASSWORD 環境變數。" );
} finally {
  await rm(dir, { recursive: true, force: true });
}
