import { createSignedAgreementPdf, sha256 } from "./contract-pdf.js";
import { loadContractFontAssets } from "./contract-font-assets.js";

export const STANDARD_ASSURANCE = "standard_electronic_agreement_evidence";
export const CERTIFICATE_ASSURANCE = "certificate_digital_signature";

export class ContractError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export async function hashCanonical(value) {
  return sha256(stableStringify(value));
}

export function parseAndValidateSignature(signature, { minimumPoints = 6, minimumStrokes = 1 } = {}) {
  let parsed;
  try { parsed = typeof signature === "string" ? JSON.parse(signature) : signature; }
  catch { throw new ContractError("SIGNATURE_INVALID", "簽名資料格式不正確。", 422); }
  if (!parsed || !Array.isArray(parsed.strokes)) throw new ContractError("SIGNATURE_REQUIRED", "請完成手寫簽名。", 422);
  const strokes = parsed.strokes
    .filter((stroke) => Array.isArray(stroke))
    .map((stroke) => stroke.filter((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)));
  const points = strokes.reduce((total, stroke) => total + stroke.length, 0);
  const meaningfulStrokes = strokes.filter((stroke) => stroke.length >= 2).length;
  if (meaningfulStrokes < minimumStrokes || points < minimumPoints) {
    throw new ContractError("SIGNATURE_TOO_SHORT", "簽名筆劃不足，請重新完整簽名。", 422);
  }
  const normalized = { strokes: strokes.map((stroke) => stroke.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100])) };
  const serialized = stableStringify(normalized);
  if (serialized.length > 100000) throw new ContractError("SIGNATURE_TOO_LARGE", "簽名資料超過允許大小。", 413);
  return { normalized, serialized, pointCount: points };
}

export function assertContractSignable(contract, env = {}) {
  const staging = env.CONTRACT_SIGNING_MODE === "staging";
  const stagingPreviewEnabled = staging && Number(contract?.staging_signing_enabled) === 1;
  if (!contract || (Number(contract.is_active) !== 1 && !stagingPreviewEnabled)) {
    throw new ContractError("CONTRACT_NOT_ACTIVE", "目前沒有可簽署的有效契約版本。", 409);
  }
  if (contract.legal_review_status === "revoked") throw new ContractError("CONTRACT_REVOKED", "此契約版本已撤銷。", 409);
  if (contract.legal_review_status !== "approved" && !staging) {
    throw new ContractError("LEGAL_REVIEW_REQUIRED", "此契約版本尚未完成正式法律審閱，目前不可簽署。", 423);
  }
  if (contract.legal_review_status === "approved" && contract.approved_content_hash !== contract.content_hash) {
    throw new ContractError("APPROVED_HASH_MISMATCH", "契約核准內容雜湊不一致，已停止簽署。", 409);
  }
  return { staging };
}

export function validateExplicitConsents(consents, partyType) {
  const required = partyType === "partner"
    ? ["read", "electronic", "independent"]
    : ["read", "electronic", "commercial_terms", "authority", "signature_evidence"];
  const missing = required.filter((key) => consents?.[key] !== true);
  if (missing.length) throw new ContractError("CONSENT_REQUIRED", "請完成全部契約確認項目。", 422, { missing });
  return required.reduce((result, key) => ({ ...result, [key]: true }), {});
}

