import { mkdir, writeFile } from "node:fs/promises";
import { buildSignedAgreement } from "../cloudflare-worker/src/contract-engine.js";

const output = new URL("../tmp/pdfs/", import.meta.url);
await mkdir(output, { recursive: true });
const signature = { strokes: [[[20,30],[45,42],[88,26],[130,55],[175,34]],[[30,88],[72,102],[138,84],[190,108]]] };
const consents = { read: true, electronic: true, independent: true };
const base = { is_active: 1, legal_review_status: "approved", approved_content_hash: "qa-hash", content_hash: "qa-hash", version: "QA-STAGING", content_html: "<h1>隔離 Staging 契約驗證</h1><p>本文件僅供 PDF 版面與繁體中文渲染檢查，不具正式契約效力。</p><h2>簽署證據</h2><p>明確同意、時間、Session、IP、User-Agent 與雜湊形成查驗證據。</p>" };
const partner = await buildSignedAgreement({ title:"創百業智慧鏈｜承攬夥伴合作契約",documentId:"QA-PARTNER-001",publicId:"QA-PARTNER-VERIFY",verificationUrl:"https://staging.invalid/#/verify-contract/QA-PARTNER-VERIFY",contract:base,partyType:"partner",partyId:"staging-partner",partyLabel:"甲方：Staging 平台　乙方：測試承攬夥伴",signatory:"測試簽署人",signatoryRole:"承攬夥伴",signature,consents,consentVersion:"qa-v1",staging:true });
const merchant = await buildSignedAgreement({ title:"創百業智慧鏈｜商家平台服務契約",documentId:"QA-MERCHANT-001",publicId:"QA-MERCHANT-VERIFY",verificationUrl:"https://staging.invalid/#/verify-contract/QA-MERCHANT-VERIFY",contract:base,partyType:"merchant",partyId:"staging-merchant",partyLabel:"平台方：Staging 平台　商家：測試商家",signatory:"測試代表人",signatoryRole:"legal_representative",signature,consents:{read:true,electronic:true,commercial_terms:true,authority:true,signature_evidence:true},consentVersion:"qa-v1",commercialTermsHash:"qa-commercial-hash",attachments:[{title:"附件 A｜商業條件",content:"測試方案 NT$18,000\n一次付清方案"},{title:"附件 B｜正式交付項目",content:"標準規格網站\n契約簽署測試"}],staging:true });
await writeFile(new URL("partner-contract-qa.pdf",output),partner.bytes);
await writeFile(new URL("merchant-contract-qa.pdf",output),merchant.bytes);
console.log(JSON.stringify({partner:{bytes:partner.bytes.length,hash:partner.pdfHash},merchant:{bytes:merchant.bytes.length,hash:merchant.pdfHash}}));
