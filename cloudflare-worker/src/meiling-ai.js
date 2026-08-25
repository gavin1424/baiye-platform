import { bookingAvailabilityReply } from "./booking.js";

export const MEILING_MERCHANT_ID = "meiling_patchwork";
export const MEILING_MONTHLY_LIMIT = 60;
export const MEILING_MODEL = "gpt-5.6-luna";
export const MEILING_MAX_OUTPUT_TOKENS = 300;

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_TIMEOUT_MS = 25_000;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 6;
const MAX_PAYLOAD_BYTES = 16_384;
const WEBSITE_SESSION_REQUESTS_PER_MINUTE = 4;
const WEBSITE_IP_REQUESTS_PER_MINUTE = 8;
const LOW_QUOTA_THRESHOLD = 50;
const INPUT_USD_PER_MILLION = 0.2;
const OUTPUT_USD_PER_MILLION = 1.2;

export const MEILING_QUOTA_MESSAGE = "本月智能客服使用額度已達上限，如需進一步詢問，請直接留言，店家會由真人協助您。";
export const MEILING_BUSY_MESSAGE = "智能客服目前暫時忙碌中，請稍後再試，或直接留言讓店家協助您。";
export const MEILING_HUMAN_HANDOFF = "這個問題需要由店家本人確認，請留下您的需求，店家會再協助您。";
export const MEILING_UNKNOWN_MESSAGE = "這部分目前需要由店家本人確認，我可以請您直接留言說明需求，由店家協助您。";

function lineAiStage(channel, requestId, stage, detail = {}) {
  if (channel !== "line") return;
  console.log(JSON.stringify({ service: "meiling_line", request_id: requestId, stage, ...detail }));
}

export const MEILING_KEYWORD_REPLIES = new Map([
  ["課程", "想了解拼布課程嗎？您可以點選下方「課程報名」查看最新資訊；若近期課程尚未公告，也可以直接留言詢問想學的內容。"],
  ["上課", "想了解拼布課程嗎？您可以點選下方「課程報名」查看最新資訊；若近期課程尚未公告，也可以直接留言詢問想學的內容。"],
  ["客製", "美玲拼布提供客製手作服務。請告訴我們想製作的品項、用途、尺寸、數量與預算需求，我們會再協助確認。"],
  ["商品", "可以點選下方「商品選購」查看目前作品與商品。如果看到喜歡的作品，也可以直接截圖傳給我們詢問。"],
  ["地址", "上課或取件地點請直接留言確認，我們會提供最新資訊。"],
  ["怎麼去", "上課或取件地點請直接留言確認，我們會提供最新資訊。"],
]);

export const MEILING_BOOKING_REPLIES = new Map([
  ["我要預約", "可以，請到美玲拼布線上預約頁選擇服務、日期與時間：https://meilingpatchwork.com/booking/"],
  ["想預約", "可以，請到美玲拼布線上預約頁選擇服務、日期與時間：https://meilingpatchwork.com/booking/"],
  ["預約課程", "可以，請到美玲拼布線上預約頁選擇服務、日期與時間：https://meilingpatchwork.com/booking/"],
  ["我要報名", "可以，請到美玲拼布線上預約頁選擇服務、日期與時間：https://meilingpatchwork.com/booking/"],
]);

