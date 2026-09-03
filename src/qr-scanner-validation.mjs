const QR_PATH = /^\/q\/([A-Za-z0-9_-]{8,64})$/;

export function orderingRouteFromQrValue(rawValue, currentOrigin) {
  const raw = String(rawValue || "").trim();
  if (!raw || /^(javascript|data):/i.test(raw)) return "";
  try {
    const parsed = new URL(raw, `${currentOrigin}/`);
    const allowedOrigins = new Set([currentOrigin, "https://baiyeconnect.com", "https://www.baiyeconnect.com"]);
    if (!allowedOrigins.has(parsed.origin)) return "";
    const hashPath = parsed.hash.startsWith("#/") ? parsed.hash.slice(1) : "";
    const directPath = !parsed.hash && parsed.origin === currentOrigin ? parsed.pathname : "";
    const match = (hashPath || directPath).match(QR_PATH);
    return match ? `/q/${match[1]}` : "";
  } catch {
    return "";
  }
}
