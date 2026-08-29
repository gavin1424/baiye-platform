const encoder = new TextEncoder();

export async function sha256(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function textHex(value) {
  let output = "FEFF";
  for (const char of String(value)) {
    const code = char.codePointAt(0);
    if (code > 0xffff) {
      const adjusted = code - 0x10000;
      output += (0xd800 + (adjusted >> 10)).toString(16).padStart(4, "0");
      output += (0xdc00 + (adjusted & 0x3ff)).toString(16).padStart(4, "0");
    } else output += code.toString(16).padStart(4, "0");
  }
  return output.toUpperCase();
}

function contractLines(html) {
  const plain = String(html)
    .replace(/<\/(p|h\d|li|div|br)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ").replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<").replaceAll("&gt;", ">")
    .replace(/\n{2,}/g, "\n").trim();
  const lines = [];
  for (const paragraph of plain.split("\n")) {
    const value = paragraph.trim();
    if (!value) continue;
    for (let index = 0; index < value.length; index += 42) lines.push(value.slice(index, index + 42));
  }
  return lines;
}

function wrapPdfLine(value, limit = 42) {
  const characters = Array.from(String(value));
  if (characters.length <= limit) return [String(value)];
  const lines = [];
  for (let index = 0; index < characters.length; index += limit) lines.push(characters.slice(index, index + limit).join(""));
  return lines;
}

function signatureCommands(signature) {
  try {
    const parsed = JSON.parse(signature);
    if (!Array.isArray(parsed.strokes)) return "";
    const commands = ["q 0.08 0.18 0.48 RG 1.4 w"];
    for (const stroke of parsed.strokes) {
      if (!Array.isArray(stroke) || stroke.length < 2) continue;
      const first = stroke[0];
      commands.push(`${80 + Number(first[0]) * 0.85} ${220 - Number(first[1]) * 0.55} m`);
      for (const point of stroke.slice(1)) commands.push(`${80 + Number(point[0]) * 0.85} ${220 - Number(point[1]) * 0.55} l`);
      commands.push("S");
    }
    commands.push("Q");
    return commands.join("\n");
  } catch { return ""; }
}

function pageStream(lines, pageNo, pageCount) {
  const commands = ["BT", "/F1 10 Tf", "48 795 Td"];
  for (const line of lines) {
    commands.push(`<${textHex(line)}> Tj`, "0 -17 Td");
  }
  commands.push("ET", `BT /F1 8 Tf 275 25 Td <${textHex(`創百業智慧鏈 合作契約 | ${pageNo} / ${pageCount}`)}> Tj ET`);
  return commands.join("\n");
}

/** Generates a deterministic, immutable PDF artifact. The visible document hash is
 * over the signed content; the final artifact SHA-256 is returned separately. */
export async function createSignedAgreementPdf(input) {
  const documentHash = input.documentHash || await sha256(JSON.stringify({
    contractId: input.documentId, version: input.version, contentHash: input.contractHash,
    signatureHash: input.signatureHash, legalName: input.signatory, signedAt: input.signedAt,
  }));
  const rawBody = [
    input.staging ? "STAGING｜NOT A REAL CONTRACT" : "",
    input.title, `文件識別碼：${input.documentId}`, `公開驗證碼：${input.publicId || "—"}`,
    `合約版本：${input.version}　${input.partyLabel}`,
    input.privateIdentityLabel || "",
    input.contractPeriod ? `契約期間：${input.contractPeriod.period_start} ～ ${input.contractPeriod.period_end}（${input.contractPeriod.term_months} 個月一期，Asia/Taipei）` : "",
    `簽署時間：${input.signedAt}`, "",
    ...(input.attachments || []).flatMap((attachment) => [attachment.title, ...contractLines(attachment.contentHtml || attachment.content || "")]),
    ...contractLines(input.contentHtml), "", "電子簽署證據", `簽署姓名：${input.signatory}`,
    `簽署身份：${input.signatoryRole || "—"}`, "手寫簽名軌跡如下：", "", "", "",
    `Consent：${input.consentVersion}`, `Contract SHA-256：${input.contractHash}`,
    `Commercial Terms SHA-256：${input.commercialTermsHash || "N/A"}`,
    `Signature SHA-256：${input.signatureHash}`, `Document SHA-256：${documentHash}`,
    `Signature Assurance：${input.assuranceLevel || "standard_electronic_agreement_evidence"}`,
    `驗證頁：${input.verificationUrl || "—"}`,
    "PDF Artifact SHA-256 由私人儲存 metadata 與驗證服務提供，避免自我雜湊循環。",
    "手寫軌跡與系統紀錄屬線上契約簽署證據；不宣稱為憑證式數位簽章或政府認證電子簽章。",
  ];
  const body = rawBody.flatMap((line) => wrapPdfLine(line));
  // Reserve the lower half of the final page for the handwritten evidence.
  // A smaller page body also prevents long hash/verification lines from
  // colliding with the signature when attachments expand the document.
  const perPage = 30, pages = [];
  for (let index = 0; index < body.length; index += perPage) pages.push(body.slice(index, index + perPage));
  const objects = [];
  const add = (value) => { objects.push(value); return objects.length; };
  const catalog = add("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesObject = add("");
  const font = add("<< /Type /Font /Subtype /Type0 /BaseFont /MSung-Light /Encoding /UniCNS-UTF16-H /DescendantFonts [4 0 R] >>");
  const cidFont = add("<< /Type /Font /Subtype /CIDFontType0 /BaseFont /MSung-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (CNS1) /Supplement 7 >> /FontDescriptor 5 0 R /DW 1000 >>");
  add("<< /Type /FontDescriptor /FontName /MSung-Light /Flags 4 /FontBBox [-160 -249 1015 888] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 80 /MissingWidth 1000 >>");
  const pageRefs = [];
  for (let index = 0; index < pages.length; index++) {
    const signature = index === pages.length - 1 ? `\n${signatureCommands(input.signature)}` : "";
    const stream = `${pageStream(pages[index], index + 1, pages.length)}${signature}`;
    const content = add(`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);
    const page = add(`<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`);
    pageRefs.push(`${page} 0 R`);
  }
  objects[pagesObject - 1] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`;
  let pdf = "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(encoder.encode(pdf).length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = encoder.encode(pdf);
  return { bytes, documentHash, pdfHash: await sha256(bytes) };
}

/** Backward-compatible Partner wrapper. */
export async function createSignedContractPdf(input) {
  return createSignedAgreementPdf({
    ...input,
    title: "創百業智慧鏈｜承攬夥伴合作契約",
    documentId: input.contractId,
    partyLabel: `甲方：平台契約所載法律主體　乙方：${input.legalName}`,
    signatory: input.legalName,
    signatoryRole: "承攬夥伴",
    assuranceLevel: "standard_electronic_agreement_evidence",
  });
}