export const MEILING_KNOWLEDGE = Object.freeze({
  brand: {
    name: "美玲拼布",
    formal_name: "陳美玲兩岸宮廷女紅非遺培訓基地",
    positioning: ["拼布手作", "女紅工藝", "刺繡", "珠繡", "編織", "生活布藝", "文化傳承", "手作教學"],
    website: "https://meilingpatchwork.com/",
    about_url: "https://meilingpatchwork.com/about/",
  },
  services: [
    "拼布與生活布藝創作",
    "宮廷刺繡與女紅基礎",
    "珠繡、編織與裝飾技法",
    "團體、親子與文化研習",
    "作品、材料與客製需求洽詢",
  ],
  courses: {
    url: "https://meilingpatchwork.com/courses/",
    directions: ["宮廷刺繡與女紅基礎", "拼布與生活布藝創作", "珠繡、編織與裝飾技法", "團體、親子與文化研習"],
    dates: "unknown",
    prices: "unknown",
    location: "unknown",
    policy: "正式課表、材料清單、授課地點與費用需由店家依課程內容與人數確認。",
  },
  products: {
    url: "https://meilingpatchwork.com/products/",
    gallery_url: "https://meilingpatchwork.com/gallery/",
    examples: ["刺繡工具收納組", "療癒布藝點心", "刺繡壁飾", "拼布托特包", "藤籃針插套組", "刺繡針具收納組"],
    ecommerce: false,
    prices: "unknown",
    inventory: "unknown",
    payment: "unknown",
    policy: "網站目前不開放下單與金流；作品、材料、價格、庫存、付款與運送均需另行確認。",
  },
  custom_service: {
    available: true,
    examples: ["拼布包", "布藝作品", "刺繡配件", "材料包規劃", "客製贈禮"],
    policy: "請先說明品項、用途、尺寸、數量、風格、預算需求與期望時間，實際可行性、報價與工期由店家確認。",
  },
  contact_policy: {
    line_id: "@552qnkgn",
    add_friend_url: "https://lin.ee/SdFAst4",
    public_address: "unknown",
    phone: "unknown",
    rule: "上課或取件地點、正式聯絡方式均由店家提供最新資訊，不得自行推測。",
  },
  faq: {
    course: MEILING_KEYWORD_REPLIES.get("課程"),
    custom: MEILING_KEYWORD_REPLIES.get("客製"),
    product: MEILING_KEYWORD_REPLIES.get("商品"),
    address: MEILING_KEYWORD_REPLIES.get("地址"),
  },
  verified_sources: [
    "https://meilingpatchwork.com/",
    "https://meilingpatchwork.com/about/",
    "https://meilingpatchwork.com/courses/",
    "https://meilingpatchwork.com/gallery/",
    "https://meilingpatchwork.com/products/",
  ],
});

const HIGH_RISK_TERMS = [
  "退款", "退費", "退貨", "賠償", "法律", "責任", "客訴", "投訴", "特殊折扣", "折扣",
  "大量採購", "批發價", "特殊報價", "匯款", "付款證明", "付款狀態", "信用卡", "個資", "身分證",
];

const KNOWLEDGE_ROUTES = [
  { terms: ["課程", "上課", "教學", "研習", "親子", "學習"], keys: ["courses", "contact_policy"] },
  { terms: ["商品", "作品", "材料", "庫存", "購買", "下單"], keys: ["products", "contact_policy"] },
  { terms: ["客製", "訂製", "禮物", "贈禮", "提袋", "收納"], keys: ["custom_service", "contact_policy"] },
  { terms: ["地址", "地點", "怎麼去", "電話", "聯絡", "LINE"], keys: ["contact_policy"] },
];

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8", ...headers },
  });
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function base64Url(bytes) {
  let binary = "";
  for (const value of new Uint8Array(bytes)) binary += String.fromCharCode(value);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value) {
  return base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function decodeBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

export function periodMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

export function fixedReplyFor(message) {
  return MEILING_KEYWORD_REPLIES.get(String(message || "").trim()) || null;
}

export function requiresMeilingHuman(message) {
  return HIGH_RISK_TERMS.some((term) => String(message || "").includes(term));
}

export function sanitizeMeilingHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({ role: item.role, content: item.content.trim().slice(0, MAX_MESSAGE_LENGTH) }))
    .filter((item) => item.content);
}

function relevantKnowledge(message) {
  const selected = new Set(["brand", "services"]);
  for (const route of KNOWLEDGE_ROUTES) {
    if (route.terms.some((term) => message.includes(term))) route.keys.forEach((key) => selected.add(key));
  }
  if (selected.size === 2) selected.add("contact_policy");
  return Object.fromEntries([...selected].map((key) => [key, MEILING_KNOWLEDGE[key]]));
}

export function buildMeilingInstructions(message) {
  return [
    "你是「美玲拼布」官方智能客服。使用繁體中文與台灣用語，語氣親切、簡潔、自然、不過度推銷。一般回答以 2～5 句為主，不大量使用 Emoji。",
    "只能依照下方已驗證的品牌資料回答。不得自行編造價格、地址、課程日期、庫存、優惠、付款狀態、商品規格、製作工期或退款承諾。",
    `資料不足時，回答：「${MEILING_UNKNOWN_MESSAGE}」`,
    `遇到退款爭議、法律責任、賠償、特殊折扣、大量採購特殊報價、客訴、特殊付款或未公開個資時，回答：「${MEILING_HUMAN_HANDOFF}」`,
    `已驗證品牌資料：${JSON.stringify(relevantKnowledge(message))}`,
  ].join("\n");
}

