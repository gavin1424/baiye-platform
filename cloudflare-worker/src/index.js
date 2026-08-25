import { AI_MODEL, BUSINESS, HUMAN_HANDOFF, SYSTEM_PROMPT } from "./business.js";
import { handleFinanceRequest } from "./finance.js";
import { handlePartnerRequest, runPartnerDailyMaintenance } from "./partner.js";
import { handleAiAdminRequest, handleMeilingWebsiteChat, processMeilingLineText } from "./meiling-ai.js";
import { handleBookingAdminRequest, handleBookingRequest, runBookingReminders } from "./booking.js";
import { handleAdminAuth, requireAdmin } from "./admin-auth.js";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 10;
const HUMAN_REVIEW_TERMS = ["報價", "費用", "多少錢", "價格", "付款", "簽約", "合約", "退款", "政府補助", "補助", "法律", "保證", "承諾"];

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8", ...headers },
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim());
  return allowed.includes(origin) ? origin : null;
}

function corsHeaders(origin) {
  return origin
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
        "access-control-allow-headers": "content-type, authorization, idempotency-key, x-csrf-token",
        "access-control-max-age": "86400",
        "access-control-allow-credentials": "true",
        vary: "Origin",
      }
    : {};
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({ role: item.role, content: item.content.trim().slice(0, MAX_MESSAGE_LENGTH) }))
    .filter((item) => item.content.length > 0);
}

function requiresHumanReview(message) {
  return HUMAN_REVIEW_TERMS.some((term) => message.includes(term));
}

async function generateReply(message, history, env) {
  if (requiresHumanReview(message)) return HUMAN_HANDOFF;
  if (message.includes(BUSINESS.officialCase.name)) {
    return `是的，${BUSINESS.officialCase.name}是創百業智慧鏈的正式網站案例。可直接瀏覽：${BUSINESS.officialCase.url}`;
  }

  const result = await env.AI.run(AI_MODEL, {
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history, { role: "user", content: message }],
    max_tokens: 420,
    temperature: 0.2,
  });
  const reply = typeof result?.response === "string" ? result.response.trim() : "";
  return reply ? reply.slice(0, 1200) : HUMAN_HANDOFF;
}

function toBase64(bytes) {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let index = 0; index < view.length; index += 0x8000) {
    binary += String.fromCharCode(...view.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function validLineSignature(body, signature, secret) {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return constantTimeEqual(toBase64(signatureBytes), signature);
}

function lineStage(requestId, stage, detail = {}) {
  console.log(JSON.stringify({ service: "meiling_line", request_id: requestId, stage, ...detail }));
}

async function replyToLine(replyToken, reply, accessToken, requestId = "legacy") {
  lineStage(requestId, "line_reply_called");
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text: reply.slice(0, 5000) }] }),
  });
  if (response.ok) {
    lineStage(requestId, "line_reply_success", { http_status: response.status });
    return true;
  }
  let lineError = "LINE_REPLY_FAILED";
  try {
    const payload = await response.json();
    if (typeof payload?.message === "string") lineError = payload.message.slice(0, 120);
  } catch { /* Do not log the raw response body. */ }
  console.error(JSON.stringify({ service: "meiling_line", request_id: requestId, stage: "line_reply_failed", http_status: response.status, error: lineError }));
  return false;
}

async function handleLine(request, env) {
  if (!env.LINE_CHANNEL_SECRET || !env.LINE_CHANNEL_ACCESS_TOKEN) {
    return json({ error: "LINE integration is not configured" }, 503);
  }
  const body = await request.text();
  const signature = request.headers.get("x-line-signature") || "";
  if (!(await validLineSignature(body, signature, env.LINE_CHANNEL_SECRET))) {
    return json({ error: "Invalid LINE signature" }, 401);
  }

  const payload = JSON.parse(body);
  const events = Array.isArray(payload.events) ? payload.events : [];
  await Promise.all(events.map(async (event) => {
    if (event.type !== "message" || event.message?.type !== "text" || !event.replyToken) return;
    const message = String(event.message.text || "").trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!message) return;
    const reply = await generateReply(message, [], env);
    await replyToLine(event.replyToken, reply, env.LINE_CHANNEL_ACCESS_TOKEN);
  }));
  return json({ ok: true });
}

