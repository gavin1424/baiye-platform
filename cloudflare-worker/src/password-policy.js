const BLOCKED = new Set([
  "password", "password123", "123456789", "qwerty123", "letmein123",
  "admin123", "welcome123", "baiyeconnect", "changeme123",
]);

export function validateMerchantPassword(value) {
  const password = String(value || "");
  if (password.length < 12) return { ok: false, error: "PASSWORD_TOO_SHORT" };
  if (password.length > 256) return { ok: false, error: "PASSWORD_TOO_LONG" };
  if (BLOCKED.has(password.toLowerCase())) return { ok: false, error: "PASSWORD_BLOCKED" };
  return { ok: true };
}

export async function passwordBlocklistCheck(value, env = {}) {
  const local = validateMerchantPassword(value);
  if (!local.ok) return local;
  if (env.PASSWORD_BLOCKLIST_ADAPTER?.check) return env.PASSWORD_BLOCKLIST_ADAPTER.check(String(value));
  return local;
}
