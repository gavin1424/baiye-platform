import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  MEILING_BUSY_MESSAGE,
  MEILING_KEYWORD_REPLIES,
  MEILING_QUOTA_MESSAGE,
  RESERVE_QUOTA_SQL,
  buildMeilingInstructions,
  estimateCostUsd,
  extractOutputText,
  fixedReplyFor,
  handleMeilingWebsiteChat,
  periodMonth,
  processMeilingLineText,
  requiresMeilingHuman,
  sanitizeMeilingHistory,
} from "../src/meiling-ai.js";
import worker from "../src/index.js";

class D1Statement {
  constructor(statement) { this.statement = statement; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async run() { const result = this.statement.run(...this.values); return { meta: { changes: Number(result.changes || 0) } }; }
  async first() { return this.statement.get(...this.values) || null; }
  async all() { return { results: this.statement.all(...this.values) }; }
}

class TestD1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec(readFileSync(new URL("../migrations/0007_merchant_ai_quota.sql", import.meta.url), "utf8"));
  }
  prepare(sql) { return new D1Statement(this.sqlite.prepare(sql)); }
  row(sql, ...values) { return this.sqlite.prepare(sql).get(...values); }
}

const websiteRequest = (body, requestId = crypto.randomUUID()) => new Request("https://worker.test/api/merchant/meiling/chat", {
  method: "POST",
  headers: { "content-type": "application/json", origin: "https://meilingpatchwork.com", "idempotency-key": requestId, "CF-Connecting-IP": "203.0.113.8" },
  body: JSON.stringify(body),
});

test("Taipei monthly period and fixed rules are deterministic", () => {
  assert.equal(periodMonth(new Date("2026-08-31T16:30:00Z")), "2026-09");
  for (const [keyword, reply] of MEILING_KEYWORD_REPLIES) assert.equal(fixedReplyFor(` ${keyword} `), reply);
  assert.equal(fixedReplyFor("一般問題"), null);
  assert.equal(fixedReplyFor("我想買課"), null, "natural language must continue to the AI branch");
  assert.equal(fixedReplyFor("我想做魚布偶"), null, "custom natural language must continue to the AI branch");
  assert.equal(requiresMeilingHuman("我想處理退款爭議"), true);
  assert.equal(requiresMeilingHuman("你們主要做什麼作品"), false);
});

