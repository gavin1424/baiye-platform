import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const EXPECTED_DATABASE = "baiye-contract-signing-staging";
const EXPECTED_MODE = "staging";
const EXPECTED_VERSION = "contractor_partner_v1_5";
const CONFIG = resolve("cloudflare-worker/wrangler.contract-staging.jsonc");
const args = new Map(process.argv.slice(2).map((value, index, values) => value.startsWith("--") ? [value, values[index + 1]?.startsWith("--") ? true : values[index + 1]] : [value, value]));
const partnerId = String(args.get("--partner-id") || "");
const confirmed = args.get("--confirm-reset") === true;
const stagingOnly = args.get("--staging-only") === true;

function abort(message) {
  process.stderr.write(`ABORT: ${message}\n`);
  process.exit(2);
}

function run(commandArgs, { json = false } = {}) {
  const npxCli = process.platform === "win32"
    ? resolve(process.env.ProgramFiles || "C:/Program Files", "nodejs/node_modules/npm/bin/npx-cli.js")
    : null;
  const result = spawnSync(process.execPath, npxCli ? [npxCli, "wrangler", ...commandArgs] : ["/usr/local/lib/node_modules/npm/bin/npx-cli.js", "wrangler", ...commandArgs], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout || "Wrangler command failed");
  return json ? JSON.parse(result.stdout) : result.stdout;
}

function d1(sql) {
  const payload = run(["d1", "execute", EXPECTED_DATABASE, "--remote", "--config", CONFIG, `--command=${sql.replaceAll(/\s+/g, " ").trim()}`, "--json"], { json: true });
  return payload.flatMap((item) => item.results || []);
}

if (!stagingOnly) abort("--staging-only is required");
if (process.env.CONTRACT_SIGNING_MODE !== EXPECTED_MODE) abort("CONTRACT_SIGNING_MODE must equal staging");
if (!/^partner_[A-Za-z0-9-]{12,120}$/.test(partnerId)) abort("a valid --partner-id is required");

const configText = readFileSync(CONFIG, "utf8");
if (!configText.includes(`"database_name": "${EXPECTED_DATABASE}"`)) abort("Signing Staging D1 name mismatch");
if (!configText.includes('"database_id": "7d31a677-bce0-4224-8700-60e5ab54a3b7"')) abort("Signing Staging D1 id mismatch");
if (!configText.includes('"CONTRACT_SIGNING_MODE": "staging"')) abort("Wrangler signing mode is not staging");

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const signatures = d1(`SELECT s.id,s.partner_id,s.contract_version_id,s.document_hash,s.pdf_hash,s.pdf_object_key,s.evidence_object_key,s.signed_at FROM contract_signatures s WHERE s.partner_id=${q(partnerId)} AND s.contract_version_id=${q(EXPECTED_VERSION)};`);
if (signatures.length !== 1) abort(`expected exactly one v1.5 test signature; found ${signatures.length}`);
const signature = signatures[0];
const before = d1(`SELECT (SELECT COUNT(*) FROM partners WHERE id=${q(partnerId)}) partner_count,(SELECT COUNT(*) FROM partner_platform_member_links WHERE partner_id=${q(partnerId)}) member_link_count,(SELECT COUNT(*) FROM platform_member_coupons WHERE member_id=(SELECT member_id FROM partner_platform_member_links WHERE partner_id=${q(partnerId)})) coupon_count;`)[0];
if (before.partner_count !== 1 || before.member_link_count !== 1) abort("partner/member precondition failed");

process.stdout.write(`${JSON.stringify({ action: "staging_signature_reset_preview", signature, preserved: before }, null, 2)}\n`);
if (!confirmed) abort("review the preview, then rerun with --confirm-reset");

const auditId = `audit_staging_contract_reset_${crypto.randomUUID()}`;
const sql = `
DROP TRIGGER IF EXISTS trg_partner_contract_period_delete;
DROP TRIGGER IF EXISTS trg_partner_contract_signature_immutable_delete;
DELETE FROM partner_contract_periods WHERE partner_id=${q(partnerId)} AND contract_version_id=${q(EXPECTED_VERSION)} AND contract_signature_id=${q(signature.id)};
DELETE FROM contract_signatures WHERE id=${q(signature.id)} AND partner_id=${q(partnerId)} AND contract_version_id=${q(EXPECTED_VERSION)};
DELETE FROM contract_sign_operations WHERE party_type='partner' AND party_id=${q(partnerId)} AND operation_type IN ('sign','sign_preview');
UPDATE partners SET contract_status='unsigned',contract_version=NULL,contract_signed_at=NULL WHERE id=${q(partnerId)} AND contract_version='v1.5';
INSERT INTO audit_logs(id,actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES(${q(auditId)},'system','staging-reset-script','partner.contract_staging_signature_reset','partner',${q(partnerId)},${q(JSON.stringify({ signature_id: signature.id, document_hash: signature.document_hash, pdf_hash: signature.pdf_hash, contract_version: "v1.5" }))});
CREATE TRIGGER trg_partner_contract_signature_immutable_delete BEFORE DELETE ON contract_signatures BEGIN SELECT RAISE(ABORT,'SIGNED_CONTRACT_IMMUTABLE'); END;
CREATE TRIGGER trg_partner_contract_period_delete BEFORE DELETE ON partner_contract_periods BEGIN SELECT RAISE(ABORT,'PARTNER_CONTRACT_PERIOD_IMMUTABLE'); END;
`;
d1(sql);

for (const key of [signature.pdf_object_key, signature.evidence_object_key].filter(Boolean)) {
  run(["r2", "object", "delete", `baiye-contract-signing-staging/${key}`, "--remote", "--config", CONFIG, "--force"]);
}

const after = d1(`SELECT (SELECT COUNT(*) FROM partners WHERE id=${q(partnerId)}) partner_count,(SELECT COUNT(*) FROM partner_platform_member_links WHERE partner_id=${q(partnerId)}) member_link_count,(SELECT COUNT(*) FROM platform_member_coupons WHERE member_id=(SELECT member_id FROM partner_platform_member_links WHERE partner_id=${q(partnerId)})) coupon_count,(SELECT COUNT(*) FROM contract_signatures WHERE partner_id=${q(partnerId)} AND contract_version_id=${q(EXPECTED_VERSION)}) signature_count,(SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name IN ('trg_partner_contract_period_delete','trg_partner_contract_signature_immutable_delete')) immutable_trigger_count;`)[0];
if (after.partner_count !== 1 || after.member_link_count !== 1 || after.coupon_count !== before.coupon_count || after.signature_count !== 0 || after.immutable_trigger_count !== 2) abort("post-reset integrity verification failed");
process.stdout.write(`${JSON.stringify({ ok: true, removed_signature: signature.id, removed_r2_keys: [signature.pdf_object_key, signature.evidence_object_key], preserved: after }, null, 2)}\n`);
