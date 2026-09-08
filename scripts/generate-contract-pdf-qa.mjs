import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSignedAgreementPdf } from "../cloudflare-worker/src/contract-pdf.js";
import { testContractFontAssets } from "../cloudflare-worker/tests/contract-font-fixture.mjs";

const db = new DatabaseSync(":memory:");
for (const file of readdirSync(new URL("../cloudflare-worker/migrations", import.meta.url)).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
  db.exec(readFileSync(new URL(`../cloudflare-worker/migrations/${file}`, import.meta.url), "utf8"));
}
db.exec(readFileSync(new URL("../cloudflare-worker/migrations/production_0032_unified_contract_center_approval.sql", import.meta.url), "utf8"));

const definitions = [
  ["18k", "merchant_contract_versions", "merchant_service_v1_2_18000_addons", "legal_representative"],
  ["45k", "merchant_contract_versions", "merchant_commerce_ai_v1_0_45000", "legal_representative"],
  ["24k", "merchant_contract_versions", "merchant_softpos_v1_0_24000", "legal_representative"],
  ["partner-v1.5", "contract_versions", "contractor_partner_v1_5", "partner"],
];
const signature = JSON.stringify({ strokes: [[[12,30],[42,20],[70,42],[96,18],[132,52]],[[28,72],[61,61],[90,82],[126,66]]] });
const output = resolve("tmp/pdfs");
mkdirSync(output, { recursive: true });

for (const [name, table, id, role] of definitions) {
  const contract = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
  if (!contract) throw new Error(`missing contract: ${id}`);
  const artifact = await createSignedAgreementPdf({
    title: role === "partner" ? "創百業智慧鏈｜承攬夥伴合作契約" : contract.title,
    documentId: `QA-${name.toUpperCase()}-20260908`,
    publicId: `QA-${name.toUpperCase()}-VERIFY`,
    verificationUrl: `https://baiyeconnect.com/#/verify-contract/QA-${name.toUpperCase()}-VERIFY`,
    version: contract.version,
    partyLabel: role === "partner" ? "甲方：創百業智慧鏈　乙方：葉耀仁" : "甲方：創百業智慧鏈　乙方：陳靈有限公司",
    privateIdentityLabel: role === "partner" ? "乙方身分證字號：A123456789" : "統一編號：12345678",
    signatory: "葉耀仁",
    signatoryRole: role,
    signedAt: "2026-09-08T13:25:23.270Z",
    contentHtml: contract.content_html,
    contractHash: contract.content_hash,
    commercialTermsHash: "QA_COMMERCIAL_TERMS_SHA256_ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    signatureHash: "QA_SIGNATURE_SHA256_ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    documentHash: "QA_DOCUMENT_SHA256_ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    consentVersion: role === "partner" ? "partner-contract-consent-v1.5" : "merchant-contract-consent-v1",
    assuranceLevel: "standard_electronic_agreement_evidence",
    signature,
    staging: false,
    contractPeriod: { period_start: "2026-09-08", period_end: role === "partner" ? "2026-12-07" : "2028-09-07", term_months: role === "partner" ? 3 : 24 },
    fontAssets: testContractFontAssets,
  });
  const path = resolve(output, `${name}.pdf`);
  writeFileSync(path, artifact.bytes);
  console.log(JSON.stringify({ name, path, pages: artifact.pageCount, bytes: artifact.bytes.length, renderer: artifact.rendererVersion }));
}
