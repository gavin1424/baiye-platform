import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const page = readFileSync(new URL("../../src/pages/PartnerPages.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const helper = readFileSync(new URL("../../src/lib/partner-contract-pdf.ts", import.meta.url), "utf8");
const reset = new URL("../../scripts/reset-partner-contract-staging-signature.mjs", import.meta.url);

test("PDFVIEW-01 viewer route is registered", () => assert.match(app, /partner\/contracts\/:signatureId\/view/));
test("PDFVIEW-02 viewer resolves signature id from route", () => assert.match(page, /useParams\(\)/));
test("PDFVIEW-03 viewer loads through authenticated fetch", () => { assert.match(helper, /credentials:\s*"include"/); assert.match(page, /fetchContractPdfBlob\(signatureId\)/); });
test("PDFVIEW-04 signed state has no direct Worker PDF anchor", () => assert.doesNotMatch(page, /href=\{`\$\{API\}\/api\/partner\/contracts\/\$\{/));
test("PDFVIEW-05 signed state no longer exposes the optional viewer route", () => assert.doesNotMatch(page, /to=\{`\/partner\/contracts\/\$\{contract\.signature\.signature_id\}\/view`\}/));
test("PDFVIEW-06 authenticated response becomes blob", () => assert.match(helper, /await response\.blob\(\)/));
test("PDFVIEW-07 blob URL is generated", () => assert.match(helper, /URL\.createObjectURL/));
test("PDFVIEW-08 viewer embeds application PDF", () => assert.match(page, /<object[^>]+type="application\/pdf"/));
test("PDFVIEW-09 Android fallback avoids API URL", () => { assert.match(page, /此瀏覽器無法直接預覽 PDF/); assert.match(page, /openContractPdf\(signatureId\)/); });
test("PDFVIEW-10 viewer maps unauthorized state", () => { assert.match(helper, /response\.status === 401/); assert.match(page, /登入已失效/); });
test("PDFVIEW-11 viewer maps not found state", () => { assert.match(helper, /response\.status === 404/); assert.match(page, /找不到此已簽契約 PDF/); });
test("PDFVIEW-12 viewer maps network failure without JSON", () => assert.match(page, /PDF 暫時無法載入/));
test("PDFVIEW-13 download uses shared authenticated helper", () => assert.match(page, /downloadContractPdf\(/));
test("PDFVIEW-14 blob revocation is delayed for mobile", () => assert.match(helper, /60_000/));
test("PDFVIEW-15 new-page open targets blob URL", () => assert.match(helper, /window\.open\(url, "_blank"/));
test("PDFVIEW-16 reset requires explicit staging-only flag", () => assert.match(readFileSync(reset, "utf8"), /--staging-only is required/));
test("PDFVIEW-17 reset pins Signing Staging D1", () => assert.match(readFileSync(reset, "utf8"), /baiye-contract-signing-staging/));
test("PDFVIEW-18 reset preserves partner member and coupon counts", () => assert.match(readFileSync(reset, "utf8"), /coupon_count !== before\.coupon_count/));
test("PDFVIEW-19 production-mode reset aborts before Wrangler", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(reset), "--staging-only", "--partner-id", "partner_123456789012"], { encoding: "utf8", env: { ...process.env, CONTRACT_SIGNING_MODE: "production" } });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /CONTRACT_SIGNING_MODE must equal staging/);
});
test("PDFVIEW-20 reset restores immutable triggers", () => { const source = readFileSync(reset, "utf8"); assert.match(source, /CREATE TRIGGER trg_partner_contract_signature_immutable_delete/); assert.match(source, /immutable_trigger_count !== 2/); });
