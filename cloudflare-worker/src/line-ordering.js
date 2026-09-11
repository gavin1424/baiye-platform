const E = new TextEncoder();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store" },
  });
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

async function validSignature(body, signature, secret) {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey("raw", E.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, E.encode(body));
  return constantTimeEqual(toBase64(signed), signature);
}

async function sha256Hex(value) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", E.encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function handleBeefNoodleLineWebhook(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.FINANCE_DB || !env.LINE_BEEF_NOODLE_CHANNEL_SECRET) {
    return json({ code: "NEEDS_MANUAL_SETUP", error: "Beef noodle LINE webhook is not configured." }, 503);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature") || "";
  if (!await validSignature(rawBody, signature, env.LINE_BEEF_NOODLE_CHANNEL_SECRET)) {
    return json({ error: "Invalid LINE signature" }, 401);
  }

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const merchantId = "demo_beef_noodle";
  const events = Array.isArray(payload.events) ? payload.events : [];
  const statements = [];
  for (const event of events) {
    if (!["follow", "unfollow"].includes(event?.type) || event?.source?.type !== "user" || !event.source.userId) continue;
    const userHash = await sha256Hex(event.source.userId);
    const followed = event.type === "follow";
    statements.push(env.FINANCE_DB.prepare(`
      INSERT INTO merchant_line_friendships(merchant_id,line_user_id_hash,status,last_followed_at,last_unfollowed_at,updated_at)
      VALUES(?,?,?,${followed ? "CURRENT_TIMESTAMP" : "NULL"},${followed ? "NULL" : "CURRENT_TIMESTAMP"},CURRENT_TIMESTAMP)
      ON CONFLICT(merchant_id,line_user_id_hash) DO UPDATE SET
        status=excluded.status,
        last_followed_at=CASE WHEN excluded.status='friend' THEN CURRENT_TIMESTAMP ELSE merchant_line_friendships.last_followed_at END,
        last_unfollowed_at=CASE WHEN excluded.status='blocked' THEN CURRENT_TIMESTAMP ELSE merchant_line_friendships.last_unfollowed_at END,
        updated_at=CURRENT_TIMESTAMP
    `).bind(merchantId, userHash, followed ? "friend" : "blocked"));
  }
  statements.push(env.FINANCE_DB.prepare("UPDATE merchant_line_integrations SET webhook_verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=?").bind(merchantId));
  await env.FINANCE_DB.batch(statements);
  return json({ ok: true });
}
