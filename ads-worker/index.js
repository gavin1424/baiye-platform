import { handleLeadRequest } from "../cloudflare-worker/src/leads.js";

const origins = new Set(["https://baiyeconnect.com", "https://www.baiyeconnect.com", "http://localhost:4173", "http://127.0.0.1:4173"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const headers = origin && origins.has(origin) ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "Origin" } : null;
    if (url.pathname === "/health" && request.method === "GET") return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
    if (url.pathname !== "/api/leads") return new Response("Not found", { status: 404 });
    if (!headers) return new Response("Origin not allowed", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    return handleLeadRequest(request, env, headers);
  },
};