async function handleMeilingLine(request, env, ctx) {
  if (!env.LINE_MEILING_CHANNEL_SECRET || !env.LINE_MEILING_CHANNEL_ACCESS_TOKEN) {
    return json({ error: "Meiling LINE integration is not configured" }, 503);
  }
  const rawBody = await request.text();
  let payload;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON" }, 400); }
  const events = Array.isArray(payload.events) ? payload.events : [];
  for (const event of events) lineStage(String(event.webhookEventId || event.message?.id || "unknown").slice(0, 200), "received");
  const signature = request.headers.get("x-line-signature") || "";
  const channelSecret = env.LINE_MEILING_CHANNEL_SECRET.match(/[a-f0-9]{32}/i)?.[0] || env.LINE_MEILING_CHANNEL_SECRET;
  if (!(await validLineSignature(rawBody, signature, channelSecret))) {
    for (const event of events) lineStage(String(event.webhookEventId || event.message?.id || "unknown").slice(0, 200), "signature_invalid");
    return json({ error: "Invalid LINE signature" }, 401);
  }
  for (const event of events) lineStage(String(event.webhookEventId || event.message?.id || "unknown").slice(0, 200), "signature_valid");
  const processing = Promise.all(events.map(async (event) => {
    if (event.type !== "message" || event.message?.type !== "text" || !event.replyToken) return;
    const requestId = String(event.webhookEventId || event.message?.id || "unknown").slice(0, 200);
    let replied = false;
    const deliver = async (reply) => {
      if (replied) return false;
      const delivered = await replyToLine(event.replyToken, reply, env.LINE_MEILING_CHANNEL_ACCESS_TOKEN, requestId);
      if (delivered) replied = true;
      return delivered;
    };
    try { await processMeilingLineText(event, env, deliver); }
    catch (error) {
      console.error(JSON.stringify({ service: "meiling_line", request_id: requestId, stage: "processing_failed", error: error instanceof Error ? error.message : "unknown" }));
      if (!replied) await deliver("智能客服目前暫時忙碌中，請稍後再試，或直接留言讓店家協助您。");
    }
  }));
  if (ctx?.waitUntil) ctx.waitUntil(processing.catch((error) => console.error(JSON.stringify({ service: "meiling_line", stage: "background_failed", error: error instanceof Error ? error.message : "unknown" }))));
  else await processing;
  return json({ ok: true, merchant_id: "meiling_patchwork" });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);
    const cors = corsHeaders(origin);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "創百業智慧鏈", checks: { worker: "ok", d1: Boolean(env.FINANCE_DB), r2: Boolean(env.CONTRACTS_BUCKET), ai: Boolean(env.OPENAI_API_KEY), line: Boolean(env.LINE_MEILING_CHANNEL_SECRET) } });
    }

    if (url.pathname.startsWith("/api/admin/auth/")) {
      if (request.method === "OPTIONS") return origin ? new Response(null, { status: 204, headers: cors }) : json({ error: "Origin not allowed" }, 403);
      if (!origin) return json({ error: "Origin not allowed" }, 403);
      return (await handleAdminAuth(request, env, url, cors)) || json({ error: "Not found" }, 404, cors);
    }

    if (url.pathname === "/widgets/meiling-chat-widget.js" && request.method === "GET") {
      const widget = await env.CONTRACTS_BUCKET.get("public/meiling-chat-widget.js");
      if (!widget) return json({ error: "Widget not found" }, 404);
      return new Response(widget.body, { headers: { "content-type": "application/javascript; charset=UTF-8", "cache-control": "public, max-age=300, s-maxage=3600", "access-control-allow-origin": "*", etag: widget.httpEtag } });
    }

    if (url.pathname === "/widgets/meiling-booking.js" && request.method === "GET") {
      const widget = await env.CONTRACTS_BUCKET.get("public/meiling-booking.js");
      if (!widget) return json({ error: "Booking widget not found" }, 404);
      return new Response(widget.body, { headers: { "content-type": "application/javascript; charset=UTF-8", "cache-control": "public, max-age=300, s-maxage=3600", "access-control-allow-origin": "*", etag: widget.httpEtag } });
    }

    if (url.pathname.startsWith("/api/finance") || url.pathname.startsWith("/api/payments/webhook/")) {
      if (request.method === "OPTIONS") return origin ? new Response(null, { status: 204, headers: cors }) : json({ error: "Origin not allowed" }, 403);
      if (url.pathname.startsWith("/api/finance") && !origin) return json({ error: "Origin not allowed" }, 403);
      if (!url.pathname.startsWith("/api/payments/webhook/") && !(await requireAdmin(request, env))) return json({ error: "需要正式管理員授權。" }, 401, cors);
      return handleFinanceRequest(request, env, url, cors, true);
    }

    if (url.pathname.startsWith("/api/partner") || url.pathname.startsWith("/api/admin/")) {
      if (request.method === "OPTIONS") return origin ? new Response(null, { status: 204, headers: cors }) : json({ error: "Origin not allowed" }, 403);
      if (!origin) return json({ error: "Origin not allowed" }, 403);
      const adminSession = url.pathname.startsWith("/api/admin/") ? await requireAdmin(request, env) : null;
      if (url.pathname.startsWith("/api/admin/") && !adminSession) return json({ error: "需要正式管理員授權。" }, 401, cors);
      if (url.pathname.startsWith("/api/admin/ai")) return handleAiAdminRequest(request, env, url, cors, true);
      if (url.pathname.startsWith("/api/admin/booking")) return handleBookingAdminRequest(request, env, url, cors, true);
      return handlePartnerRequest(request, env, url, cors, Boolean(adminSession));
    }

    if (url.pathname.startsWith("/api/merchant/") && url.pathname.includes("/booking")) {
      if (request.method === "OPTIONS") return origin ? new Response(null, { status: 204, headers: cors }) : json({ error: "Origin not allowed" }, 403);
      if (!origin) return json({ error: "Origin not allowed" }, 403);
      return (await handleBookingRequest(request, env, url, cors)) || json({ error: "Not found" }, 404, cors);
    }

    if (url.pathname === "/api/merchant/meiling/chat") {
      if (request.method === "OPTIONS") return origin ? new Response(null, { status: 204, headers: cors }) : json({ error: "Origin not allowed" }, 403);
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
      if (!origin) return json({ error: "Origin not allowed" }, 403);
      try { return await handleMeilingWebsiteChat(request, env, cors); }
      catch (error) {
        console.error("Meiling website AI failed", error instanceof Error ? error.message : "unknown error");
        return json({ reply: "智能客服目前暫時忙碌中，請稍後再試，或直接留言讓店家協助您。", code: "AI_INTERNAL_ERROR" }, 200, cors);
      }
    }

    if (url.pathname === "/chat") {
      if (request.method === "OPTIONS") {
        return origin ? new Response(null, { status: 204, headers: cors }) : json({ error: "Origin not allowed" }, 403);
      }
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
      if (!origin) return json({ error: "Origin not allowed" }, 403);
      try {
        const payload = await request.json();
        const message = typeof payload?.message === "string" ? payload.message.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
        if (!message) return json({ error: "message is required" }, 400, cors);
        const reply = await generateReply(message, sanitizeHistory(payload.history), env);
        return json({ reply }, 200, cors);
      } catch (error) {
        console.error("Chat request failed", error instanceof Error ? error.message : "unknown error");
        return json({ reply: HUMAN_HANDOFF }, 200, cors);
      }
    }

    if (url.pathname === "/line" && request.method === "POST") {
      try {
        return await handleLine(request, env);
      } catch (error) {
        console.error("LINE webhook failed", error instanceof Error ? error.message : "unknown error");
        return json({ error: "LINE webhook failed" }, 500);
      }
    }


    if (url.pathname === "/webhooks/line/meiling" && request.method === "POST") {
      try { return await handleMeilingLine(request, env, ctx); }
      catch (error) {
        console.error("Meiling LINE webhook failed", error instanceof Error ? error.message : "unknown error");
        return json({ error: "Meiling LINE webhook failed" }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runPartnerDailyMaintenance(env));
    ctx.waitUntil(runBookingReminders(env));
  },
};
