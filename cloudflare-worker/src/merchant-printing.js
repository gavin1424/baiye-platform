import { authorizeMerchant, merchantOperationsAllowed } from "./merchant-auth.js";

const encoder = new TextEncoder();
const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const sha = async (value) => b64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(value)))));
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const rows = (result) => result?.results || [];
const validIpv4 = (value) => {
  const parts = String(value).split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
};

export const RETRY_DELAYS_SECONDS = Object.freeze([5, 15, 30, 60]);
export function retryDelaySeconds(attemptCount) {
  return RETRY_DELAYS_SECONDS[Math.min(Math.max(Number(attemptCount) - 1, 0), RETRY_DELAYS_SECONDS.length - 1)];
}

function publicPrinter(row) {
  return { ...row, port: Number(row.port), paper_width_mm: Number(row.paper_width_mm), enabled: Boolean(row.enabled), auto_print: Boolean(row.auto_print), copies: Number(row.copies), reachability: row.last_seen_at ? "UNKNOWN" : "UNKNOWN" };
}

function publicJob(row, includePayload = false) {
  const result = {
    id: row.id, order_code: row.order_code, printer_id: row.printer_id, print_type: row.print_type,
    status: row.status, copies: Number(row.copies), attempt_count: Number(row.attempt_count),
    created_at: row.created_at, available_at: row.available_at, claimed_at: row.claimed_at,
    printed_at: row.printed_at, failed_at: row.failed_at, last_error: row.last_error,
    delivery_outcome: row.delivery_outcome, ambiguous_at: row.ambiguous_at,
    is_reprint: Number(row.reprint_sequence) > 0, reprint_sequence: Number(row.reprint_sequence),
    reprint_reason: row.reprint_reason || null, reprint_operator: row.reprint_operator || null,
  };
  if (includePayload) result.payload = JSON.parse(row.payload_json);
  return result;
}

export function buildKitchenPayload({ merchantName, orderCode, tableLabel, orderType, paymentMethod, paymentStatus = "unpaid", totalMinor, createdAt, acceptedAt = "", items, customerNote }) {
  const printMerchantName = clean(merchantName, 120).replace(/｜完整功能試用店$/, "").trim();
  return {
    schema_version: 1, print_type: "kitchen", merchant_name: printMerchantName,
    order_code: orderCode, table_label: tableLabel || "", order_type: orderType,
    payment_method: paymentMethod, payment_status: paymentStatus, total_minor: Number(totalMinor), created_at: createdAt, accepted_at: acceptedAt,
    customer_note: customerNote || "",
    items: items.map((item) => ({ name: item.name_snapshot, quantity: Number(item.quantity), note: item.note || "", options: (item.options || []).map((option) => ({ group_name: option.group_name_snapshot, value_name: option.value_name_snapshot })) })),
  };
}

async function requireClaim(db, merchantId, jobId, suppliedToken) {
  if (!suppliedToken) return null;
  const claimHash = await sha(suppliedToken);
  return db.prepare("SELECT * FROM print_jobs WHERE id=? AND merchant_id=? AND claim_token_hash=?").bind(jobId, merchantId, claimHash).first();
}

async function handlePrinters(request, db, url, merchantId, actorId, cors) {
  const match = url.pathname.match(/^\/api\/merchant-app\/printers(?:\/([^/]+))?$/);
  if (!match) return null;
  if (request.method === "GET") {
    const result = await db.prepare("SELECT * FROM printers WHERE merchant_id=? ORDER BY created_at").bind(merchantId).all();
    return json({ printers: rows(result).map(publicPrinter) }, 200, cors);
  }
  if (!["POST", "PUT", "PATCH"].includes(request.method)) return json({ error: "Method not allowed" }, 405, cors);
  const input = await request.json().catch(() => ({}));
  const id = match[1] ? decodeURIComponent(match[1]) : clean(input.id, 120) || uid("printer");
  const name = clean(input.name, 120), host = clean(input.host, 255), port = Number(input.port);
  if (!name || !validIpv4(host) || !Number.isInteger(port) || port < 1 || port > 65535) return json({ error: "請輸入正確的印表機名稱、IPv4 與 Port。" }, 422, cors);
  const copies = Math.min(Math.max(Number(input.copies) || 1, 1), 5);
  await db.prepare(`INSERT INTO printers(id,merchant_id,name,model,connection_type,host,port,paper_width_mm,enabled,auto_print,copies)
    VALUES(?,?,?,'XP-N160II','lan',?,?,80,?,?,?)
    ON CONFLICT(merchant_id,id) DO UPDATE SET name=excluded.name,host=excluded.host,port=excluded.port,enabled=excluded.enabled,auto_print=excluded.auto_print,copies=excluded.copies,updated_at=CURRENT_TIMESTAMP`)
    .bind(id, merchantId, name, host, port, input.enabled === false ? 0 : 1, input.auto_print === true ? 1 : 0, copies).run();
  const saved = await db.prepare("SELECT * FROM printers WHERE merchant_id=? AND id=?").bind(merchantId, id).first();
  return json({ printer: publicPrinter(saved), saved_by: actorId }, match[1] ? 200 : 201, cors);
}

