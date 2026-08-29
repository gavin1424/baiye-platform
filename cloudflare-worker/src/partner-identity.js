const encoder = new TextEncoder();
const decoder = new TextDecoder();

const LETTER_VALUES = Object.freeze({
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17,
  I: 34, J: 18, K: 19, L: 20, M: 21, N: 22, O: 35, P: 23,
  Q: 24, R: 25, S: 26, T: 27, U: 28, V: 29, W: 32, X: 30,
  Y: 31, Z: 33,
});

function base64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export function normalizeTaiwanIdNumber(value) {
  return String(value || "").trim().toUpperCase();
}

export function isValidTaiwanIdNumber(value) {
  const normalized = normalizeTaiwanIdNumber(value);
  if (!/^[A-Z][12][0-9]{8}$/.test(normalized)) return false;
  const letterValue = LETTER_VALUES[normalized[0]];
  if (!letterValue) return false;
  const digits = normalized.slice(1).split("").map(Number);
  let checksum = Math.floor(letterValue / 10) + (letterValue % 10) * 9;
  for (let index = 0; index < 8; index += 1) checksum += digits[index] * (8 - index);
  checksum += digits[8];
  return checksum % 10 === 0;
}

export function maskTaiwanIdNumber(value) {
  const normalized = normalizeTaiwanIdNumber(value);
  return normalized.length >= 4 ? `******${normalized.slice(-4)}` : "******";
}

function requireSecret(value, name) {
  const secret = String(value || "");
  if (secret.length < 32) throw Object.assign(new Error(`${name} is not configured`), { code: "PARTNER_ID_SECURITY_UNAVAILABLE", status: 503 });
  return secret;
}

export async function hashPartnerIdNumber(value, secret) {
  const normalized = normalizeTaiwanIdNumber(value);
  if (!isValidTaiwanIdNumber(normalized)) throw Object.assign(new Error("請輸入正確的台灣身分證字號。"), { code: "INVALID_PARTNER_ID_NUMBER", status: 422 });
  const key = await crypto.subtle.importKey("raw", encoder.encode(requireSecret(secret, "PARTNER_ID_HASH_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(normalized)));
}

async function encryptionKey(secret) {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(requireSecret(secret, "PARTNER_ID_FIELD_ENCRYPTION_KEY")));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptPartnerIdNumber(value, secret) {
  const normalized = normalizeTaiwanIdNumber(value);
  if (!isValidTaiwanIdNumber(normalized)) throw Object.assign(new Error("請輸入正確的台灣身分證字號。"), { code: "INVALID_PARTNER_ID_NUMBER", status: 422 });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode("baiye-partner-id-v1") }, await encryptionKey(secret), encoder.encode(normalized));
  return `v1.${base64Url(iv)}.${base64Url(ciphertext)}`;
}

export async function decryptPartnerIdNumber(value, secret) {
  const [version, ivValue, ciphertextValue] = String(value || "").split(".");
  if (version !== "v1" || !ivValue || !ciphertextValue) throw Object.assign(new Error("Partner identity ciphertext is invalid"), { code: "PARTNER_ID_DECRYPTION_FAILED", status: 503 });
  try {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBase64Url(ivValue), additionalData: encoder.encode("baiye-partner-id-v1") }, await encryptionKey(secret), decodeBase64Url(ciphertextValue));
    return decoder.decode(plaintext);
  } catch {
    throw Object.assign(new Error("Partner identity decryption failed"), { code: "PARTNER_ID_DECRYPTION_FAILED", status: 503 });
  }
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function taipeiDateFromInstant(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid contract effective instant");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return isoDate(get("year"), get("month"), get("day"));
}

export function calculatePartnerContractPeriod(startDate, termMonths = 3) {
  const match = String(startDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || !Number.isInteger(termMonths) || termMonths <= 0) throw new Error("Invalid contract period");
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (day < 1 || day > daysInMonth(year, month)) throw new Error("Invalid contract period start");
  const targetIndex = year * 12 + (month - 1) + termMonths;
  const targetYear = Math.floor(targetIndex / 12), targetMonth = targetIndex % 12 + 1;
  let end;
  if (day > daysInMonth(targetYear, targetMonth)) {
    end = new Date(Date.UTC(targetYear, targetMonth, 0));
  } else {
    end = new Date(Date.UTC(targetYear, targetMonth - 1, day));
    end.setUTCDate(end.getUTCDate() - 1);
  }
  return { period_start: isoDate(year, month, day), period_end: isoDate(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()), term_months: termMonths, timezone: "Asia/Taipei" };
}

export function partnerPeriodDisplayStatus(periodEnd, todayTaipei = taipeiDateFromInstant()) {
  const end = new Date(`${periodEnd}T00:00:00Z`), today = new Date(`${todayTaipei}T00:00:00Z`);
  const remainingDays = Math.round((end.getTime() - today.getTime()) / 86400000);
  if (remainingDays < 0) return { status: "expired", remaining_days: remainingDays, reminders: [] };
  // The agreement remains effective through the end date in Asia/Taipei.
  if (remainingDays === 0) return { status: "expiring", remaining_days: 0, reminders: [7, 14, 30] };
  return { status: remainingDays <= 30 ? "expiring" : "active", remaining_days: remainingDays, reminders: [30, 14, 7].filter((day) => remainingDays <= day) };
}
