export const TAIPEI_TIME_ZONE = "Asia/Taipei";

export function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function taipeiDateToUtcStart(value) {
  if (!isDate(value)) throw new TypeError("台灣日期格式錯誤");
  return new Date(`${value}T00:00:00+08:00`).toISOString();
}

export function taipeiDateToUtcEndExclusive(value) {
  const date = new Date(taipeiDateToUtcStart(value));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export function formatTaipeiDate(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