async function claimJob(request, db, merchantId, jobId, cors) {
  const input = await request.json().catch(() => ({})), deviceId = clean(input.device_id, 160), claimRequestId = clean(input.claim_request_id, 160), manual = input.manual === true;
  if (!deviceId || !/^[A-Za-z0-9._:-]{8,160}$/.test(claimRequestId)) return json({ error: "device_id and claim_request_id are required" }, 422, cors);
  // Deterministic per-request token lets the same authenticated device recover
  // a lost claim response without storing a raw token or creating a new claim.
  const rawToken = await sha(`claim:v1:${merchantId}:${jobId}:${deviceId}:${claimRequestId}`), claimHash = await sha(rawToken);
  const replay = await db.prepare("SELECT * FROM print_jobs WHERE id=? AND merchant_id=? AND device_id=? AND claim_request_id=? AND claim_token_hash=? AND status IN('claimed','printing')").bind(jobId, merchantId, deviceId, claimRequestId, claimHash).first();
  if (replay) return json({ job: publicJob(replay, true), claim_token: rawToken, lease_expires_at: replay.lease_expires_at, replayed: true }, 200, cors);
  const candidate = await db.prepare(`SELECT j.* FROM print_jobs j JOIN printers p ON p.id=j.printer_id AND p.merchant_id=j.merchant_id
    WHERE j.id=? AND j.merchant_id=? AND p.enabled=1 AND (?=1 OR p.auto_print=1) AND j.status IN('pending','failed')
      AND j.delivery_outcome IN('not_started','safe_failure') AND j.attempt_count<4 AND datetime(COALESCE(j.available_at,j.created_at))<=datetime('now')`).bind(jobId, merchantId, manual ? 1 : 0).first();
  if (!candidate) return json({ error: "列印任務不可 claim，可能已由其他裝置處理或需要人工確認。", code: "JOB_NOT_CLAIMABLE" }, 409, cors);
  const attemptNo = Number(candidate.attempt_count) + 1, attemptId = uid("printattempt");
  let result;
  try {
    [result] = await db.batch([
      db.prepare(`UPDATE print_jobs SET status='claimed',attempt_count=?,claimed_at=CURRENT_TIMESTAMP,lease_expires_at=datetime('now','+10 minutes'),device_id=?,claim_request_id=?,claim_token_hash=?,delivery_outcome='not_started',updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND merchant_id=? AND status=? AND attempt_count=?`).bind(attemptNo, deviceId, claimRequestId, claimHash, jobId, merchantId, candidate.status, candidate.attempt_count),
      db.prepare("INSERT INTO print_job_attempts(id,merchant_id,print_job_id,attempt_no,device_id,claim_token_hash,status) VALUES(?,?,?,?,?,?,'claimed')").bind(attemptId, merchantId, jobId, attemptNo, deviceId, claimHash),
    ]);
  } catch {
    return json({ error: "列印任務已由其他裝置取得。", code: "CLAIM_RACE_LOST" }, 409, cors);
  }
  if (!result.meta?.changes) return json({ error: "列印任務已由其他裝置取得。", code: "CLAIM_RACE_LOST" }, 409, cors);
  const claimed = await db.prepare("SELECT * FROM print_jobs WHERE id=? AND merchant_id=?").bind(jobId, merchantId).first();
  return json({ job: publicJob(claimed, true), claim_token: rawToken, lease_expires_at: claimed.lease_expires_at }, 200, cors);
}

