import { handleOrderingRequest } from "./qr-ordering.js";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers },
});

function safeToken(value) {
  const token = String(value || "").trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(token) ? token : "";
}

async function inputOf(request) {
  try { return await request.json(); } catch { return {}; }
}

function orderingRequest(request, url, token, action, body) {
  const target = new URL(url);
  target.pathname = `/api/ordering/qr/${encodeURIComponent(token)}/${action}`;
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  return {
    target,
    request: new Request(target.toString(), {
      method: action === "context" ? "GET" : "POST",
      headers,
      body: action === "context" ? undefined : JSON.stringify(body),
    }),
  };
}

// Compatibility for main@5635f62 QR entry points. Identity and persistence are
// deliberately delegated to the phone-only Platform Member / Ordering core.
export async function handleSharedQrMembershipCompatibility(request, env, url, cors) {
  if (url.pathname === "/api/join/resolve" && request.method === "POST") {
    const input = await inputOf(request);
    const token = safeToken(input.token);
    if (!token) return json({ error: "此 QR Code 目前無法使用。" }, 404, cors);
    const forwarded = orderingRequest(request, url, token, "context");
    const response = await handleOrderingRequest(forwarded.request, env, forwarded.target, cors);
    if (!response.ok) return response;
    const payload = await response.json();
    const context = payload.context;
    return json({
      merchant: { id: context.merchant_id, name: context.display_name },
      qr: context.qr,
      member: payload.member || null,
      redirect_path: `/q/${token}`,
      identity_core: "phone_only_platform_member",
    }, 200, cors);
  }

  if (url.pathname === "/api/join/complete" && request.method === "POST") {
    const input = await inputOf(request);
    const token = safeToken(input.token);
    if (!token) return json({ error: "此 QR Code 目前無法使用。" }, 404, cors);
    const forwarded = orderingRequest(request, url, token, "join", {
      phone: input.phone,
      privacy_consent: input.privacy_consent,
      consent_version: input.consent_version,
    });
    const response = await handleOrderingRequest(forwarded.request, env, forwarded.target, cors);
    if (!response.ok) return response;
    const payload = await response.json();
    return json({ ...payload, redirect_path: `/q/${token}`, identity_core: "phone_only_platform_member" }, 200, cors);
  }

  if (["/api/member/register", "/api/member/login"].includes(url.pathname)) {
    return json({
      error: "平台會員已改用手機免密碼流程。",
      code: "PHONE_ONLY_MEMBERSHIP_REQUIRED",
      next: "/member/join",
    }, 410, cors);
  }

  return null;
}