export function extractOutputText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  const text = Array.isArray(response?.output)
    ? response.output.flatMap((item) => Array.isArray(item?.content) ? item.content : [])
      .filter((item) => item?.type === "output_text" && typeof item.text === "string")
      .map((item) => item.text.trim())
      .filter(Boolean)
      .join("\n")
    : "";
  return text.trim();
}

export function estimateCostUsd(inputTokens, outputTokens) {
  return (Number(inputTokens || 0) * INPUT_USD_PER_MILLION + Number(outputTokens || 0) * OUTPUT_USD_PER_MILLION) / 1_000_000;
}

async function claimRequest(db, channel, requestId, eventType = "AI_REPLY") {
  const result = await db.prepare(
    "INSERT OR IGNORE INTO merchant_ai_logs (id,merchant_id,channel,request_id,event_type,status) VALUES (?,?,?,?,?,'received')",
  ).bind(id("ailog"), MEILING_MERCHANT_ID, channel, requestId, eventType).run();
  return Number(result.meta?.changes || 0) === 1;
}

async function updateLog(db, channel, requestId, values) {
  await db.prepare(
    `UPDATE merchant_ai_logs
     SET event_type=?,status=?,success=?,deducted=?,input_tokens=?,output_tokens=?,estimated_cost=?,error_code=?,updated_at=CURRENT_TIMESTAMP
     WHERE merchant_id=? AND channel=? AND request_id=?`,
  ).bind(
    values.eventType || "AI_REPLY",
    values.status,
    values.success ? 1 : 0,
    values.deducted ? 1 : 0,
    Number(values.inputTokens || 0),
    Number(values.outputTokens || 0),
    Number(values.estimatedCost || 0),
    values.errorCode || null,
    MEILING_MERCHANT_ID,
    channel,
    requestId,
  ).run();
}

async function ensureUsageRow(db, period) {
  await db.prepare(
    "INSERT OR IGNORE INTO merchant_ai_usage (merchant_id,period_month) VALUES (?,?)",
  ).bind(MEILING_MERCHANT_ID, period).run();
}

export const RESERVE_QUOTA_SQL = `UPDATE merchant_ai_usage
SET reserved_count=reserved_count+1,updated_at=CURRENT_TIMESTAMP
WHERE merchant_id=? AND period_month=?
  AND total_used+reserved_count < COALESCE((
    SELECT monthly_reply_limit FROM merchant_ai_settings
    WHERE merchant_id=? AND enabled=1
  ),0)`;

async function reserveQuota(db, period) {
  await ensureUsageRow(db, period);
  const result = await db.prepare(RESERVE_QUOTA_SQL)
    .bind(MEILING_MERCHANT_ID, period, MEILING_MERCHANT_ID).run();
  return Number(result.meta?.changes || 0) === 1;
}

async function releaseReservation(db, period) {
  await db.prepare(
    "UPDATE merchant_ai_usage SET reserved_count=MAX(0,reserved_count-1),updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND period_month=? AND reserved_count>0",
  ).bind(MEILING_MERCHANT_ID, period).run();
}

async function usageStatus(db, period) {
  await ensureUsageRow(db, period);
  return db.prepare(
    `SELECT s.enabled,s.monthly_reply_limit,s.model,s.max_output_tokens,
            u.total_used,u.line_used,u.website_used,u.reserved_count,u.input_tokens,u.output_tokens,u.estimated_cost,u.low_quota_alerted
     FROM merchant_ai_settings s
     JOIN merchant_ai_usage u ON u.merchant_id=s.merchant_id AND u.period_month=?
     WHERE s.merchant_id=?`,
  ).bind(period, MEILING_MERCHANT_ID).first();
}

