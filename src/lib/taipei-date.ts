const TAIPEI_TIME_ZONE = "Asia/Taipei";

function parts(date: Date) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(values.map((item) => [item.type, item.value]));
}

function dateString(date: Date) {
  const value = parts(date);
  return `${value.year}-${value.month}-${value.day}`;
}

export function getTaipeiToday(now = new Date()) {
  return dateString(now);
}

export function getTaipeiMonthStart(now = new Date()) {
  return `${getTaipeiToday(now).slice(0, 7)}-01`;
}

export function getTaipeiMonthEnd(now = new Date()) {
  const today = getTaipeiToday(now);
  const [year, month] = today.split("-").map(Number);
  return dateString(new Date(Date.UTC(year, month, 0, 12)));
}

export function taipeiDateToUtcStart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new TypeError("台灣日期格式錯誤");
  return new Date(`${value}T00:00:00+08:00`).toISOString();
}

export function taipeiDateToUtcEndExclusive(value: string) {
  const start = new Date(taipeiDateToUtcStart(value));
  start.setUTCDate(start.getUTCDate() + 1);
  return start.toISOString();
}

export function formatTaipeiDate(value: string | Date) {
  return dateString(value instanceof Date ? value : new Date(value));
}

export { TAIPEI_TIME_ZONE };
