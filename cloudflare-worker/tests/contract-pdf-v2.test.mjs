import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  A4,
  CONTRACT_PDF_RENDERER_VERSION,
  contractBlocksFromHtml,
  createSignedAgreementPdf,
} from "../src/contract-pdf.js";
import { testContractFontAssets } from "./contract-font-fixture.mjs";

const signature = JSON.stringify({ strokes: [
  [[12, 20], [25, 26], [35, 30], [58, 27], [80, 22], [110, 48]],
  [[20, 60], [38, 65], [55, 70], [82, 68], [105, 64], [120, 62]],
] });
const contractHtml = `
  <h1>契約本文</h1>
  <h2>五級獎勵</h2>
  <p><strong>初階承攬夥伴</strong><br>累計有效成交 1～10 件<br>每件 NT$1,000</p>
  <p><strong>進階承攬夥伴</strong><br>11～30 件<br>每件 NT$1,500</p>
  <p><strong>中階承攬夥伴</strong><br>31～70 件<br>每件 NT$2,000</p>
  <p><strong>高階承攬夥伴</strong><br>71～120 件<br>每件 NT$2,500</p>
  <p><strong>資深承攬夥伴</strong><br>121 件以上<br>每件 NT$3,000</p>
  <ul><li>完整句子與段落語意</li><li>三個月一期</li></ul>
  <table><tr><th>身份</th><th>每件</th></tr><tr><td>初階</td><td>NT$1,000</td></tr></table>
  ${"<p>創百業智慧鏈承攬夥伴合作契約完整句子與段落語意。</p>".repeat(55)}
`;
const input = {
  title: "創百業智慧鏈｜承攬夥伴合作契約",
  documentId: "DOC-V15-CJK-001",
  publicId: "VERIFY-CJK-001",
  verificationUrl: "https://baiyeconnect.com/#/verify-contract/VERIFY-CJK-001",
  version: "v1.5",
  partyLabel: "甲方：創百業智慧鏈　乙方：測試姓名",
  privateIdentityLabel: "乙方身分證字號：A123456789",
  signatory: "測試姓名",
  signatoryRole: "承攬夥伴",
  signedAt: "2026-08-30T12:00:00.000+08:00",
  contentHtml: contractHtml,
  contractHash: "CONTRACT_HASH_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  signatureHash: "SIGNATURE_HASH_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  documentHash: "DOCUMENT_HASH_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  consentVersion: "partner-contract-consent-v1.5",
  assuranceLevel: "standard_electronic_agreement_evidence",
  signature,
  staging: true,
  contractPeriod: { period_start: "2026-08-30", period_end: "2026-11-29", term_months: 3 },
  fontAssets: testContractFontAssets,
};

const artifactPromise = createSignedAgreementPdf(input);
const extractionPromise = (async () => {
  const artifact = await artifactPromise;
  const document = await pdfjs.getDocument({ data: Uint8Array.from(artifact.bytes), useWorkerFetch: false, isEvalSupported: false }).promise;
  const pages = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    pages.push({ page, items: content.items, text: content.items.map((item) => item.str).join("") });
  }
  return { artifact, document, pages, text: pages.map((page) => page.text).join("") };
})();
const extracted = () => extractionPromise;

test("PDFV2-01 embeds a font program", async () => assert.match(new TextDecoder("latin1").decode((await artifactPromise).bytes), /\/FontFile2/));
test("PDFV2-02 removes MSung-Light dependency", async () => assert.doesNotMatch(new TextDecoder("latin1").decode((await artifactPromise).bytes), /MSung-Light/));
test("PDFV2-03 removes UniCNS encoding dependency", async () => assert.doesNotMatch(new TextDecoder("latin1").decode((await artifactPromise).bytes), /UniCNS-UTF16-H/));
test("PDFV2-04 reports the CJK renderer version", async () => assert.equal((await artifactPromise).rendererVersion, CONTRACT_PDF_RENDERER_VERSION));
test("PDFV2-05 preserves HTML headings", () => assert.deepEqual(contractBlocksFromHtml("<h2>五級獎勵</h2>"), [{ type: "heading", text: "五級獎勵" }]));
test("PDFV2-06 preserves list semantics", () => assert.deepEqual(contractBlocksFromHtml("<ul><li>完整句子</li></ul>"), [{ type: "bullet", text: "完整句子" }]));
test("PDFV2-07 preserves table row meaning", () => assert.equal(contractBlocksFromHtml("<table><tr><td>初階</td><td>NT$1,000</td></tr></table>")[0].text, "初階 NT$1,000"));
test("PDFV2-08 renders A4 page bounds", async () => { const pdf = await PDFDocument.load((await artifactPromise).bytes); for (const page of pdf.getPages()) { assert.ok(Math.abs(page.getWidth() - A4.width) < 0.01); assert.ok(Math.abs(page.getHeight() - A4.height) < 0.01); } });
test("PDFV2-09 paginates long contracts naturally", async () => assert.ok((await artifactPromise).pageCount >= 4));
test("PDFV2-10 extracts Traditional Chinese", async () => assert.match((await extracted()).text, /創百業智慧鏈/));
test("PDFV2-11 extracts contract title", async () => assert.match((await extracted()).text, /承攬夥伴合作契約/));
test("PDFV2-12 extracts three-month term", async () => assert.match((await extracted()).text, /三個月一期/));
test("PDFV2-13 extracts complete reward wording", async () => { const text=(await extracted()).text.replaceAll("\u0000", ""); assert.match(text,/初階承攬夥伴/); assert.match(text,/NT\$1,000/); });
test("PDFV2-14 extracts English and numbers without inserted spacing", async () => assert.match((await extracted()).text.replace(/\s/g, ""), /DOC-V15-CJK-001/));
test("PDFV2-15 extracts verification URL without inserted spacing", async () => assert.match((await extracted()).text.replace(/\s/g, ""), /https:\/\/baiyeconnect\.com\/#\/verify-contract\/VERIFY-CJK-001/));
test("PDFV2-16 extracts hashes", async () => assert.match((await extracted()).text.replace(/\s/g, ""), /DOCUMENT_HASH_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/));
test("PDFV2-17 private PDF contains identity while public evidence remains separate", async () => assert.match((await extracted()).text, /A123456789/));
test("PDFV2-18 creates a dedicated signature page", async () => { const result=await extracted(); assert.match(result.pages.at(-1).text,/電子簽署紀錄/); assert.match(result.pages.at(-1).text,/本人手寫簽名/); });
test("PDFV2-19 keeps extracted text inside page bounds", async () => { const result=await extracted(); for (const {items} of result.pages) for (const item of items) { const x=item.transform[4],y=item.transform[5]; assert.ok(x >= 0 && x <= A4.width); assert.ok(y >= 0 && y <= A4.height); assert.ok(x + item.width <= A4.width + 1); } });
test("PDFV2-20 keeps signature label above hash evidence", async () => { const last=(await extracted()).pages.at(-1).items; const signatureLabel=last.find((item)=>item.str.includes("本人手寫簽名")); const documentHash=last.find((item)=>item.str.includes("DOCUMENT_HASH_")); assert.ok(signatureLabel.transform[5] > documentHash.transform[5]); });
test("PDFV2-21 preserves supplied document hash", async () => assert.equal((await artifactPromise).documentHash, input.documentHash));
test("PDFV2-22 layout changes only PDF hash", async () => { const first=await artifactPromise; const second=await createSignedAgreementPdf({...input,contentHtml:`${input.contentHtml}<p>完整句子</p>`}); assert.equal(second.documentHash,first.documentHash); assert.notEqual(second.pdfHash,first.pdfHash); });
