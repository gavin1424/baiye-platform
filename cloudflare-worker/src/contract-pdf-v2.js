import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const encoder = new TextEncoder();
export const CONTRACT_PDF_RENDERER_VERSION = "v2-cjk-embedded-font";
export const A4 = Object.freeze({ width: 595.28, height: 841.89 });
const MARGIN = Object.freeze({ left: 56, right: 56, top: 55, bottom: 55 });
const CONTENT_WIDTH = A4.width - MARGIN.left - MARGIN.right;

export async function sha256(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeHtml(value) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value)
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code.replace(/^x/i, ""), /^x/i.test(code) ? 16 : 10)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match);
}

function cleanText(value) {
  return decodeHtml(value)
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\r?\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function contractBlocksFromHtml(html) {
  const source = String(html || "").replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");
  const tokens = source.match(/<[^>]+>|[^<]+/g) || [];
  const blocks = [];
  let type = "paragraph", text = "", orderedIndex = 0;
  const flush = () => {
    const value = cleanText(text);
    if (value) blocks.push({ type, text: value });
    text = "";
    type = "paragraph";
  };
  for (const token of tokens) {
    if (!token.startsWith("<")) { text += decodeHtml(token); continue; }
    const closing = /^<\s*\//.test(token);
    const tag = token.match(/^<\s*\/?\s*([a-z0-9]+)/i)?.[1]?.toLowerCase();
    if (!tag) continue;
    if (!closing && ["h1", "h2", "h3", "p", "li", "tr"].includes(tag)) {
      flush();
      if (tag.startsWith("h")) type = "heading";
      else if (tag === "li") type = orderedIndex ? "numbered" : "bullet";
      if (tag === "li" && orderedIndex) text = `${orderedIndex++}. `;
    } else if (tag === "br") text += "\n";
    else if (!closing && tag === "ol") { flush(); orderedIndex = 1; }
    else if (closing && tag === "ol") { flush(); orderedIndex = 0; }
    else if (!closing && ["td", "th"].includes(tag) && cleanText(text)) text += " ";
    if (closing && ["h1", "h2", "h3", "p", "li", "tr"].includes(tag)) flush();
  }
  flush();
  return blocks;
}

export function wrapByWidth(value, font, size, maxWidth) {
  const output = [];
  for (const paragraph of String(value || "").split(/\r?\n/)) {
    if (!paragraph) { output.push(""); continue; }
    let line = "";
    const tokens = paragraph.match(/[\p{Script=Han}]{1,8}\s+NT\$[\d,]+(?:\.\d+)?|https?:\/\/\S+|NT\$[\d,]+(?:\.\d+)?|[A-Za-z0-9][A-Za-z0-9._:/#?&=%+\-]*|\s+|[^\s]/gu) || [];
    for (const token of tokens) {
      const candidate = line + token;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        output.push(line.trimEnd());
        line = token.trimStart();
      } else line = candidate;
      if (line && font.widthOfTextAtSize(line, size) > maxWidth) {
        const oversized = line;
        line = "";
        for (const character of Array.from(oversized)) {
          const characterCandidate = line + character;
          if (line && font.widthOfTextAtSize(characterCandidate, size) > maxWidth) {
            output.push(line.trimEnd());
            line = character;
          } else line = characterCandidate;
        }
      }
    }
    if (line) output.push(line.trimEnd());
  }
  return output.length ? output : [""];
}

function parseSignature(signature) {
  try {
    const parsed = typeof signature === "string" ? JSON.parse(signature) : signature;
    return Array.isArray(parsed?.strokes) ? parsed.strokes.filter((stroke) => Array.isArray(stroke) && stroke.length >= 2) : [];
  } catch { return []; }
}

function formatContractDate(value) { return String(value || "—").replaceAll("-", "/"); }
function safePdfDate(value) { const date = new Date(value || 0); return Number.isNaN(date.getTime()) ? new Date(0) : date; }

export async function createSignedAgreementPdfV2(input) {
  if (!input.fontAssets?.regularBytes || !input.fontAssets?.boldBytes || !input.fontAssets?.monoBytes) throw new Error("CONTRACT_EMBEDDED_FONT_REQUIRED");
  const documentHash = input.documentHash || await sha256(JSON.stringify({ contractId: input.documentId, version: input.version, contentHash: input.contractHash, signatureHash: input.signatureHash, legalName: input.signatory, signedAt: input.signedAt }));
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const subset = input.fontAssets.subsetSafe === true;
  const regular = await pdfDoc.embedFont(input.fontAssets.regularBytes, { subset });
  const bold = await pdfDoc.embedFont(input.fontAssets.boldBytes, { subset });
  const mono = await pdfDoc.embedFont(input.fontAssets.monoBytes, { subset });
  const signedAt = safePdfDate(input.signedAt);
  pdfDoc.setTitle(input.title || "創百業智慧鏈｜線上契約");
  pdfDoc.setAuthor("創百業智慧鏈");
  pdfDoc.setCreator(`創百業智慧鏈 Contract Renderer ${CONTRACT_PDF_RENDERER_VERSION}`);
  pdfDoc.setProducer(`pdf-lib ${CONTRACT_PDF_RENDERER_VERSION}`);
  pdfDoc.setCreationDate(signedAt);
  pdfDoc.setModificationDate(signedAt);

  const pages = [];
  let page, y;
  const newPage = () => { page = pdfDoc.addPage([A4.width, A4.height]); pages.push(page); y = A4.height - MARGIN.top; return page; };
  const requireHeight = (height) => { if (y - height < MARGIN.bottom + 18) newPage(); };
  const drawLines = (text, { font = regular, size = 10.75, lineHeight = size * 1.5, color = rgb(0.12, 0.12, 0.14), indent = 0, before = 0, after = 5, width = CONTENT_WIDTH - indent } = {}) => {
    y -= before;
    const lines = wrapByWidth(text, font, size, width);
    if (lines.length <= 3) requireHeight(lines.length * lineHeight + after);
    for (const line of lines) {
      if (y - lineHeight < MARGIN.bottom + 18) newPage();
      if (line) page.drawText(line, { x: MARGIN.left + indent, y, size, font, color });
      y -= lineHeight;
    }
    y -= after;
  };
  const drawKeyValue = (label, value, { size = 8.4, lineHeight = 11.8, after = 2 } = {}) => {
    if (y - lineHeight < MARGIN.bottom + 18) newPage();
    const labelText = String(label).replace(/：$/, ": ");
    const labelWidth = mono.widthOfTextAtSize(labelText, size);
    page.drawText(labelText, { x: MARGIN.left, y, size, font: mono, color: rgb(0.12, 0.12, 0.14) });
    const lines = wrapByWidth(String(value || "—"), mono, size, CONTENT_WIDTH - labelWidth);
    for (let index = 0; index < lines.length; index += 1) {
      if (index && y - lineHeight < MARGIN.bottom + 18) newPage();
      page.drawText(lines[index], { x: MARGIN.left + (index ? 12 : labelWidth), y, size, font: mono, color: rgb(0.12, 0.12, 0.14) });
      y -= lineHeight;
    }
    y -= after;
  };

  newPage();
  if (input.staging) drawLines("STAGING｜NOT A REAL CONTRACT", { font: bold, size: 11, color: rgb(0.72, 0.08, 0.08), after: 12 });
  drawLines("創百業智慧鏈", { font: bold, size: 12.5, after: 5 });
  drawLines(input.title || "線上契約", { font: bold, size: 18, lineHeight: 25, after: 16 });
  drawLines(`文件識別碼：${input.documentId || "—"}`, { size: 10.5, after: 3 });
  drawLines(`公開驗證碼：${input.publicId || "—"}`, { size: 10.5, after: 3 });
  drawLines(`契約版本：${input.version || "—"}`, { size: 10.5, after: 3 });
  drawLines(input.partyLabel || "", { size: 10.5, after: 3 });
  if (input.privateIdentityLabel) drawLines(input.privateIdentityLabel, { size: 10.5, after: 3 });
  if (input.contractPeriod) {
    drawLines(`契約期間：${formatContractDate(input.contractPeriod.period_start)} ～ ${formatContractDate(input.contractPeriod.period_end)}`, { font: bold, size: 10.75, after: 3 });
    const termLabel = Number(input.contractPeriod.term_months) === 3
      ? "三個月一期"
      : `${input.contractPeriod.term_months} 個月一期`;
    drawLines(`${termLabel}（Asia/Taipei）`, { size: 10.5, after: 3 });
  }
  drawLines(`簽署時間：${input.signedAt || "—"}`, { size: 10.5, after: 14 });

  const renderBlocks = (blocks) => {
    for (const block of blocks) {
      if (block.type === "heading") drawLines(block.text, { font: bold, size: 13.5, lineHeight: 20, before: 7, after: 7 });
      else if (block.type === "bullet") drawLines(`• ${block.text}`, { size: 10.75, indent: 12, width: CONTENT_WIDTH - 12, after: 4 });
      else if (block.type === "numbered") drawLines(block.text, { size: 10.75, indent: 12, width: CONTENT_WIDTH - 12, after: 4 });
      else drawLines(block.text, { size: 10.75, lineHeight: 16.2, after: 6 });
    }
  };
  renderBlocks(contractBlocksFromHtml(input.contentHtml));
  for (const attachment of input.attachments || []) {
    drawLines(attachment.title || "附件", { font: bold, size: 13.5, lineHeight: 20, before: 10, after: 7 });
    renderBlocks(contractBlocksFromHtml(attachment.contentHtml || attachment.content || ""));
  }

  newPage();
  drawLines("電子簽署紀錄", { font: bold, size: 16, lineHeight: 23, after: 12 });
  drawLines(`簽署姓名：${input.signatory || "—"}`, { after: 3 });
  drawLines(`簽署身份：${input.signatoryRole || "—"}`, { after: 3 });
  drawLines(`簽署時間：${input.signedAt || "—"}`, { after: 3 });
  drawLines(`契約版本：${input.version || "—"}`, { after: 3 });
  drawKeyValue("Document ID：", input.documentId, { size: 10.75, lineHeight: 16, after: 12 });
  drawLines("本人手寫簽名", { font: bold, size: 13.5, after: 8 });
  const box = { x: MARGIN.left, y: y - 158, width: CONTENT_WIDTH, height: 150 };
  page.drawRectangle({ ...box, borderWidth: 0.8, borderColor: rgb(0.55, 0.58, 0.62), color: rgb(0.99, 0.99, 0.985) });
  const strokes = parseSignature(input.signature);
  const points = strokes.flat().filter((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));
  if (points.length) {
    const xs = points.map((point) => Number(point[0])), ys = points.map((point) => Number(point[1]));
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = Math.min((box.width - 36) / Math.max(1, maxX - minX), (box.height - 28) / Math.max(1, maxY - minY));
    const toPdf = ([px, py]) => ({ x: box.x + 18 + (Number(px) - minX) * scale, y: box.y + box.height - 14 - (Number(py) - minY) * scale });
    for (const stroke of strokes) for (let index = 1; index < stroke.length; index++) page.drawLine({ start: toPdf(stroke[index - 1]), end: toPdf(stroke[index]), thickness: 1.5, color: rgb(0.08, 0.18, 0.42) });
  }
  y = box.y - 16;
  const evidenceLines = [
    ["Consent：", input.consentVersion || "—"],
    ["Contract SHA-256：", input.contractHash || "—"],
    ["Commercial Terms SHA-256：", input.commercialTermsHash || "N/A"],
    ["Signature SHA-256：", input.signatureHash || "—"],
    ["Document SHA-256：", documentHash],
    ["Signature Assurance：", input.assuranceLevel || "standard_electronic_agreement_evidence"],
    ["Verification URL：", input.verificationUrl || "—"],
  ];
  for (const [label, value] of evidenceLines) drawKeyValue(label, value);
  drawKeyValue("PDF Artifact SHA-256：", "see private metadata", { size: 8.4, lineHeight: 11.8, after: 2 });
  drawLines("PDF 產物雜湊由私人儲存 metadata 與驗證服務提供，避免自我雜湊循環。", { size: 8.8, lineHeight: 13, after: 3 });
  drawLines("手寫軌跡與系統紀錄屬線上契約簽署證據；不宣稱為憑證式數位簽章或政府認證電子簽章。", { size: 8.8, lineHeight: 13, after: 3 });

  pages.forEach((current, index) => {
    const footer = `創百業智慧鏈｜合作契約　${index + 1} / ${pages.length}`, size = 8.5;
    current.drawText(footer, { x: (A4.width - regular.widthOfTextAtSize(footer, size)) / 2, y: 25, size, font: regular, color: rgb(0.36, 0.38, 0.42) });
  });
  const bytes = await pdfDoc.save({ useObjectStreams: false, addDefaultPage: false, objectsPerTick: 50 });
  return { bytes, documentHash, pdfHash: await sha256(bytes), pageCount: pages.length, rendererVersion: CONTRACT_PDF_RENDERER_VERSION, fontAssetSha256: input.fontAssets.regularSha256, fontAssetBoldSha256: input.fontAssets.boldSha256, fontAssetMonoSha256: input.fontAssets.monoSha256 };
}

export const createSignedAgreementPdf = createSignedAgreementPdfV2;
export async function createSignedContractPdf(input) {
  return createSignedAgreementPdfV2({ ...input, title: "創百業智慧鏈｜承攬夥伴合作契約", documentId: input.contractId, partyLabel: `甲方：平台契約所載法律主體　乙方：${input.legalName}`, signatory: input.legalName, signatoryRole: "承攬夥伴", assuranceLevel: "standard_electronic_agreement_evidence" });
}
