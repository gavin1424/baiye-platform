const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
const field = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function handleLeadRequest(request, env, cors) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
  if (Number(request.headers.get("content-length") || 0) > 12000) return json({ error: "Payload too large" }, 413, cors);
  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, cors); }
  if (input?.website) return json({ ok: true }, 200, cors);
  const name = field(input?.name, 80);
  const shopName = field(input?.shopName, 100);
  const phone = field(input?.phone, 20);
  const lineId = field(input?.lineId, 80);
  const email = field(input?.email, 150);
  const industry = field(input?.industry, 80);
  const hasWebsite = field(input?.hasWebsite, 20);
  const hasOrdering = field(input?.hasOrdering, 20);
  const interests = field(input?.interests, 1500);
  const page = field(input?.page, 500);
  if (!name || !/^[0-9+() -]{8,20}$/.test(phone) || !industry || input?.consent !== "yes" || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return json({ error: "Invalid lead details" }, 400, cors);
  }
  const attribution = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid"]) attribution[key] = field(input?.attribution?.[key], 250);
  const id = crypto.randomUUID();
  try {
    await env.FINANCE_DB.prepare("INSERT INTO ads_leads (id,name,shop_name,phone,line_id,email,industry,has_website,has_ordering,interests,attribution,page) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id, name, shopName, phone, lineId, email, industry, hasWebsite, hasOrdering, interests, JSON.stringify(attribution), page).run();
    return json({ ok: true, id }, 201, cors);
  } catch (error) {
    console.error("Lead storage failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Unable to save lead" }, 503, cors);
  }
}
