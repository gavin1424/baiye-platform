import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import {
  calculatePartnerContractPeriod,
  decryptPartnerIdNumber,
  encryptPartnerIdNumber,
  hashPartnerIdNumber,
  isValidTaiwanIdNumber,
  maskTaiwanIdNumber,
  normalizeTaiwanIdNumber,
  partnerPeriodDisplayStatus,
  taipeiDateFromInstant,
} from "../src/partner-identity.js";
import {
  buildSignedAgreement,
  parseAndValidateSignature,
  publicVerificationRecord,
  validateExplicitConsents,
} from "../src/contract-engine.js";

const ENCRYPTION_KEY = "v15-test-encryption-key-32-bytes-minimum";
const HASH_KEY = "v15-test-hmac-key-32-bytes-minimum-value";
const VALID_ID = "A123456789";
const signature = JSON.stringify({ strokes: [
  [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]],
  [[7, 7], [8, 8], [9, 9], [10, 10], [11, 11], [12, 12]],
] });

function database() {
  const sqlite = new DatabaseSync(":memory:");
  const files = readdirSync(new URL("../migrations", import.meta.url)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
  for (const file of files) sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  return sqlite;
}

function insertPartner(db, id = "partner-v15") {
  db.prepare("INSERT INTO partners(id,partner_code,legal_name,display_name,email,phone,status,referral_code) VALUES(?,?,?,?,?,?,?,?)")
    .run(id, `AG-${id}`, "王小明", "王小明", `${id}@example.test`, "0912345678", "active", `REF-${id}`);
}

test("V15-01 身分證英文自動轉大寫", () => assert.equal(normalizeTaiwanIdNumber(" a123456789 "), VALID_ID));
test("V15-02 合法台灣身分證通過 checksum", () => assert.equal(isValidTaiwanIdNumber(VALID_ID), true));
test("V15-03 Regex 合法但 checksum 錯誤仍拒絕", () => assert.equal(isValidTaiwanIdNumber("A123456788"), false));
test("V15-04 第二碼非 1/2 被拒絕", () => assert.equal(isValidTaiwanIdNumber("A323456789"), false));
test("V15-05 身分證遮罩只保留末四碼", () => assert.equal(maskTaiwanIdNumber(VALID_ID), "******6789"));
test("V15-06 AES-GCM 密文不含明文", async () => { const encrypted = await encryptPartnerIdNumber(VALID_ID, ENCRYPTION_KEY); assert.doesNotMatch(encrypted, /A123456789/); assert.match(encrypted, /^v1\./); });
test("V15-07 AES-GCM 可以用正確密鑰還原", async () => { const encrypted = await encryptPartnerIdNumber(VALID_ID, ENCRYPTION_KEY); assert.equal(await decryptPartnerIdNumber(encrypted, ENCRYPTION_KEY), VALID_ID); });
test("V15-08 AES-GCM 錯誤密鑰不可解密", async () => { const encrypted = await encryptPartnerIdNumber(VALID_ID, ENCRYPTION_KEY); await assert.rejects(() => decryptPartnerIdNumber(encrypted, `${ENCRYPTION_KEY}-wrong`), (error) => error.code === "PARTNER_ID_DECRYPTION_FAILED"); });
test("V15-09 HMAC hash 穩定", async () => assert.equal(await hashPartnerIdNumber(VALID_ID, HASH_KEY), await hashPartnerIdNumber("a123456789", HASH_KEY)));
test("V15-10 不同 HMAC Secret 產生不同結果", async () => assert.notEqual(await hashPartnerIdNumber(VALID_ID, HASH_KEY), await hashPartnerIdNumber(VALID_ID, `${HASH_KEY}-different`)));
test("V15-11 過短加密 Secret 安全拒絕", async () => assert.rejects(() => encryptPartnerIdNumber(VALID_ID, "short"), (error) => error.code === "PARTNER_ID_SECURITY_UNAVAILABLE"));
test("V15-12 過短 HMAC Secret 安全拒絕", async () => assert.rejects(() => hashPartnerIdNumber(VALID_ID, "short"), (error) => error.code === "PARTNER_ID_SECURITY_UNAVAILABLE"));

test("V15-13 契約版本 v1.5 存在", () => assert.equal(database().prepare("SELECT version FROM contract_versions WHERE id='contractor_partner_v1_5'").get().version, "v1.5"));
test("V15-14 v1.5 保持 pending_review", () => assert.equal(database().prepare("SELECT legal_review_status FROM contract_versions WHERE id='contractor_partner_v1_5'").get().legal_review_status, "pending_review"));
test("V15-15 v1.5 保持 inactive", () => assert.equal(database().prepare("SELECT is_active FROM contract_versions WHERE id='contractor_partner_v1_5'").get().is_active, 0));
test("V15-16 v1.5 requires_resign", () => assert.equal(database().prepare("SELECT requires_resign FROM contract_versions WHERE id='contractor_partner_v1_5'").get().requires_resign, 1));
test("V15-17 v1.5 term 固定三個月", () => assert.equal(database().prepare("SELECT contract_term_months FROM contract_versions WHERE id='contractor_partner_v1_5'").get().contract_term_months, 3));
test("V15-18 v1.4 內容保持存在", () => assert.ok(database().prepare("SELECT content_html FROM contract_versions WHERE id='contractor_partner_v1_4'").get().content_html));
test("V15-19 已簽契約版本不可修改", () => { const db = database(); insertPartner(db); db.prepare("INSERT INTO contract_signatures(id,partner_id,contract_version_id,legal_name,signed_at,contract_content_hash,signature_hash,consent_version) VALUES('sig-v15','partner-v15','contractor_partner_v1_5','王小明',CURRENT_TIMESTAMP,'h','h','v')").run(); assert.throws(() => db.prepare("UPDATE contract_versions SET content_html='changed' WHERE id='contractor_partner_v1_5'").run(), /IMMUTABLE/); });

test("V15-20 2026-09-01 起算到 2026-11-30", () => assert.deepEqual(calculatePartnerContractPeriod("2026-09-01"), { period_start: "2026-09-01", period_end: "2026-11-30", term_months: 3, timezone: "Asia/Taipei" }));
test("V15-21 年度跨界三個月正確", () => assert.equal(calculatePartnerContractPeriod("2026-11-15").period_end, "2027-02-14"));
test("V15-22 月底起算不產生不存在日期", () => assert.equal(calculatePartnerContractPeriod("2026-11-30").period_end, "2027-02-28"));
test("V15-23 閏年月底正確", () => assert.equal(calculatePartnerContractPeriod("2023-11-30").period_end, "2024-02-29"));
test("V15-24 不合法日期被拒絕", () => assert.throws(() => calculatePartnerContractPeriod("2026-02-30"), /Invalid/));
test("V15-25 台灣跨 UTC 日期取 Asia/Taipei", () => assert.equal(taipeiDateFromInstant("2026-08-31T16:30:00Z"), "2026-09-01"));
test("V15-26 到期前 30 天顯示即將到期", () => assert.equal(partnerPeriodDisplayStatus("2026-11-30", "2026-10-31").status, "expiring"));
test("V15-27 到期日結束前仍顯示即將到期", () => assert.equal(partnerPeriodDisplayStatus("2026-11-30", "2026-11-30").status, "expiring"));
test("V15-28 逾期顯示 expired", () => assert.equal(partnerPeriodDisplayStatus("2026-11-30", "2026-12-01").status, "expired"));
test("V15-29 期間核心資料不可修改", () => { const db = database(); insertPartner(db); db.prepare("INSERT INTO contract_signatures(id,partner_id,contract_version_id,legal_name,signed_at,contract_content_hash,signature_hash,consent_version) VALUES('s','partner-v15','contractor_partner_v1_5','王',CURRENT_TIMESTAMP,'h','h','v')").run(); db.prepare("INSERT INTO partner_contract_periods(id,partner_id,contract_signature_id,contract_version_id,period_start,period_end) VALUES('p','partner-v15','s','contractor_partner_v1_5','2026-09-01','2026-11-30')").run(); assert.throws(() => db.prepare("UPDATE partner_contract_periods SET period_end='2027-01-01' WHERE id='p'").run(), /IMMUTABLE/); });
test("V15-30 契約期間不可刪除", () => { const db = database(); insertPartner(db); db.prepare("INSERT INTO contract_signatures(id,partner_id,contract_version_id,legal_name,signed_at,contract_content_hash,signature_hash,consent_version) VALUES('s','partner-v15','contractor_partner_v1_5','王',CURRENT_TIMESTAMP,'h','h','v')").run(); db.prepare("INSERT INTO partner_contract_periods(id,partner_id,contract_signature_id,contract_version_id,period_start,period_end) VALUES('p','partner-v15','s','contractor_partner_v1_5','2026-09-01','2026-11-30')").run(); assert.throws(() => db.prepare("DELETE FROM partner_contract_periods WHERE id='p'").run(), /IMMUTABLE/); });

test("V15-31 身分證 Hash 唯一防重", async () => { const db = database(); insertPartner(db, "a"); insertPartner(db, "b"); const encrypted = await encryptPartnerIdNumber(VALID_ID, ENCRYPTION_KEY), hash = await hashPartnerIdNumber(VALID_ID, HASH_KEY); db.prepare("UPDATE partners SET id_number_encrypted=?,id_number_hash=?,id_number_last4=? WHERE id='a'").run(encrypted, hash, "6789"); assert.throws(() => db.prepare("UPDATE partners SET id_number_encrypted=?,id_number_hash=?,id_number_last4=? WHERE id='b'").run(encrypted, hash, "6789"), /UNIQUE/); });
test("V15-32 身分資料首次補齊後不可覆寫", async () => { const db = database(); insertPartner(db); const encrypted = await encryptPartnerIdNumber(VALID_ID, ENCRYPTION_KEY), hash = await hashPartnerIdNumber(VALID_ID, HASH_KEY); db.prepare("UPDATE partners SET id_number_encrypted=?,id_number_hash=?,id_number_last4=? WHERE id='partner-v15'").run(encrypted, hash, "6789"); assert.throws(() => db.prepare("UPDATE partners SET id_number_last4='0000' WHERE id='partner-v15'").run(), /IMMUTABLE/); });
test("V15-33 既有 Partner 預設需要補身分", () => { const db = database(); insertPartner(db); assert.equal(db.prepare("SELECT identity_completion_required FROM partners WHERE id='partner-v15'").get().identity_completion_required, 1); });
test("V15-34 五項同意完整才通過", () => assert.doesNotThrow(() => validateExplicitConsents({ read: true, electronic: true, independent: true, identity: true, block_letter_signature: true }, "partner", "partner-contract-consent-v1.5")));
test("V15-35 缺少本人身分確認被拒絕", () => assert.throws(() => validateExplicitConsents({ read: true, electronic: true, independent: true, block_letter_signature: true }, "partner", "partner-contract-consent-v1.5"), /確認項目/));
test("V15-36 缺少正楷親簽確認被拒絕", () => assert.throws(() => validateExplicitConsents({ read: true, electronic: true, independent: true, identity: true }, "partner", "partner-contract-consent-v1.5"), /確認項目/));
test("V15-37 一筆畫簽名被拒絕", () => assert.throws(() => parseAndValidateSignature(JSON.stringify({ strokes: [JSON.parse(signature).strokes[0]] }), { minimumPoints: 12, minimumStrokes: 2 }), /簽名/));
test("V15-38 兩筆畫且足夠點數簽名通過", () => assert.equal(parseAndValidateSignature(signature, { minimumPoints: 12, minimumStrokes: 2 }).pointCount, 12));
test("V15-39 公開驗證紀錄不含身分資料", () => { const value = publicVerificationRecord({ public_id: "PUB", signed_at: "2026-09-01", status: "VALID", document_hash: "HASH", id_number_last4: "6789", id_number_hash: "secret" }, "CONTRACTOR_PARTNER", "v1.5"); assert.equal("id_number_last4" in value, false); assert.equal("id_number_hash" in value, false); });
test("V15-40 私有 PDF 可含完整 ID、Evidence 僅含 Hash", async () => { const agreement = await buildSignedAgreement({ title: "創百業智慧鏈｜承攬夥伴合作契約", documentId: "doc", publicId: "PUB", verificationUrl: "https://example.test/#/verify/PUB", contract: { version: "v1.5", content_html: "<p>三個月一期</p>", content_hash: "hash" }, partyType: "partner", partyId: "partner-v15", partyLabel: "甲方／乙方", signatory: "王小明", signatoryRole: "承攬夥伴", identityHash: "id-hmac", privateIdentityLabel: `乙方身分證字號：${VALID_ID}`, contractPeriod: calculatePartnerContractPeriod("2026-09-01"), signedAt: "2026-09-01T00:00:00.000Z", signature, signatureValidation: { minimumPoints: 12, minimumStrokes: 2 }, consents: { read: true, electronic: true, independent: true, identity: true, block_letter_signature: true }, consentVersion: "partner-contract-consent-v1.5" }); const pdfText = new TextDecoder().decode(agreement.bytes); assert.match(pdfText, /0041003100320033003400350036003700380039/); assert.equal(JSON.stringify(agreement.evidence).includes(VALID_ID), false); assert.equal(agreement.evidence.identity_hash, "id-hmac"); });