async function finalizeUsage(db, period, channel, usage) {
  const channelColumn = channel === "line" ? "line_used" : "website_used";
  const result = await db.prepare(
    `UPDATE merchant_ai_usage
     SET reserved_count=MAX(0,reserved_count-1),total_used=total_used+1,${channelColumn}=${channelColumn}+1,
         input_tokens=input_tokens+?,output_tokens=output_tokens+?,estimated_cost=estimated_cost+?,updated_at=CURRENT_TIMESTAMP
     WHERE merchant_id=? AND period_month=? AND reserved_count>0
     RETURNING total_used,low_quota_alerted`,
  ).bind(usage.inputTokens, usage.outputTokens, usage.estimatedCost, MEILING_MERCHANT_ID, period).first();
  if (!result) throw new Error("QUOTA_FINALIZE_FAILED");
  if (Number(result.total_used) >= LOW_QUOTA_THRESHOLD && !Number(result.low_quota_alerted)) {
    const alert = await db.prepare(
      "UPDATE merchant_ai_usage SET low_quota_alerted=1,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND period_month=? AND low_quota_alerted=0",
    ).bind(MEILING_MERCHANT_ID, period).run();
    if (Number(alert.meta?.changes || 0) === 1) {
      await db.prepare(
        "INSERT OR IGNORE INTO merchant_ai_logs (id,merchant_id,channel,request_id,event_type,status,success,deducted) VALUES (?,?,?,?,?,'recorded',1,0)",
      ).bind(id("ailog"), MEILING_MERCHANT_ID, "system", `LOW_QUOTA:${period}`, "LOW_QUOTA").run();
    }
  }
  return Number(result.total_used);
}

async function callOpenAI(message, history, settings, env, safetySource) {
  if (!env.OPENAI_API_KEY) return { ok: false, errorCode: "OPENAI_API_KEY_MISSING" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.model || MEILING_MODEL,
        instructions: buildMeilingInstructions(message),
        input: [...sanitizeMeilingHistory(history), { role: "user", content: message }],
        max_output_tokens: Number(settings.max_output_tokens || MEILING_MAX_OUTPUT_TOKENS),
        reasoning: { effort: "none" },
        store: false,
        safety_identifier: (await sha256(`${MEILING_MERCHANT_ID}:${safetySource}`)).slice(0, 64),
      }),
    });
    if (!response.ok) return { ok: false, errorCode: `OPENAI_${response.status}` };
    const result = await response.json();
    const reply = extractOutputText(result).slice(0, 1600);
    if (result.status !== "completed" || !reply) return { ok: false, errorCode: "OPENAI_INVALID_RESPONSE" };
    const inputTokens = Number(result.usage?.input_tokens || 0);
    const outputTokens = Number(result.usage?.output_tokens || 0);
    return {
      ok: true,
      reply,
      inputTokens,
      outputTokens,
      estimatedCost: estimateCostUsd(inputTokens, outputTokens),
    };
  } catch (error) {
    return { ok: false, errorCode: error?.name === "AbortError" ? "OPENAI_TIMEOUT" : "OPENAI_NETWORK" };
  } finally {
    clearTimeout(timer);
  }
}

