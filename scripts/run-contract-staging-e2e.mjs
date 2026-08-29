import { execFileSync } from "node:child_process";
import { randomUUID, createHash, createHmac } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { hashCanonical } from "../cloudflare-worker/src/contract-engine.js";

const workerUrl = process.env.CONTRACT_STAGING_WORKER_URL;
const origin = process.env.CONTRACT_STAGING_ORIGIN;
const partnerSecret = process.env.CONTRACT_STAGING_PARTNER_SECRET;
if (!workerUrl || !origin || !partnerSecret) throw new Error("Missing isolated Staging configuration");
if (!workerUrl.includes("contract-signing-staging") || !origin.includes("contract-signing-staging.pages.dev")) throw new Error("Staging-only guard rejected target");

const b64url = (value) => Buffer.from(value).toString("base64url");
const sha = (value) => createHash("sha256").update(String(value)).digest("base64url");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const runId = Date.now().toString(36);
const partnerId = `staging_partner_${runId}`;
const merchantId = `staging_merchant_${runId}`;
const merchantUserId = `staging_owner_${runId}`;
const termsId = `staging_terms_${runId}`;
const inviteId = `staging_invite_${runId}`;
const merchantToken = randomUUID() + randomUUID();
const merchantCsrf = randomUUID() + randomUUID();
const terms = {
  plan_code: "STAGING_AI_DIGITAL_PROMOTION",
  plan_name: "STAGING｜NOT A REAL CONTRACT｜AI 行銷推廣及數位服務方案",
  list_price_minor: 3000000,
  discount_price_minor: 1800000,
  currency: "TWD",
  contract_term_months: 24,
  payment_plan: "upfront_18000",
  upfront_amount_minor: 1800000,
  offset_target_amount_minor: 0,
  tax_reserve_enabled: 0,
  withholding_enabled: 0,
  included_services: ["STAGING 契約簽署測試"],
  excluded_services: ["正式營運與真實交易"],
  attachments: { acceptance: "隔離 Staging 簽署流程驗證", third_party: "所有正式第三方服務皆未啟用" },
  start_date: "2026-09-01",
  service_period_end: "2028-08-31",
  renewal_terms: "STAGING NOT A REAL CONTRACT",
  custom_quote_reference: "STAGING-E2E",
};
const termsHash = await hashCanonical(terms);

const seed = `PRAGMA foreign_keys=ON;
UPDATE contract_versions SET is_active=0;
UPDATE contract_versions SET is_active=1 WHERE version='v1.4';
UPDATE merchant_contract_versions SET is_active=0;
UPDATE merchant_contract_versions SET is_active=1 WHERE version='v1.0';
INSERT INTO partners(id,partner_code,legal_name,display_name,email,phone,status,contract_status,referral_code,approved_at,activated_at)
VALUES(${quote(partnerId)},${quote(`STAGING-P-${runId}`)},'STAGING 測試承攬夥伴','STAGING 測試承攬夥伴',${quote(`${partnerId}@staging.invalid`)},'0900000000','active','unsigned',${quote(`STAGINGREF${runId}`)},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
INSERT INTO merchants(id,merchant_code,name,contact_name,phone,email,status)
VALUES(${quote(merchantId)},${quote(`STAGING-M-${runId}`)},'STAGING 測試商家｜NOT A REAL CONTRACT','STAGING 測試代表','0930000004',${quote(`${merchantId}@staging.invalid`)},'pending_contract');
INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,status,display_name)
VALUES(${quote(merchantUserId)},${quote(merchantId)},${quote(`${merchantId}@staging.invalid`)},'STAGING-NOT-LOGINABLE','STAGING','active','STAGING 測試代表');
INSERT INTO merchant_roles(id,merchant_id,code,name,is_system) VALUES(${quote(`staging_owner_role_${runId}`)},${quote(merchantId)},'owner','STAGING 商家擁有者',1);
INSERT INTO merchant_user_roles(merchant_id,user_id,role_id) VALUES(${quote(merchantId)},${quote(merchantUserId)},${quote(`staging_owner_role_${runId}`)});
INSERT INTO merchant_user_sessions(id,merchant_id,user_id,token_hash,csrf_hash,expires_at)
VALUES(${quote(`staging_session_${runId}`)},${quote(merchantId)},${quote(merchantUserId)},${quote(sha(merchantToken))},${quote(sha(merchantCsrf))},datetime('now','+2 hours'));
INSERT INTO merchant_contract_commercial_terms(id,merchant_id,plan_code,plan_name,list_price_minor,discount_price_minor,currency,contract_term_months,payment_plan,upfront_amount_minor,offset_target_amount_minor,tax_reserve_enabled,withholding_enabled,included_services_json,excluded_services_json,attachments_json,start_date,service_period_end,renewal_terms,custom_quote_reference,status,created_by,approved_by,approved_at,terms_hash)
VALUES(${quote(termsId)},${quote(merchantId)},${quote(terms.plan_code)},${quote(terms.plan_name)},3000000,1800000,'TWD',24,'upfront_18000',1800000,0,0,0,${quote(JSON.stringify(terms.included_services))},${quote(JSON.stringify(terms.excluded_services))},${quote(JSON.stringify(terms.attachments))},'2026-09-01','2028-08-31',${quote(terms.renewal_terms)},'STAGING-E2E','approved','staging-system','staging-system',CURRENT_TIMESTAMP,${quote(termsHash)});
INSERT INTO merchant_contract_invites(id,merchant_id,commercial_terms_id,email,token_hash,expires_at,used_at,created_by)
VALUES(${quote(inviteId)},${quote(merchantId)},${quote(termsId)},${quote(`${merchantId}@staging.invalid`)},${quote(sha(`unused-${runId}`))},datetime('now','+2 hours'),CURRENT_TIMESTAMP,'staging-system');`;
const seedPath = join(tmpdir(), `baiye-contract-staging-${runId}.sql`);
writeFileSync(seedPath, seed, { encoding: "utf8", mode: 0o600 });
try {
  const executable = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npx";
  const prefix = process.platform === "win32" ? ["/d", "/s", "/c", "npx"] : [];
  execFileSync(executable, [...prefix, "wrangler", "d1", "execute", "baiye-contract-signing-staging", "--remote", "--config", "wrangler.contract-staging.jsonc", "--file", seedPath], { cwd: join(process.cwd(), "cloudflare-worker"), stdio: "pipe" });
} finally { unlinkSync(seedPath); }

