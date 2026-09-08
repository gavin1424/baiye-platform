const E = new TextEncoder();
const ITERATIONS = 600000;
const SEGMENT = 100000;

const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

function randomSalt() {
  return b64(crypto.getRandomValues(new Uint8Array(32)));
}

async function pbkdf2(input, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", input, "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: E.encode(salt), iterations }, key, 256));
}

export async function deriveNumericPassword(password, salt, iterations = ITERATIONS) {
  let material = E.encode(String(password));
  for (let index = 0; index < Math.ceil(iterations / SEGMENT); index += 1) {
    material = await pbkdf2(material, `${salt}:${index}`, Math.min(SEGMENT, iterations - index * SEGMENT));
  }
  return b64(material);
}

export function validateNumericPassword(password, _phone = "") {
  const value = String(password || "");
  if (!/^[0-9]{8}$/.test(value)) return { ok: false, error: "請輸入 8 位數字密碼。" };
  return { ok: true };
}

export function constantTimeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let value = 0;
  for (let index = 0; index < left.length; index += 1) value |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return value === 0;
}

export async function createNumericCredentialMaterial(password) {
  const passwordSalt = randomSalt();
  return {
    password_hash: await deriveNumericPassword(password, passwordSalt, ITERATIONS),
    password_salt: passwordSalt,
    password_algorithm: "pbkdf2-sha256-segmented-v1",
    password_iterations: ITERATIONS,
  };
}

export async function verifyNumericCredential(password, credential) {
  const fallbackSalt = "baiye-common-auth-constant-time-fallback-v1";
  const supplied = await deriveNumericPassword(password || "invalid", credential?.password_salt || fallbackSalt, Number(credential?.password_iterations || ITERATIONS));
  return Boolean(credential?.status === "active" && !Number(credential?.reset_required || 0) && constantTimeEqual(supplied, credential.password_hash));
}

export function upsertPlatformCredentialStatement(db, platformMemberId, material, id = `pmlc_${crypto.randomUUID()}`) {
  return db.prepare(`INSERT INTO platform_member_login_credentials
    (id,platform_member_id,credential_type,password_hash,password_salt,password_algorithm,password_iterations,password_updated_at)
    VALUES(?,?,'numeric_password_8',?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(platform_member_id,credential_type) DO UPDATE SET
      password_hash=excluded.password_hash,password_salt=excluded.password_salt,
      password_algorithm=excluded.password_algorithm,password_iterations=excluded.password_iterations,
      failed_attempts=0,locked_until=NULL,reset_required=0,status='active',
      password_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`)
    .bind(id, platformMemberId, material.password_hash, material.password_salt, material.password_algorithm, material.password_iterations);
}

export async function platformCredentialByMember(db, platformMemberId) {
  return db.prepare("SELECT * FROM platform_member_login_credentials WHERE platform_member_id=? AND credential_type='numeric_password_8' LIMIT 1").bind(platformMemberId).first();
}