test("LINE natural-language course and custom questions use AI instead of being ignored", async () => {
  const db = new TestD1();
  const originalFetch = globalThis.fetch;
  const called = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    called.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ status: "completed", output_text: "可以協助您了解課程或魚布偶客製需求。", usage: { input_tokens: 20, output_tokens: 12 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    for (const [index, message] of ["我想買課", "我想做魚布偶"].entries()) {
      const replies = [];
      const result = await processMeilingLineText({ webhookEventId: `natural-${index}`, message: { id: `natural-message-${index}`, type: "text", text: message }, source: { userId: `user-${index}` } }, { FINANCE_DB: db, OPENAI_API_KEY: "test-key" }, async (reply) => { replies.push(reply); return true; });
      assert.equal(result.code, "AI_REPLY");
      assert.equal(result.deducted, true);
      assert.equal(replies.length, 1);
    }
    assert.equal(called.length, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("prompt, history, output and cost stay bounded", () => {
  const history = Array.from({ length: 12 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `訊息${index}` }));
  assert.equal(sanitizeMeilingHistory(history).length, 6);
  assert.match(buildMeilingInstructions("課程有哪些"), /不得自行編造價格/);
  assert.equal(extractOutputText({ output_text: "  回覆  " }), "回覆");
  assert.equal(extractOutputText({ output: [{ content: [{ type: "output_text", text: "答案" }] }] }), "答案");
  assert.equal(estimateCostUsd(1_000_000, 1_000_000), 1.4);
});

test("conditional reservation cannot exceed 60 at 59 used", () => {
  const db = new TestD1();
  db.sqlite.prepare("INSERT INTO merchant_ai_usage (merchant_id,period_month,total_used) VALUES (?,?,?)").run("meiling_patchwork", "2026-08", 59);
  const statement = db.sqlite.prepare(RESERVE_QUOTA_SQL);
  const results = Array.from({ length: 12 }, () => statement.run("meiling_patchwork", "2026-08", "meiling_patchwork"));
  assert.equal(results.reduce((sum, result) => sum + Number(result.changes), 0), 1);
  const usage = db.row("SELECT total_used,reserved_count FROM merchant_ai_usage WHERE merchant_id=? AND period_month=?", "meiling_patchwork", "2026-08");
  assert.equal(usage.total_used, 59);
  assert.equal(usage.reserved_count, 1);
});

test("website fixed reply never consumes quota and duplicate request is rejected", async () => {
  const db = new TestD1();
  const requestId = "website-fixed-1";
  const first = await handleMeilingWebsiteChat(websiteRequest({ message: "課程", session_id: "session-fixed" }, requestId), { FINANCE_DB: db }, {});
  assert.equal(first.status, 200);
  assert.equal((await first.json()).deducted, false);
  const duplicate = await handleMeilingWebsiteChat(websiteRequest({ message: "課程", session_id: "session-fixed" }, requestId), { FINANCE_DB: db }, {});
  assert.equal(duplicate.status, 409);
  const usage = db.row("SELECT total_used,line_used,website_used FROM merchant_ai_usage WHERE merchant_id=?", "meiling_patchwork");
  assert.equal(usage, undefined);
});

test("missing OpenAI key returns fallback and releases reservation", async () => {
  const db = new TestD1();
  const response = await handleMeilingWebsiteChat(websiteRequest({ message: "你們主要做什麼樣的拼布作品？", session_id: "session-no-key" }), { FINANCE_DB: db }, {});
  const payload = await response.json();
  assert.equal(payload.reply, MEILING_BUSY_MESSAGE);
  assert.equal(payload.deducted, false);
  const usage = db.row("SELECT total_used,reserved_count FROM merchant_ai_usage WHERE merchant_id=?", "meiling_patchwork");
  assert.equal(usage.total_used, 0);
  assert.equal(usage.reserved_count, 0);
});

test("successful website and LINE replies share one monthly counter", async () => {
  const db = new TestD1();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    return new Response(JSON.stringify({ status: "completed", output_text: "我們以拼布、刺繡與生活布藝作品為主。", usage: { input_tokens: 100, output_tokens: 40 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const website = await handleMeilingWebsiteChat(websiteRequest({ message: "主要有哪些作品？", session_id: "session-success" }), { FINANCE_DB: db, OPENAI_API_KEY: "test-key" }, {});
    assert.equal((await website.json()).deducted, true);
    const replies = [];
    const line = await processMeilingLineText({ webhookEventId: "line-success-1", message: { id: "m1", type: "text", text: "可以介紹你們的手作方向嗎？" }, source: { userId: "u1" } }, { FINANCE_DB: db, OPENAI_API_KEY: "test-key" }, async (reply) => { replies.push(reply); return true; });
    assert.equal(line.deducted, true);
    assert.equal(replies.length, 1);
    const usage = db.row("SELECT total_used,line_used,website_used,input_tokens,output_tokens FROM merchant_ai_usage WHERE merchant_id=?", "meiling_patchwork");
    assert.equal(usage.total_used, 2);
    assert.equal(usage.line_used, 1);
    assert.equal(usage.website_used, 1);
    assert.equal(usage.input_tokens, 200);
    assert.equal(usage.output_tokens, 80);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("quota exhausted and OpenAI delivery failure do not overcount", async () => {
  const db = new TestD1();
  db.sqlite.prepare("INSERT INTO merchant_ai_usage (merchant_id,period_month,total_used,line_used) VALUES (?,?,?,?)").run("meiling_patchwork", periodMonth(), 60, 60);
  const quotaReplies = [];
  const exhausted = await processMeilingLineText({ webhookEventId: "line-limit", message: { id: "m-limit", type: "text", text: "想了解作品特色" }, source: { userId: "u-limit" } }, { FINANCE_DB: db, OPENAI_API_KEY: "unused" }, async (reply) => { quotaReplies.push(reply); return true; });
  assert.equal(exhausted.reply, MEILING_QUOTA_MESSAGE);
  assert.equal(exhausted.deducted, false);
  assert.equal(quotaReplies.length, 1);
  assert.equal(db.row("SELECT total_used FROM merchant_ai_usage WHERE merchant_id=?", "meiling_patchwork").total_used, 60);
});

test("successful OpenAI generation with failed LINE delivery releases quota and retry is deduplicated", async () => {
  const db = new TestD1();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: "completed",
    output_text: "測試回答",
    usage: { input_tokens: 20, output_tokens: 10 },
  }), { status: 200, headers: { "content-type": "application/json" } });
  const event = { webhookEventId: "line-delivery-fail", message: { id: "m-fail", type: "text", text: "一般問題" }, source: { userId: "u-fail" } };
  try {
    const first = await processMeilingLineText(event, { FINANCE_DB: db, OPENAI_API_KEY: "test-key" }, async () => false);
    assert.equal(first.deducted, false);
    const retry = await processMeilingLineText({ ...event, deliveryContext: { isRedelivery: true } }, { FINANCE_DB: db, OPENAI_API_KEY: "test-key" }, async () => true);
    assert.equal(retry.duplicate, true);
    const usage = db.row("SELECT total_used,reserved_count FROM merchant_ai_usage WHERE merchant_id=?", "meiling_patchwork");
    assert.equal(usage.total_used, 0);
    assert.equal(usage.reserved_count, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("LINE webhook acknowledges immediately and finishes AI reply through waitUntil", async () => {
  const db = new TestD1();
  const secret = "0123456789abcdef0123456789abcdef";
  const body = JSON.stringify({ events: [{
    type: "message",
    webhookEventId: "line-background-success",
    replyToken: "reply-token",
    message: { id: "m-background", type: "text", text: "可以介紹主要服務嗎？" },
    source: { userId: "u-background" },
  }] });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))).toString("base64");
  let resolveOpenAI;
  const openAIResponse = new Promise((resolve) => { resolveOpenAI = resolve; });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url === "https://api.openai.com/v1/responses") return openAIResponse;
    if (url === "https://api.line.me/v2/bot/message/reply") return new Response("{}", { status: 200 });
    throw new Error(`Unexpected URL: ${url}`);
  };
  const tasks = [];
  try {
    const response = await worker.fetch(new Request("https://worker.test/webhooks/line/meiling", {
      method: "POST",
      headers: { "content-type": "application/json", "x-line-signature": signature },
      body,
    }), {
      FINANCE_DB: db,
      OPENAI_API_KEY: "test-key",
      LINE_MEILING_CHANNEL_SECRET: secret,
      LINE_MEILING_CHANNEL_ACCESS_TOKEN: "line-token",
    }, { waitUntil: (task) => tasks.push(task) });
    assert.equal(response.status, 200);
    assert.equal(tasks.length, 1);
    resolveOpenAI(new Response(JSON.stringify({
      status: "completed",
      output_text: "我們提供拼布作品、課程與客製服務。",
      usage: { input_tokens: 30, output_tokens: 12 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    await tasks[0];
    const usage = db.row("SELECT total_used,line_used,reserved_count FROM merchant_ai_usage WHERE merchant_id=?", "meiling_patchwork");
    assert.equal(usage.total_used, 1);
    assert.equal(usage.line_used, 1);
    assert.equal(usage.reserved_count, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
