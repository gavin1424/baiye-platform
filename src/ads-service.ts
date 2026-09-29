export const LEAD_API = (import.meta.env.VITE_LEAD_API_URL || "https://baiye-ads-leads.baiye-platform.workers.dev/api/leads").trim();
const adsId = (import.meta.env.VITE_GOOGLE_ADS_ID || "").trim();
const conversionLabel = (import.meta.env.VITE_GOOGLE_ADS_CONVERSION_LABEL || "").trim();

declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; }
}

const attributionKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid"] as const;

export function attribution() {
  const query = new URLSearchParams(window.location.search);
  const saved = JSON.parse(sessionStorage.getItem("baiye_attribution") || "{}");
  const values: Record<string, string> = {};
  for (const key of attributionKeys) values[key] = (query.get(key) || saved[key] || "").slice(0, 250);
  sessionStorage.setItem("baiye_attribution", JSON.stringify(values));
  return values;
}

export function initAdsTracking() {
  attribution();
  if (!/^AW-\d+$/.test(adsId) || window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => { window.dataLayer?.push(args); };
  window.gtag("js", new Date());
  window.gtag("config", adsId);
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(adsId)}`;
  document.head.appendChild(script);
}

export function trackAdsEvent(name: "lead_form_submit" | "line_click" | "phone_click" | "pricing_click" | "contact_click" | "hero_cta_click") {
  window.gtag?.("event", name, attribution());
  if (name === "lead_form_submit" && /^AW-\d+$/.test(adsId) && conversionLabel) {
    window.gtag?.("event", "conversion", { send_to: `${adsId}/${conversionLabel}` });
  }
}

export async function submitLead(payload: Record<string, unknown>) {
  const response = await fetch(LEAD_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, attribution: attribution(), page: window.location.href }),
  });
  if (!response.ok) throw new Error("資料暫時無法送出，請改用 LINE 或電話聯絡。 ");
  return response.json();
}
