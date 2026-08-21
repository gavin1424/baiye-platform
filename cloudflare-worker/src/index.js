import { AI_MODEL, BUSINESS, HUMAN_HANDOFF, SYSTEM_PROMPT } from "./business.js";
import { handleFinanceRequest } from "./finance.js";
import { handlePartnerRequest } from "./partner.js";

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
        "access-control-allow-headers": "content-type, authorization",
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

async function replyToLine(replyToken, reply, accessToken) {
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text: reply.slice(0, 5000) }] }),
  });
  if (!response.ok) console.error("LINE Reply API failed", response.status);
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);
    const cors = corsHeaders(origin);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "創百業智慧鏈 AI" });
    }

    if (url.pathname.startsWith("/api/finance") || url.pathname.startsWith("/api/payments/webhook/")) {
      if (request.method === "OPTIONS") return origin ? new Response(null, { status: 204, headers: cors }) : json({ error: "Origin not allowed" }, 403);
      if (url.pathname.startsWith("/api/finance") && !origin) return json({ error: "Origin not allowed" }, 403);
      return handleFinanceRequest(request, env, url, cors);
    }

    if (url.pathname.startsWith("/api/partner") || url.pathname.startsWith("/api/admin/")) {
      if (request.method === "OPTIONS") return origin ? new Response(null, { status: 204, headers: cors }) : json({ error: "Origin not allowed" }, 403);
      if (!origin) return json({ error: "Origin not allowed" }, 403);
      return handlePartnerRequest(request, env, url, cors);
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

    return json({ error: "Not found" }, 404);
  },
};
