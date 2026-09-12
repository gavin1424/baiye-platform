import { authorizeMerchant, merchantOperationsAllowed } from "./merchant-auth.js";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers },
});
const clean = (value, max = 200) => String(value ?? "").trim().slice(0, max);

export class MerchantOrderEventHub {
  constructor(state) {
    this.state = state;
    this.sockets = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get("upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0], server = pair[1];
      server.accept();
      this.sockets.add(server);
      server.addEventListener("close", () => this.sockets.delete(server));
      server.addEventListener("error", () => this.sockets.delete(server));
      server.send(JSON.stringify({ type: "connected", merchant_id: request.headers.get("x-baiye-merchant") || "" }));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (request.method === "POST" && url.pathname === "/publish") {
      const event = await request.json();
      const message = JSON.stringify(event);
      for (const socket of [...this.sockets]) {
        try { socket.send(message); } catch { this.sockets.delete(socket); }
      }
      return json({ ok: true, connections: this.sockets.size });
    }
    return json({ error: "Not found" }, 404);
  }
}

export async function publishMerchantOrderEvent(env, merchantId, event) {
  if (!env.ORDER_EVENT_HUB) return;
  const stub = env.ORDER_EVENT_HUB.get(env.ORDER_EVENT_HUB.idFromName(merchantId));
  await stub.fetch("https://order-events.internal/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
}

function publicEvent(row) {
  return {
    sequence: Number(row.sequence), event_id: row.event_id, event_type: row.event_type,
    order_id: row.order_id, order_code: row.order_code, table_label: row.table_label || "",
    status: row.status || "", payment_status: row.payment_status || "",
    item_count: Number(row.item_count || 0), total_minor: Number(row.total_minor || 0),
    created_at: row.created_at,
  };
}

export async function handleMerchantOrderEvents(request, env, url, cors = {}) {
  const auth = await authorizeMerchant(request, env, request.method === "GET" ? "ordering.read" : "");
  if (!auth.ok) return json({ error: auth.error, code: auth.error }, auth.status, cors);
  const merchantId = auth.session.merchant_id;
  if (!await merchantOperationsAllowed(env.FINANCE_DB, merchantId, env.APP_MODE === "staging")) return json({ code: "MERCHANT_ACTIVATION_REQUIRED" }, 423, cors);

  if (url.pathname === "/api/merchant-app/order-events/live" && request.method === "GET") {
    if (request.headers.get("upgrade") !== "websocket") return json({ error: "WebSocket upgrade required" }, 426, cors);
    if (!env.ORDER_EVENT_HUB) return json({ error: "Realtime event hub unavailable" }, 503, cors);
    const stub = env.ORDER_EVENT_HUB.get(env.ORDER_EVENT_HUB.idFromName(merchantId));
    const headers = new Headers(request.headers);
    headers.set("x-baiye-merchant", merchantId);
    return stub.fetch(new Request(request, { headers }));
  }

  if (url.pathname === "/api/merchant-app/order-events" && request.method === "GET") {
    const after = Math.max(0, Number(url.searchParams.get("after") || 0));
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const result = await env.FINANCE_DB.prepare(`SELECT * FROM merchant_order_events WHERE merchant_id=? AND sequence>? ORDER BY sequence LIMIT ?`).bind(merchantId, after, limit).all();
    const events = (result.results || []).map(publicEvent);
    return json({ merchant_id: merchantId, events, last_sequence: events.at(-1)?.sequence || after }, 200, cors);
  }

  if (url.pathname === "/api/merchant-app/devices" && request.method === "POST") {
    const input = await request.json().catch(() => ({}));
    const deviceId = clean(input.device_id, 160);
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(deviceId)) return json({ error: "device_id is required" }, 422, cors);
    await env.FINANCE_DB.prepare(`INSERT INTO merchant_devices(device_id,merchant_id,device_name,app_version,connection_identity,printer_id,enabled,last_seen_at)
      VALUES(?,?,?,?,?,?,1,CURRENT_TIMESTAMP)
      ON CONFLICT(merchant_id,device_id) DO UPDATE SET device_name=excluded.device_name,app_version=excluded.app_version,connection_identity=excluded.connection_identity,printer_id=excluded.printer_id,enabled=1,last_seen_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`)
      .bind(deviceId, merchantId, clean(input.device_name, 120) || "Android device", clean(input.app_version, 40), "websocket", clean(input.printer_id, 160) || null).run();
    return json({ ok: true, merchant_id: merchantId, device_id: deviceId }, 200, cors);
  }
  return json({ error: "Not found" }, 404, cors);
}
