import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const workerUrl = process.env.CONTRACT_STAGING_WORKER_URL;
const origin = process.env.CONTRACT_STAGING_ORIGIN;
if (!workerUrl?.includes("contract-signing-staging") || !origin?.includes("contract-signing-staging.pages.dev")) throw new Error("Staging-only guard rejected target");
const runId = Date.now().toString(36);
const adminId = `staging_admin_${runId}`;
const adminToken = randomUUID() + randomUUID();
const adminCsrf = randomUUID() + randomUUID();
const merchantId = `staging_onboarding_merchant_${runId}`;
const partnerEmail = `staging_partner_${runId}@staging.invalid`;
const merchantEmail = `staging_merchant_${runId}@staging.invalid`;
const password = `Staging-${randomUUID()}!`;
const sha = (value) => createHash("sha256").update(String(value)).digest("base64url");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const seed = `PRAGMA foreign_keys=ON;
UPDATE contract_versions SET is_active=0;
UPDATE contract_versions SET is_active=1 WHERE version='v1.4';
UPDATE merchant_contract_versions SET is_active=0;
UPDATE merchant_contract_versions SET is_active=1 WHERE version='v1.0';
INSERT INTO admin_users(id,email,display_name,password_hash,password_salt,role,status) VALUES(${quote(adminId)},${quote(`staging_admin_${runId}@staging.invalid`)},'STAGING Contract Admin','NOT-LOGINABLE','STAGING','super_admin','active');
INSERT INTO admin_sessions(id,admin_user_id,token_hash,csrf_hash,expires_at) VALUES(${quote(`staging_admin_session_${runId}`)},${quote(adminId)},${quote(sha(adminToken))},${quote(sha(adminCsrf))},datetime('now','+2 hours'));
INSERT INTO merchants(id,merchant_code,name,contact_name,email,status) VALUES(${quote(merchantId)},${quote(`STAGING-M-${runId}`)},'STAGING 商家申請｜NOT A REAL CONTRACT','STAGING 測試代表',${quote(merchantEmail)},'pending_contract');`;
const seedPath = join(tmpdir(), `baiye-contract-onboarding-${runId}.sql`);
writeFileSync(seedPath, seed, { encoding: "utf8", mode: 0o600 });
try {
  const executable = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npx";
  const prefix = process.platform === "win32" ? ["/d", "/s", "/c", "npx"] : [];
  execFileSync(executable, [...prefix, "wrangler", "d1", "execute", "baiye-contract-signing-staging", "--remote", "--config", "wrangler.contract-staging.jsonc", "--file", seedPath], { cwd: join(process.cwd(), "cloudflare-worker"), stdio: "pipe" });
} finally { unlinkSync(seedPath); }

const api = async (path, options = {}) => {
  const response = await fetch(`${workerUrl}${path}`, { ...options, headers: { Origin: origin, "content-type": "application/json", ...(options.headers || {}) } });
  const type = response.headers.get("content-type") || "";
  const value = type.includes("json") ? await response.json() : new Uint8Array(await response.arrayBuffer());
  if (!response.ok) throw new Error(`${path} -> ${response.status}: ${JSON.stringify(value)}`);
  return { response, value };
};
const post = (path, body, headers = {}) => api(path, { method: "POST", headers, body: JSON.stringify(body) });
const adminHeaders = { cookie: `baiye_admin_session=${adminToken}`, "x-csrf-token": adminCsrf };
const signature = JSON.stringify({ strokes: [[[16, 18], [44, 32], [78, 16], [112, 45]], [[20, 68], [54, 80], [98, 63], [142, 88]]] });

// Partner apply -> approve -> invite -> activate -> login -> preview -> sign -> PDF.
const applied = await post("/api/partner/apply", { legal_name: "STAGING 測試承攬夥伴", display_name: "STAGING 測試承攬夥伴", email: partnerEmail, phone: "0900000000", consent: true });
await api(`/api/admin/partners/${applied.value.id}`, { method: "PATCH", headers: adminHeaders, body: JSON.stringify({ action: "approve" }) });
const partnerInvite = await post(`/api/admin/partners/${applied.value.id}/invite`, {}, adminHeaders);
const partnerInviteToken = decodeURIComponent(String(partnerInvite.value.invite_url).split("token=")[1] || "");
await post("/api/partner/invite/validate", { token: partnerInviteToken });
await post("/api/partner/accept-invite", { token: partnerInviteToken, password });
const partnerLogin = await post("/api/partner/login", { email: partnerEmail, password });
const partnerCookie = partnerLogin.response.headers.get("set-cookie")?.match(/partner_session=([^;]+)/)?.[1];
if (!partnerCookie) throw new Error("Partner login did not issue an HttpOnly session");
const partnerHeaders = { cookie: `partner_session=${partnerCookie}` };
const partnerPreview = await post("/api/partner/contract/sign-preview", { legal_name: "STAGING 測試承攬夥伴" }, partnerHeaders);
const partnerSign = await post("/api/partner/contract/sign", { legal_name: "STAGING 測試承攬夥伴", read: true, electronic: true, independent: true, signature }, { ...partnerHeaders, "idempotency-key": `partner-sign-${runId}` });
const partnerPdf = await api(`/api/partner/contracts/${partnerSign.value.signature_id}/pdf`, { headers: partnerHeaders });