export async function buildSignedAgreement(input) {
  const signature = parseAndValidateSignature(input.signature, input.signatureValidation);
  const consents = validateExplicitConsents(input.consents, input.partyType);
  const signatureHash = await sha256(signature.serialized);
  const documentId = input.documentId;
  const signedAt = input.signedAt || new Date().toISOString();
  const canonicalDocument = {
    document_id: documentId,
    contract_version: input.contract.version,
    contract_content_hash: input.contract.content_hash,
    commercial_terms_hash: input.commercialTermsHash || null,
    party_type: input.partyType,
    party_id: input.partyId,
    signatory: input.signatory,
    signatory_role: input.signatoryRole,
    signature_hash: signatureHash,
    signed_at: signedAt,
    consents,
    consent_version: input.consentVersion,
    signature_assurance_level: STANDARD_ASSURANCE,
  };
  const documentHash = await hashCanonical(canonicalDocument);
  const fontAssets = input.fontAssets || await loadContractFontAssets(input.contractAssetsBucket);
  const pdf = await createSignedAgreementPdf({
    title: input.title,
    documentId,
    publicId: input.publicId,
    verificationUrl: input.verificationUrl,
    version: input.contract.version,
    partyLabel: input.partyLabel,
    signatory: input.signatory,
    signatoryRole: input.signatoryRole,
    signedAt,
    contentHtml: input.contract.content_html,
    attachments: input.attachments || [],
    contractHash: input.contract.content_hash,
    commercialTermsHash: input.commercialTermsHash || null,
    signatureHash,
    documentHash,
    consentVersion: input.consentVersion,
    assuranceLevel: STANDARD_ASSURANCE,
    signature: signature.serialized,
    staging: Boolean(input.staging),
    privateIdentityLabel: input.privateIdentityLabel || null,
    contractPeriod: input.contractPeriod || null,
    fontAssets,
  });
  const evidence = {
    ...canonicalDocument,
    public_id: input.publicId,
    pdf_hash: pdf.pdfHash,
    ip: input.ip || null,
    user_agent: input.userAgent || null,
    session_evidence: input.sessionEvidence || null,
    invite_evidence: input.inviteEvidence || null,
    signature_point_count: signature.pointCount,
    pdf_renderer_version: pdf.rendererVersion,
    font_asset_sha256: pdf.fontAssetSha256,
    font_asset_bold_sha256: pdf.fontAssetBoldSha256,
    font_asset_mono_sha256: pdf.fontAssetMonoSha256,
    environment: input.staging ? "STAGING_NOT_A_REAL_CONTRACT" : "PRODUCTION",
  };
  return { ...pdf, evidence, evidenceBytes: new TextEncoder().encode(stableStringify(evidence)), signatureHash, signatureData: signature.serialized, documentHash, signedAt, consents };
}

export async function storePrivateAgreementArtifacts(bucket, prefix, agreement) {
  if (!bucket) throw new ContractError("PRIVATE_STORAGE_UNAVAILABLE", "私人契約儲存空間目前無法使用。", 503);
  const pdfKey = `${prefix}/signed-${agreement.pdfHash}.pdf`;
  const evidenceHash = await sha256(agreement.evidenceBytes);
  const evidenceKey = `${prefix}/evidence-${evidenceHash}.json`;
  const created = [];
  try {
    await bucket.put(pdfKey, agreement.bytes, { httpMetadata: { contentType: "application/pdf", contentDisposition: "attachment" } });
    created.push(pdfKey);
    await bucket.put(evidenceKey, agreement.evidenceBytes, { httpMetadata: { contentType: "application/json", contentDisposition: "attachment" } });
    created.push(evidenceKey);
    return { pdfKey, evidenceKey, evidenceHash, cleanup: async () => Promise.all(created.map((key) => bucket.delete(key))) };
  } catch (error) {
    await Promise.all(created.map((key) => bucket.delete(key).catch(() => undefined)));
    throw error;
  }
}

export async function sessionEvidenceHash(sessionId) {
  return sha256(`contract-session-v1:${String(sessionId || "unknown")}`);
}

export function publicVerificationRecord(row, type, version) {
  return {
    document_id: row.public_id,
    contract_type: type,
    version,
    signed_at: row.signed_at,
    status: row.status,
    document_hash: row.document_hash,
  };
}

export async function beginContractOperation(db, { partyType, partyId, operationType, idempotencyKey }) {
  if (!idempotencyKey || idempotencyKey.length < 12 || idempotencyKey.length > 160) {
    throw new ContractError("IDEMPOTENCY_KEY_REQUIRED", "缺少有效的 Idempotency-Key。", 400);
  }
  const existing = await db.prepare("SELECT * FROM contract_sign_operations WHERE party_type=? AND party_id=? AND operation_type=? AND idempotency_key=?")
    .bind(partyType, partyId, operationType, idempotencyKey).first();
  if (existing?.status === "completed") return { replay: true, operation: existing, result: JSON.parse(existing.result_json || "{}") };
  if (existing?.status === "processing" && new Date(existing.expires_at) > new Date()) throw new ContractError("OPERATION_IN_PROGRESS", "簽署作業處理中，請勿重複送出。", 409);
  const operation = existing || { id: `contractop_${crypto.randomUUID()}` };
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  if (existing) await db.prepare("UPDATE contract_sign_operations SET status='processing',expires_at=?,result_json=NULL WHERE id=?").bind(expiresAt, existing.id).run();
  else await db.prepare("INSERT INTO contract_sign_operations(id,party_type,party_id,operation_type,idempotency_key,expires_at) VALUES(?,?,?,?,?,?)")
    .bind(operation.id, partyType, partyId, operationType, idempotencyKey, expiresAt).run();
  return { replay: false, operation: { ...operation, expires_at: expiresAt } };
}

export async function completeContractOperation(db, operationId, result) {
  await db.prepare("UPDATE contract_sign_operations SET status='completed',result_json=?,completed_at=CURRENT_TIMESTAMP WHERE id=? AND status='processing'")
    .bind(JSON.stringify(result), operationId).run();
}