async function transitionClaimedJob(request, db, merchantId, jobId, action, cors) {
  const input = await request.json().catch(() => ({}));
  const job = await requireClaim(db, merchantId, jobId, clean(input.claim_token, 300));
  if (!job) return json({ error: "Claim token 無效。", code: "CLAIM_TOKEN_INVALID" }, 403, cors);
  if (action === "printing") {
    if (job.status !== "claimed") return json({ error: "任務不在 claimed 狀態。" }, 409, cors);
    await db.batch([
      db.prepare("UPDATE print_jobs SET status='printing',delivery_outcome='in_progress',lease_expires_at=datetime('now','+30 minutes'),updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=? AND claim_token_hash=? AND status='claimed'").bind(jobId, merchantId, job.claim_token_hash),
      db.prepare("UPDATE print_job_attempts SET status='printing',started_at=CURRENT_TIMESTAMP WHERE print_job_id=? AND merchant_id=? AND attempt_no=?").bind(jobId, merchantId, job.attempt_count),
    ]);
    return json({ ok: true, status: "printing" }, 200, cors);
  }
  if (action === "printed") {
    if (job.status === "printed") return json({ ok: true, status: "printed", replayed: true }, 200, cors);
    if (job.status !== "printing") return json({ error: "任務未進入 printing 狀態。" }, 409, cors);
    await db.batch([
      db.prepare("UPDATE print_jobs SET status='printed',delivery_outcome='confirmed',printed_at=CURRENT_TIMESTAMP,lease_expires_at=NULL,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=? AND claim_token_hash=? AND status='printing'").bind(jobId, merchantId, job.claim_token_hash),
      db.prepare("UPDATE print_job_attempts SET status='printed',finished_at=CURRENT_TIMESTAMP,metadata_json=? WHERE print_job_id=? AND merchant_id=? AND attempt_no=?").bind(JSON.stringify({ bytes_written: Number(input.bytes_written || 0) }), jobId, merchantId, job.attempt_count),
      db.prepare("UPDATE printers SET last_seen_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=?").bind(job.printer_id, merchantId),
    ]);
    return json({ ok: true, status: "printed" }, 200, cors);
  }
  // The device distinguishes failures before any byte was written from partial
  // or completed writes. Do not turn a proven connect failure into ambiguity
  // merely because the intent state was already announced.
  const ambiguous = input.ambiguous === true;
  const message = clean(input.error_message || "PRINT_FAILED", 1000), code = clean(input.error_code || "PRINT_FAILED", 100);
  const exhausted = Number(job.attempt_count) >= RETRY_DELAYS_SECONDS.length;
  const outcome = ambiguous ? "ambiguous" : "safe_failure";
  const delay = retryDelaySeconds(job.attempt_count);
  await db.batch([
    db.prepare(`UPDATE print_jobs SET status='failed',delivery_outcome=?,failed_at=CURRENT_TIMESTAMP,ambiguous_at=CASE WHEN ?='ambiguous' THEN CURRENT_TIMESTAMP ELSE NULL END,
      available_at=CASE WHEN ?='safe_failure' AND ?=0 THEN datetime('now',?) ELSE NULL END,last_error=?,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=? AND claim_token_hash=?`)
      .bind(outcome, outcome, outcome, exhausted ? 1 : 0, `+${delay} seconds`, message, jobId, merchantId, job.claim_token_hash),
    db.prepare("UPDATE print_job_attempts SET status=?,finished_at=CURRENT_TIMESTAMP,error_code=?,error_message=? WHERE print_job_id=? AND merchant_id=? AND attempt_no=?").bind(outcome, code, message, jobId, merchantId, job.attempt_count),
  ]);
  return json({ ok: true, status: "failed", delivery_outcome: outcome, retry_after_seconds: !ambiguous && !exhausted ? delay : null, requires_manual_confirmation: ambiguous }, 200, cors);
}

