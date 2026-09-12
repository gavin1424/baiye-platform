import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { buildSignedAgreement } from "../cloudflare-worker/src/contract-engine.js";
import { commerceAiAttachmentA, commerceAiTermsSnapshot } from "../cloudflare-worker/src/commerce-ai-contract.js";
import { softposAttachmentA, softposCommercialTermsSnapshot } from "../cloudflare-worker/src/merchant-softpos-plan.js";
import { standardCommercialTermsSnapshot } from "../cloudflare-worker/src/merchant-standard-terms.js";
import { testContractFontAssets } from "../cloudflare-worker/tests/contract-font-fixture.mjs";

const root = new URL("../", import.meta.url);
const migrationDirectory = new URL("../cloudflare-worker/migrations/", import.meta.url);
const outputDirectory = new URL("../output/pdf/merchant-payment-v1/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });
const fontAssets = process.env.CONTRACT_FONT_REGULAR && process.env.CONTRACT_FONT_BOLD
  ? {
      ...testContractFontAssets,
      regularBytes: await readFile(process.env.CONTRACT_FONT_REGULAR),
      boldBytes: await readFile(process.env.CONTRACT_FONT_BOLD),
    }
  : testContractFontAssets;

const db = new DatabaseSync(":memory:");
for (const name of (await readdir(migrationDirectory)).filter((item) => /^\d+.*\.sql$/.test(item)).sort()) {
  db.exec(await readFile(new URL(name, migrationDirectory), "utf8"));
}

const signature = { strokes: [[[18, 28], [45, 54], [77, 31], [112, 65], [150, 39]], [[26, 91], [63, 110], [103, 86], [148, 116], [194, 92]]] };
const consents = { read: true, electronic: true, commercial_terms: true, authority: true, signature_evidence: true };
const signedAt = "2026-09-11T05:25:23.270Z";
const plans = [
  {
    slug: "standard-18000",
    contractId: "merchant_service_v1_3_18000_payment",
    terms: standardCommercialTermsSnapshot(new Date(signedAt)),
    attachments: (terms) => [{ title: "附件 A｜商業條件", contentHtml: `<h2>附件 A｜商業條件</h2><p>契約總額：NT$18,000</p><p>簽約時應付：NT$18,000</p><p>簽約後餘額：NT$0</p><p>服務期間：24 個月</p>` }],
  },
  {
    slug: "commerce-ai-50000",
    contractId: "merchant_commerce_ai_v1_1_50000",
    terms: commerceAiTermsSnapshot(new Date(signedAt)),
    attachments: commerceAiAttachmentA,
  },
  {
    slug: "softpos-24000",
    contractId: "merchant_softpos_v1_2_24000_payment",
    terms: softposCommercialTermsSnapshot(new Date(signedAt)),
    attachments: (terms) => softposAttachmentA(terms, { formal_name: "創百業智慧鏈｜免 POS 機智慧點餐系統" }),
  },
];

const results = [];
for (const plan of plans) {
  const contract = db.prepare("SELECT * FROM merchant_contract_versions WHERE id=?").get(plan.contractId);
  if (!contract) throw new Error(`Missing contract ${plan.contractId}`);
  const agreement = await buildSignedAgreement({
    title: contract.title,
    documentId: `QA-${plan.slug.toUpperCase()}`,
    publicId: `QA-${plan.slug.toUpperCase()}-VERIFY`,
    verificationUrl: `https://staging.invalid/#/verify-contract/QA-${plan.slug.toUpperCase()}-VERIFY`,
    contract: { ...contract, legal_review_status: "approved", approved_content_hash: contract.content_hash, is_active: 1 },
    partyType: "merchant",
    partyId: `qa-${plan.slug}`,
    partyLabel: "平台方：創百業智慧鏈　商家：陳靈有限公司",
    signatory: "葉耀仁",
    signatoryRole: "legal_representative",
    signature,
    consents,
    consentVersion: "merchant-contract-payment-v1",
    commercialTermsHash: createHash("sha256").update(JSON.stringify(plan.terms)).digest("hex"),
    attachments: plan.attachments(plan.terms),
    signedAt,
    staging: true,
    fontAssets,
  });
  const name = `${plan.slug}.pdf`;
  await writeFile(new URL(name, outputDirectory), agreement.bytes);
  results.push({ plan_id: plan.terms.plan_code, contract_version: plan.contractId, file: new URL(name, outputDirectory).pathname, pdf_hash: agreement.pdfHash, bytes: agreement.bytes.length });
}

await writeFile(new URL("manifest.json", outputDirectory), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ root: root.pathname, results }, null, 2));