async function runAiFlow({ db, channel, requestId, message, history, env, safetySource, deliver }) {
  const period = periodMonth();
  const settings = await usageStatus(db, period);
  lineAiStage(channel, requestId, "ai_enabled", { enabled: Boolean(settings?.enabled) });
  if (!settings?.enabled) {
    const delivered = await deliver(MEILING_HUMAN_HANDOFF);
    await updateLog(db, channel, requestId, { eventType: "AI_DISABLED", status: delivered ? "delivered" : "delivery_failed", success: delivered, errorCode: delivered ? null : "DELIVERY_FAILED" });
    return { reply: MEILING_HUMAN_HANDOFF, delivered, deducted: false, code: "AI_DISABLED" };
  }

  if (!(await reserveQuota(db, period))) {
    lineAiStage(channel, requestId, "quota_unavailable");
    const delivered = await deliver(MEILING_QUOTA_MESSAGE);
    await updateLog(db, channel, requestId, { eventType: "QUOTA_LIMIT", status: delivered ? "delivered" : "delivery_failed", success: delivered, errorCode: delivered ? "QUOTA_EXHAUSTED" : "DELIVERY_FAILED" });
    return { reply: MEILING_QUOTA_MESSAGE, delivered, deducted: false, code: "QUOTA_EXHAUSTED" };
  }

  lineAiStage(channel, requestId, "quota_reserved");
  await updateLog(db, channel, requestId, { eventType: "AI_REPLY", status: "reserved", success: false, deducted: false });
  lineAiStage(channel, requestId, "openai_called", { model: settings.model || MEILING_MODEL });
  const generated = await callOpenAI(message, history, settings, env, safetySource);
  if (!generated.ok) {
    lineAiStage(channel, requestId, "openai_failed", { error_code: generated.errorCode });
    await releaseReservation(db, period);
    const delivered = await deliver(MEILING_BUSY_MESSAGE);
    await updateLog(db, channel, requestId, { eventType: "AI_REPLY", status: delivered ? "fallback_delivered" : "delivery_failed", success: false, deducted: false, errorCode: generated.errorCode });
    return { reply: MEILING_BUSY_MESSAGE, delivered, deducted: false, code: generated.errorCode };
  }

  lineAiStage(channel, requestId, "openai_success");
  const delivered = await deliver(generated.reply);
  if (!delivered) {
    await releaseReservation(db, period);
    await updateLog(db, channel, requestId, { eventType: "AI_REPLY", status: "delivery_failed", success: false, deducted: false, inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, estimatedCost: generated.estimatedCost, errorCode: "DELIVERY_FAILED" });
    return { reply: generated.reply, delivered: false, deducted: false, code: "DELIVERY_FAILED" };
  }

  const totalUsed = await finalizeUsage(db, period, channel, generated);
  await updateLog(db, channel, requestId, { eventType: "AI_REPLY", status: "delivered", success: true, deducted: true, inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, estimatedCost: generated.estimatedCost });
  return { reply: generated.reply, delivered: true, deducted: true, totalUsed, code: "AI_REPLY" };
}

async function recordRuleReply(db, channel, requestId, eventType, deliver, reply) {
  const delivered = await deliver(reply);
  await updateLog(db, channel, requestId, { eventType, status: delivered ? "delivered" : "delivery_failed", success: delivered, deducted: false, errorCode: delivered ? null : "DELIVERY_FAILED" });
  return { reply, delivered, deducted: false, code: eventType };
}

export async function processMeilingLineText(event, env, deliver) {
  const db = env.FINANCE_DB;
  if (!db) throw new Error("AI database is not configured");
  const message = String(event.message?.text || "").trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!message) return { ignored: true };
  const requestId = String(event.webhookEventId || event.message?.id || "").slice(0, 200);
  if (!requestId) return { ignored: true };
  const fixed = fixedReplyFor(message);
  const bookingReply = MEILING_BOOKING_REPLIES.get(message) || (!fixed && !requiresMeilingHuman(message) ? await bookingAvailabilityReply(message, env) : null);
  const eventType = fixed ? "RULE_REPLY" : bookingReply ? "BOOKING_REPLY" : requiresMeilingHuman(message) ? "POLICY_HANDOFF" : "AI_REPLY";
  if (!(await claimRequest(db, "line", requestId, eventType))) {
    lineAiStage("line", requestId, "dedupe", { duplicate: true });
    return { duplicate: true };
  }
  lineAiStage("line", requestId, "dedupe", { duplicate: false });
  lineAiStage("line", requestId, "keyword_match", { matched: Boolean(fixed || bookingReply), route: fixed ? "fixed" : bookingReply ? "booking" : eventType === "POLICY_HANDOFF" ? "policy" : "ai" });
  if (fixed) return recordRuleReply(db, "line", requestId, "RULE_REPLY", deliver, fixed);
  if (bookingReply) return recordRuleReply(db, "line", requestId, "BOOKING_REPLY", deliver, bookingReply);
  if (requiresMeilingHuman(message)) return recordRuleReply(db, "line", requestId, "POLICY_HANDOFF", deliver, MEILING_HUMAN_HANDOFF);
  const sourceId = event.source?.userId || event.source?.groupId || event.source?.roomId || requestId;
  return runAiFlow({ db, channel: "line", requestId, message, history: [], env, safetySource: `line:${sourceId}`, deliver });
}

function minuteBucket(date = new Date()) {
  return date.toISOString().slice(0, 16);
}

