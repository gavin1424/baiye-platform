import { sha256 } from "./contract-pdf.js";
import { TAIPEI_TIME_ZONE } from "./taipei-date.js";

const encoder = new TextEncoder();
const money = (minor) =>
  `NT$${Math.trunc(Number(minor || 0) / 100).toLocaleString("zh-TW")}`;
const taipeiDateTime = (value) =>
  new Intl.DateTimeFormat("zh-TW", {
    timeZone: TAIPEI_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: false,
  }).format(new Date(value));
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

function stream(lines, page, pages) {
  const commands = ["BT", "/F1 10 Tf", "48 795 Td"];
  for (const line of lines) commands.push(`<${textHex(line)}> Tj`, "0 -18 Td");
  commands.push(
    "ET",
    `BT /F1 8 Tf 230 25 Td <${textHex(`創百業智慧鏈｜月結對帳單 ${page}/${pages}`)}> Tj ET`,
  );
  return commands.join("\n");
}

export async function createSettlementPdf(input) {
  const statementHash =
    input.statement_hash ||
    (await sha256(
      JSON.stringify({
        statement_no: input.statement_no,
        merchant_id: input.merchant_id,
        period_start: input.period_start,
        period_end: input.period_end,
        calculation_version: input.calculation_version,
        rules_snapshot_json: input.rules_snapshot_json,
        payable: input.merchant_payable_minor,
      }),
    ));
  const generatedAt = input.generated_at || new Date().toISOString();
  const lines = [
    "創百業智慧鏈｜平台訂金代收月結對帳單",
    `對帳單編號：${input.statement_no}`,
    `對帳期間：${input.period_start} 至 ${input.period_end}`,
    `店家名稱：${input.merchant_name}`,
    `商家識別碼：${input.merchant_id}`,
    `統編／身分資料：${input.merchant_identity_masked || "未提供"}`,
    `平台法律主體：${input.platform_legal_name || "未設定"}`,
    `平台統編：${input.platform_tax_id || "未設定"}`,
    "",
    `訂單總額：${money(input.total_order_amount_minor)}`,
    `預期訂金：${money(input.expected_deposit_amount_minor)}`,
    `實際代收訂金：${money(input.actual_deposit_collected_minor ?? input.deposit_collected_minor)}`,
    `訂金差異：${money(input.deposit_variance_minor)}`,
    `實際金流手續費：${money(input.actual_fee_total_minor)}`,
    `估算金流手續費：${money(input.estimated_fee_total_minor)}`,
    `缺少實際手續費筆數：${Number(input.missing_actual_fee_count || 0)}`,
    `平台作業服務費：${money(input.platform_service_fee_minor)}`,
    `稅務預留款：${money(input.tax_reserve_minor)}`,
    `扣繳款：${money(input.withholding_minor)}`,
    `調整項目：${money(input.adjustments_minor)}`,
    `本期淨結算：${money(input.net_settlement_minor)}`,
    `應撥店家金額：${money(input.merchant_payable_minor)}`,
    `店家待返還平台：${money(input.merchant_due_to_platform_minor)}`,
    `下期承接餘額：${money(input.carry_forward_balance_minor)}`,
    "",
    `上期抵付：${money(input.prior_offset_amount_minor)}`,
    `本期抵付：${money(input.current_offset_amount_minor)}`,
    `累計抵付：${money(input.cumulative_offset_amount_minor)}`,
    `剩餘抵付：${money(input.remaining_offset_amount_minor)}`,
    `抵付完成後平台費：${money(input.ongoing_platform_fee_minor)}`,
    "",
    `匯款狀態：${input.status}`,
    `匯款日期：${input.transfer_date || "尚未匯款"}`,
    `匯款 reference：${input.transfer_reference || "—"}`,
    `平台服務費發票號碼：${input.platform_invoice_no || "—"}`,
    `規則版本：${input.calculation_version}`,
    `對帳單 Hash：${statementHash}`,
    `產生時間（Asia/Taipei）：${taipeiDateTime(generatedAt)}`,
    "",
    "本對帳單依實際交易、金流 Provider 費用、退款、調整項目與有效契約產生。",
    "稅務預留與扣繳僅依經核准設定列示，不代表平台代收代繳營業稅。",
  ];
  const pageLines = [];
  for (let index = 0; index < lines.length; index += 38)
    pageLines.push(lines.slice(index, index + 38));
  const objects = [];
  const add = (value) => {
    objects.push(value);
    return objects.length;
  };
  const catalog = add("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesObject = add("");
  const font = add(
    "<< /Type /Font /Subtype /Type0 /BaseFont /MSung-Light /Encoding /UniCNS-UTF16-H /DescendantFonts [4 0 R] >>",
  );
  add(
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /MSung-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (CNS1) /Supplement 7 >> >>",
  );
  const refs = [];
  pageLines.forEach((page, index) => {
    const contentStream = stream(page, index + 1, pageLines.length);
    const content = add(
      `<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}\nendstream`,
    );
    const object = add(
      `<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`,
    );
    refs.push(`${object} 0 R`);
  });
  objects[pagesObject - 1] =
    `<< /Type /Pages /Kids [${refs.join(" ")}] /Count ${refs.length} >>`;
  let pdf = "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = encoder.encode(pdf);
  return { bytes, statementHash, pdfHash: await sha256(bytes), generatedAt };
}

export function settlementCsv(statement, items = [], adjustments = []) {
  const rows = [
    ["對帳單編號", statement.statement_no],
    ["商家", statement.merchant_name || statement.merchant_id],
    ["期間", `${statement.period_start}~${statement.period_end}`],
    ["狀態", statement.status],
    ["訂單總額(分)", statement.total_order_amount_minor],
    ["預期訂金(分)", statement.expected_deposit_amount_minor],
    ["實際代收訂金(分)", statement.actual_deposit_collected_minor],
    ["訂金差異(分)", statement.deposit_variance_minor],
    ["實際手續費(分)", statement.actual_fee_total_minor],
    ["估算手續費(分)", statement.estimated_fee_total_minor],
    ["缺少實際手續費筆數", statement.missing_actual_fee_count],
    ["平台作業服務費(分)", statement.platform_service_fee_minor],
    ["稅務預留(分)", statement.tax_reserve_minor],
    ["扣繳(分)", statement.withholding_minor],
    ["調整(分)", statement.adjustments_minor],
    ["淨結算(分)", statement.net_settlement_minor],
    ["應撥店家(分)", statement.merchant_payable_minor],
    ["店家待返還平台(分)", statement.merchant_due_to_platform_minor],
    ["下期承接餘額(分)", statement.carry_forward_balance_minor],
    [],
    [
      "類型",
      "來源",
      "訂單總額(分)",
      "預期訂金(分)",
      "實際訂金(分)",
      "手續費(分)",
      "手續費來源",
      "金額(分)",
      "發生時間(UTC；顯示基準 Asia/Taipei)",
    ],
    ...items.map((item) => [
      item.item_type,
      item.source_id,
      item.order_total_amount_minor,
      item.expected_deposit_amount_minor,
      item.actual_deposit_amount_minor,
      item.processing_fee_minor,
      item.processing_fee_source,
      item.amount_minor,
      item.occurred_at,
    ]),
    ...adjustments.map((item) => [
      item.adjustment_type,
      item.source_reference || item.id,
      `deposit=${item.deposit_reversal_minor || 0}`,
      `platform=${item.platform_fee_reversal_minor || 0}`,
      `provider=${item.provider_fee_reversal_minor || 0}`,
      "",
      item.amount_minor,
      item.effective_date || item.created_at,
    ]),
  ];
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return new Uint8Array([
    0xef,
    0xbb,
    0xbf,
    ...encoder.encode(
      rows.map((row) => row.map(escape).join(",")).join("\r\n"),
    ),
  ]);
}