// Merchant Admin terms -> invite -> activate -> login -> preview -> sign -> PDF.
const terms = await post(`/api/admin/merchants/${merchantId}/commercial-terms`, {
  confirm_approved: true,
  plan_code: "STAGING_AI_DIGITAL_PROMOTION",
  plan_name: "STAGING｜NOT A REAL CONTRACT｜AI 行銷推廣及數位服務方案",
  list_price_minor: 3000000,
  discount_price_minor: 1800000,
  contract_term_months: 24,
  payment_plan: "upfront_18000",
  upfront_amount_minor: 1800000,
  included_services: ["STAGING 契約簽署測試"],
  excluded_services: ["正式營運與真實交易"],
  attachments: { acceptance: "隔離 Staging 簽署流程驗證", third_party: "所有正式第三方服務皆未啟用" },
  start_date: "2026-09-01",
  service_period_end: "2028-08-31",
  renewal_terms: "STAGING NOT A REAL CONTRACT",
}, { ...adminHeaders, "idempotency-key": `merchant-terms-${runId}` });
const merchantInvite = await post("/api/admin/merchant-contracts/invites", { merchant_id: merchantId, commercial_terms_id: terms.value.id, email: merchantEmail }, { ...adminHeaders, "idempotency-key": `merchant-invite-${runId}` });
const merchantInviteToken = decodeURIComponent(String(merchantInvite.value.invite_url).split("token=")[1] || "");
await post("/api/merchant/contracts/invite/validate", { token: merchantInviteToken });
await post("/api/merchant/contracts/accept-invite", { token: merchantInviteToken, password, password_confirm: password, display_name: "STAGING 測試代表" }, { "idempotency-key": `merchant-activate-${runId}` });
const merchantLogin = await post("/api/merchant-auth/login", { merchant_id: merchantId, email: merchantEmail, password });
const merchantCookie = merchantLogin.response.headers.get("set-cookie")?.match(/baiye_merchant_session=([^;]+)/)?.[1];
const merchantCsrf = merchantLogin.value.csrf_token;
if (!merchantCookie || !merchantCsrf) throw new Error("Merchant login did not issue session evidence");
const merchantHeaders = { cookie: `baiye_merchant_session=${merchantCookie}`, "x-csrf-token": merchantCsrf };
const merchantBody = { signatory_legal_name: "STAGING 測試代表", signatory_role: "legal_representative", read: true, electronic: true, commercial_terms: true, authority: true, signature_evidence: true, signature };
const merchantPreview = await post("/api/merchant/contracts/sign-preview", merchantBody, merchantHeaders);
const merchantSign = await post("/api/merchant/contracts/sign", merchantBody, { ...merchantHeaders, "idempotency-key": `merchant-sign-${runId}` });
const merchantPdf = await api(`/api/merchant/contracts/${merchantSign.value.signature_id}/pdf`, { headers: merchantHeaders });
const verification = await api(`/api/contract-verification/${merchantSign.value.public_id}`);

const result = {
  run_id: runId,
  partner: { apply: applied.value.status === "pending_contract", approve: true, invite: Boolean(partnerInviteToken), activate: true, login: true, preview: partnerPreview.value.version, sign: Boolean(partnerSign.value.signature_id), pdf_bytes: partnerPdf.value.byteLength },
  merchant: { terms: Boolean(terms.value.terms_hash), invite: Boolean(merchantInviteToken), activate: true, login: true, preview: merchantPreview.value.version, sign: Boolean(merchantSign.value.signature_id), pdf_bytes: merchantPdf.value.byteLength },
  verification: { status: verification.value.status, no_pii: !JSON.stringify(verification.value).includes("STAGING 測試代表") },
};
if (!result.partner.apply || !result.partner.sign || result.partner.pdf_bytes < 1000 || !result.merchant.terms || !result.merchant.sign || result.merchant.pdf_bytes < 1000 || result.verification.status !== "VALID" || !result.verification.no_pii) throw new Error(`Onboarding E2E failed: ${JSON.stringify(result)}`);
console.log(JSON.stringify({ ok: true, ...result }));