async function takeRateLimit(db, rateKey, limit) {
  const bucket = minuteBucket();
  await db.prepare(
    "INSERT OR IGNORE INTO merchant_ai_rate_limits (rate_key,bucket_start) VALUES (?,?)",
  ).bind(rateKey, bucket).run();
  const result = await db.prepare(
    "UPDATE merchant_ai_rate_limits SET request_count=request_count+1,updated_at=CURRENT_TIMESTAMP WHERE rate_key=? AND bucket_start=? AND request_count<?",
  ).bind(rateKey, bucket, limit).run();
  return Number(result.meta?.changes || 0) === 1;
}

async function websiteRateAllowed(request, db, sessionId) {
  const sessionHash = await sha256(`${MEILING_MERCHANT_ID}:session:${sessionId}`);
  const ipHash = await sha256(`${MEILING_MERCHANT_ID}:ip:${clientIp(request)}`);
  const sessionAllowed = await takeRateLimit(db, `session:${sessionHash}`, WEBSITE_SESSION_REQUESTS_PER_MINUTE);
  const ipAllowed = await takeRateLimit(db, `ip:${ipHash}`, WEBSITE_IP_REQUESTS_PER_MINUTE);
  return sessionAllowed && ipAllowed;
}

export async function handleMeilingWebsiteChat(request, env, cors = {}) {
  if (!env.FINANCE_DB) return json({ reply: MEILING_BUSY_MESSAGE, code: "AI_DB_UNAVAILABLE" }, 503, cors);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_PAYLOAD_BYTES) return json({ error: "Payload too large" }, 413, cors);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) return json({ error: "Payload too large" }, 413, cors);
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400, cors);
  }
  const message = typeof input?.message === "string" ? input.message.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  const sessionId = typeof input?.session_id === "string" ? input.session_id.trim().slice(0, 120) : "";
  if (!message || !sessionId) return json({ error: "message and session_id are required" }, 400, cors);
  if (!(await websiteRateAllowed(request, env.FINANCE_DB, sessionId))) {
    return json({ reply: "訊息傳送得太快，請稍候一分鐘再試。", code: "RATE_LIMITED" }, 429, cors);
  }
  const suppliedRequestId = request.headers.get("idempotency-key") || input.request_id;
  const requestId = String(suppliedRequestId || crypto.randomUUID()).slice(0, 200);
  const fixed = fixedReplyFor(message);
  const eventType = fixed ? "RULE_REPLY" : requiresMeilingHuman(message) ? "POLICY_HANDOFF" : "AI_REPLY";
  if (!(await claimRequest(env.FINANCE_DB, "website", requestId, eventType))) {
    return json({ error: "Duplicate request", code: "DUPLICATE_REQUEST" }, 409, cors);
  }
  const deliver = async () => true;
  let result;
  if (fixed) result = await recordRuleReply(env.FINANCE_DB, "website", requestId, "RULE_REPLY", deliver, fixed);
  else if (requiresMeilingHuman(message)) result = await recordRuleReply(env.FINANCE_DB, "website", requestId, "POLICY_HANDOFF", deliver, MEILING_HUMAN_HANDOFF);
  else result = await runAiFlow({
    db: env.FINANCE_DB,
    channel: "website",
    requestId,
    message,
    history: sanitizeMeilingHistory(input.history),
    env,
    safetySource: `website:${sessionId}`,
    deliver,
  });
  return json({ reply: result.reply, code: result.code, deducted: result.deducted === true }, 200, cors);
}

async function financeAdminAuthorized(request, env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !env.FINANCE_SESSION_SECRET) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || signature !== await hmac(payload, env.FINANCE_SESSION_SECRET)) return false;
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))).exp > Date.now();
  } catch {
    return false;
  }
}

async function adminAudit(db, request, action, merchantId, metadata = {}) {
  await db.prepare(
    "INSERT INTO audit_logs (id,actor_type,actor_id,action,entity_type,entity_id,metadata,ip_address) VALUES (?,?,?,?,?,?,?,?)",
  ).bind(id("audit"), "admin", "finance", action, "merchant_ai_settings", merchantId, JSON.stringify(metadata), clientIp(request)).run();
}

