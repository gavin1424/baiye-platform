/** QR ordering amounts are stored and transported as integer minor units. */
export function formatOrderingMoney(minor: number, currency = "TWD") {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor || 0) / 100);
}

export function orderingDollarsToMinor(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function orderingMinorToDollars(minor: number) {
  return Number(minor || 0) / 100;
}