const payload = b64url(JSON.stringify({ partner_id: partnerId, exp: Date.now() + 7200000 }));
const partnerCookie = `${payload}.${createHmac("sha256", partnerSecret).update(payload).digest("base64url")}`;
const signature = JSON.stringify({ strokes: [[[20, 20], [50, 35], [80, 18], [120, 45]], [[25, 70], [60, 82], [105, 65], [145, 88]]] });
const request = async (path, options = {}) => {
  const response = await fetch(`${workerUrl}${path}`, { ...options, headers: { Origin: origin, "content-type": "application/json", ...(options.headers || {}) } });
  const type = response.headers.get("content-type") || "";
  const value = type.includes("json") ? await response.json() : new Uint8Array(await response.arrayBuffer());
  if (!response.ok) throw new Error(`${path} -> ${response.status}: ${JSON.stringify(value)}`);
  return { response, value };
};

const partnerHeaders = { cookie: `partner_session=${partnerCookie}` };
const partnerCurrent = await request("/api/partner/contract/current", { headers: partnerHeaders });
const partnerPreview = await request("/api/partner/contract/sign-preview", { method: "POST", headers: partnerHeaders, body: JSON.stringify({ legal_name: "STAGING 測試承攬夥伴" }) });
const partnerSign = await request("/api/partner/contract/sign", { method: "POST", headers: { ...partnerHeaders, "idempotency-key": `staging-partner-${runId}` }, body: JSON.stringify({ legal_name: "STAGING 測試承攬夥伴", read: true, electronic: true, independent: true, signature }) });
const partnerReplay = await request("/api/partner/contract/sign", { method: "POST", headers: { ...partnerHeaders, "idempotency-key": `staging-partner-${runId}` }, body: JSON.stringify({ legal_name: "STAGING 測試承攬夥伴", read: true, electronic: true, independent: true, signature }) });
const partnerPdf = await request(`/api/partner/contracts/${partnerSign.value.signature_id}/pdf`, { headers: partnerHeaders });

const merchantHeaders = { cookie: `baiye_merchant_session=${merchantToken}`, "x-csrf-token": merchantCsrf };
const merchantCurrent = await request("/api/merchant/contracts/current", { headers: merchantHeaders });
const merchantBody = { signatory_legal_name: "STAGING 測試代表", signatory_role: "legal_representative", read: true, electronic: true, commercial_terms: true, authority: true, signature_evidence: true, authorization_confirmed: false, signature };
const merchantPreview = await request("/api/merchant/contracts/sign-preview", { method: "POST", headers: merchantHeaders, body: JSON.stringify(merchantBody) });
const merchantSign = await request("/api/merchant/contracts/sign", { method: "POST", headers: { ...merchantHeaders, "idempotency-key": `staging-merchant-${runId}` }, body: JSON.stringify(merchantBody) });
const merchantReplay = await request("/api/merchant/contracts/sign", { method: "POST", headers: { ...merchantHeaders, "idempotency-key": `staging-merchant-${runId}` }, body: JSON.stringify(merchantBody) });
const merchantPdf = await request(`/api/merchant/contracts/${merchantSign.value.signature_id}/pdf`, { headers: merchantHeaders });
const verification = await request(`/api/contract-verification/${merchantSign.value.public_id}`);

const results = {
  partner: { version: partnerCurrent.value.version, preview: partnerPreview.value.version, signed: Boolean(partnerSign.value.signature_id), replay_same_signature: partnerReplay.value.signature_id === partnerSign.value.signature_id, pdf_bytes: partnerPdf.value.byteLength },
  merchant: { version: merchantCurrent.value.contract.version, preview: merchantPreview.value.version, signed: Boolean(merchantSign.value.signature_id), replay_same_signature: merchantReplay.value.signature_id === merchantSign.value.signature_id, pdf_bytes: merchantPdf.value.byteLength },
  verification: { status: verification.value.status, no_pii: !JSON.stringify(verification.value).includes("STAGING 測試代表") },
};
if (!results.partner.signed || !results.partner.replay_same_signature || results.partner.pdf_bytes < 1000 || !results.merchant.signed || !results.merchant.replay_same_signature || results.merchant.pdf_bytes < 1000 || results.verification.status !== "VALID" || !results.verification.no_pii) throw new Error(`E2E assertion failed: ${JSON.stringify(results)}`);
console.log(JSON.stringify({ ok: true, run_id: runId, ...results }));