export async function handleAiAdminRequest(request, env, url, cors = {}) {
  if (!env.FINANCE_DB) return json({ error: "AI database is not configured" }, 503, cors);
  if (!(await financeAdminAuthorized(request, env))) return json({ error: "需要財務管理員授權。" }, 401, cors);
  const path = url.pathname;
  const period = String(url.searchParams.get("month") || periodMonth()).slice(0, 7);
  if (path === "/api/admin/ai/usage" && request.method === "GET") {
    const merchantId = String(url.searchParams.get("merchant_id") || MEILING_MERCHANT_ID).slice(0, 100);
    const settings = await env.FINANCE_DB.prepare("SELECT * FROM merchant_ai_settings WHERE merchant_id=?").bind(merchantId).first();
    if (!settings) return json({ error: "找不到商家 AI 設定。" }, 404, cors);
    await env.FINANCE_DB.prepare("INSERT OR IGNORE INTO merchant_ai_usage (merchant_id,period_month) VALUES (?,?)").bind(merchantId, period).run();
    const usage = await env.FINANCE_DB.prepare("SELECT * FROM merchant_ai_usage WHERE merchant_id=? AND period_month=?").bind(merchantId, period).first();
    return json({
      merchant_id: merchantId,
      period_month: period,
      enabled: Boolean(settings.enabled),
      model: settings.model,
      max_output_tokens: settings.max_output_tokens,
      monthly_reply_limit: settings.monthly_reply_limit,
      total_used: usage.total_used,
      line_used: usage.line_used,
      website_used: usage.website_used,
      reserved_count: usage.reserved_count,
      remaining: Math.max(0, Number(settings.monthly_reply_limit) - Number(usage.total_used)),
      available: Math.max(0, Number(settings.monthly_reply_limit) - Number(usage.total_used) - Number(usage.reserved_count)),
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      estimated_cost: usage.estimated_cost,
      low_quota: Boolean(usage.low_quota_alerted),
    }, 200, cors);
  }

  const settingsMatch = path.match(/^\/api\/admin\/ai\/settings\/([^/]+)$/);
  if (settingsMatch && request.method === "PATCH") {
    const merchantId = decodeURIComponent(settingsMatch[1]);
    const existing = await env.FINANCE_DB.prepare("SELECT * FROM merchant_ai_settings WHERE merchant_id=?").bind(merchantId).first();
    if (!existing) return json({ error: "找不到商家 AI 設定。" }, 404, cors);
    let input = {};
    try { input = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, cors); }
    const nextEnabled = typeof input.enabled === "boolean" ? (input.enabled ? 1 : 0) : Number(existing.enabled);
    let nextLimit = Number(existing.monthly_reply_limit);
    if (input.monthly_reply_limit !== undefined) nextLimit = Number(input.monthly_reply_limit);
    if (input.add_quota !== undefined) nextLimit += Number(input.add_quota);
    if (!Number.isInteger(nextLimit) || nextLimit < 0 || nextLimit > 10_000) return json({ error: "每月額度必須是 0～10,000 的整數。" }, 400, cors);
    if (input.add_quota !== undefined && (!Number.isInteger(Number(input.add_quota)) || Number(input.add_quota) <= 0)) return json({ error: "增加額度必須是正整數。" }, 400, cors);
    await env.FINANCE_DB.prepare(
      "UPDATE merchant_ai_settings SET enabled=?,monthly_reply_limit=?,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=?",
    ).bind(nextEnabled, nextLimit, merchantId).run();
    await adminAudit(env.FINANCE_DB, request, "merchant_ai_settings_updated", merchantId, {
      enabled_from: Boolean(existing.enabled), enabled_to: Boolean(nextEnabled),
      limit_from: Number(existing.monthly_reply_limit), limit_to: nextLimit,
      add_quota: input.add_quota || null,
    });
    return json({ ok: true, merchant_id: merchantId, enabled: Boolean(nextEnabled), monthly_reply_limit: nextLimit }, 200, cors);
  }

  if (path === "/api/admin/ai/logs" && request.method === "GET") {
    const merchantId = String(url.searchParams.get("merchant_id") || MEILING_MERCHANT_ID).slice(0, 100);
    const rows = await env.FINANCE_DB.prepare(
      "SELECT id,channel,request_id,event_type,status,success,deducted,input_tokens,output_tokens,estimated_cost,error_code,created_at FROM merchant_ai_logs WHERE merchant_id=? ORDER BY created_at DESC LIMIT 100",
    ).bind(merchantId).all();
    return json({ items: rows.results }, 200, cors);
  }
  return json({ error: "找不到此 AI 管理服務。" }, 404, cors);
}
