import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createSignedAgreementPdf } from "../cloudflare-worker/src/contract-pdf.js";

const regularPath = process.env.CONTRACT_FONT_REGULAR_PATH;
const boldPath = process.env.CONTRACT_FONT_BOLD_PATH;
const monoPath = process.env.CONTRACT_FONT_MONO_PATH;
if (!regularPath || !boldPath || !monoPath) throw new Error("CONTRACT_FONT_REGULAR_PATH, CONTRACT_FONT_BOLD_PATH and CONTRACT_FONT_MONO_PATH are required");
const regularBytes = readFileSync(regularPath);
const boldBytes = readFileSync(boldPath);
const monoBytes = readFileSync(monoPath);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fontAssets = { regularBytes, boldBytes, monoBytes, regularSha256: hash(regularBytes), boldSha256: hash(boldBytes), monoSha256: hash(monoBytes) };

const db = new DatabaseSync(":memory:");
const migrationDir = new URL("../cloudflare-worker/migrations/", import.meta.url);
for (const file of readdirSync(migrationDir).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
  db.exec(readFileSync(new URL(file, migrationDir), "utf8"));
}
const contract = db.prepare("SELECT * FROM contract_versions WHERE id='contractor_partner_v1_5'").get();
if (!contract) throw new Error("contractor_partner_v1_5 was not found");

const documentId = "BYPC-V15-CJK-QA-001";
const documentHash = "qa-document-hash-layout-independent-001";
const signature = JSON.stringify({ strokes: [
  [[20, 20], [35, 42], [55, 25], [78, 54], [100, 32], [125, 64], [152, 38]],
  [[24, 86], [48, 68], [72, 96], [98, 74], [126, 105], [158, 82], [188, 112]],
  [[196, 26], [210, 52], [230, 35], [250, 66], [276, 42], [302, 72]],
] });
const artifact = await createSignedAgreementPdf({
  title: "創百業智慧鏈｜承攬夥伴合作契約",
  documentId,
  publicId: "VERIFY-V15-CJK-QA-001",
  verificationUrl: "https://baiyeconnect.com/#/verify-contract/VERIFY-V15-CJK-QA-001",
  version: contract.version,
  partyLabel: "甲方：平台契約正式設定法律主體　乙方：測試姓名",
  privateIdentityLabel: "乙方身分證字號：A123456789",
  signatory: "測試姓名",
  signatoryRole: "承攬夥伴",
  signedAt: "2026-08-30T12:00:00.000+08:00",
  contentHtml: contract.content_html,
  contractHash: contract.content_hash,
  signatureHash: "qa-signature-hash-001",
  documentHash,
  consentVersion: "partner-contract-consent-v1.5",
  assuranceLevel: "standard_electronic_agreement_evidence",
  signature,
  staging: true,
  contractPeriod: { period_start: "2026-08-30", period_end: "2026-11-29", term_months: 3 },
  fontAssets,
});

const outputDir = resolve("output/pdf");
mkdirSync(outputDir, { recursive: true });
const outputPath = join(outputDir, `創百業智慧鏈_承攬夥伴合作契約_v1.5_${documentId}.pdf`);
writeFileSync(outputPath, artifact.bytes);
console.log(JSON.stringify({ outputPath, bytes: artifact.bytes.length, pageCount: artifact.pageCount, documentHash: artifact.documentHash, pdfHash: artifact.pdfHash, rendererVersion: artifact.rendererVersion, fontAssetSha256: artifact.fontAssetSha256 }));