async function reprintJob(request, db, merchantId, jobId, actorId, cors) {
  const input = await request.json().catch(() => ({})), reason = clean(input.reason, 300), key = clean(request.headers.get("idempotency-key") || input.idempotency_key, 120);
  if (!reason || !key) return json({ error: "補印需要原因與 Idempotency-Key。" }, 422, cors);
  const original = await db.prepare("SELECT * FROM print_jobs WHERE id=? AND merchant_id=?").bind(jobId, merchantId).first();
  if (!original) return json({ error: "找不到原列印任務。" }, 404, cors);
  const existing = await db.prepare("SELECT * FROM print_jobs WHERE merchant_id=? AND idempotency_key=?").bind(merchantId, key).first();
  if (existing) return json({ job: publicJob(existing), replayed: true }, 200, cors);
  const sequence = Number((await db.prepare("SELECT COALESCE(MAX(reprint_sequence),0) value FROM print_jobs WHERE merchant_id=? AND order_code=? AND printer_id=? AND print_type=?").bind(merchantId, original.order_code, original.printer_id, original.print_type).first())?.value || 0) + 1;
  const id = uid("printjob");
  const payload = { ...JSON.parse(original.payload_json), reprint: true, reprint_sequence: sequence, reprint_reason: reason };
  await db.prepare(`INSERT INTO print_jobs(id,merchant_id,order_id,order_code,printer_id,print_type,status,copies,payload_json,available_at,created_by,reprint_of_job_id,reprint_reason,reprint_operator,reprint_requested_at,reprint_sequence,idempotency_key)
    VALUES(?,?,?,?,?,?,'pending',?,?,CURRENT_TIMESTAMP,?,?,?, ?,CURRENT_TIMESTAMP,?,?)`).bind(id, merchantId, original.order_id, original.order_code, original.printer_id, original.print_type, Number(input.copies || original.copies), JSON.stringify(payload), actorId, original.id, reason, actorId, sequence, key).run();
  const created = await db.prepare("SELECT * FROM print_jobs WHERE id=? AND merchant_id=?").bind(id, merchantId).first();
  return json({ job: publicJob(created), replayed: false }, 201, cors);
}

export async function handleMerchantPrinting(request, env, url, cors = {}) {
  const permission = request.method === "GET" ? "printing.read" : "printing.manage";
  const auth = await authorizeMerchant(request, env, permission);
  if (!auth.ok) return json({ error: auth.error, code: auth.error }, auth.status, cors);
  const merchantId = auth.session.merchant_id, actorId = auth.session.user_id, db = env.FINANCE_DB;
  if (!await merchantOperationsAllowed(db, merchantId, env.APP_MODE === "staging")) return json({ code: "MERCHANT_ACTIVATION_REQUIRED" }, 423, cors);
  const printerResponse = await handlePrinters(request, db, url, merchantId, actorId, cors);
  if (printerResponse) return printerResponse;
  if (url.pathname === "/api/merchant-app/print-jobs/pending" && request.method === "GET") {
    const result = await db.prepare(`SELECT j.* FROM print_jobs j JOIN printers p ON p.id=j.printer_id AND p.merchant_id=j.merchant_id
      WHERE j.merchant_id=? AND p.enabled=1 AND p.auto_print=1 AND j.status IN('pending','failed') AND j.delivery_outcome IN('not_started','safe_failure')
      AND j.attempt_count<4 AND datetime(COALESCE(j.available_at,j.created_at))<=datetime('now') ORDER BY datetime(j.created_at) LIMIT 20`).bind(merchantId).all();
    return json({ jobs: rows(result).map((row) => publicJob(row, true)), poll_after_ms: 3000 }, 200, cors);
  }
  if (url.pathname === "/api/merchant-app/print-jobs/history" && request.method === "GET") {
    const result = await db.prepare("SELECT * FROM print_jobs WHERE merchant_id=? ORDER BY datetime(created_at) DESC LIMIT 200").bind(merchantId).all();
    return json({ jobs: rows(result).map(publicJob) }, 200, cors);
  }
  if (url.pathname === "/api/merchant-app/print-jobs/manual-pending" && request.method === "GET") {
    const result = await db.prepare(`SELECT j.* FROM print_jobs j JOIN printers p ON p.id=j.printer_id AND p.merchant_id=j.merchant_id
      WHERE j.merchant_id=? AND p.enabled=1 AND j.status IN('pending','failed') AND j.delivery_outcome IN('not_started','safe_failure')
      AND j.attempt_count<4 AND datetime(COALESCE(j.available_at,j.created_at))<=datetime('now') ORDER BY datetime(j.created_at) LIMIT 100`).bind(merchantId).all();
    return json({ jobs: rows(result).map((row) => publicJob(row, true)) }, 200, cors);
  }
  const match = url.pathname.match(/^\/api\/merchant-app\/print-jobs\/([^/]+)\/(claim|printing|printed|failed|reprint)$/);
  if (!match || request.method !== "POST") return json({ error: "Not found" }, 404, cors);
  const jobId = decodeURIComponent(match[1]), action = match[2];
  if (action === "claim") return claimJob(request, db, merchantId, jobId, cors);
  if (action === "reprint") return reprintJob(request, db, merchantId, jobId, actorId, cors);
  return transitionClaimedJob(request, db, merchantId, jobId, action, cors);
}
