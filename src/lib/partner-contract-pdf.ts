const PLATFORM_API = (
  import.meta.env.VITE_PLATFORM_API_URL ||
  "https://chuang-baiye-ai.baiye-platform.workers.dev"
).replace(/\/$/, "");

export type PartnerContractPdfErrorCode = "UNAUTHORIZED" | "NOT_FOUND" | "LOAD_FAILED";

export class PartnerContractPdfError extends Error {
  code: PartnerContractPdfErrorCode;

  constructor(code: PartnerContractPdfErrorCode) {
    super(code);
    this.code = code;
  }
}

export async function fetchContractPdfBlob(signatureId: string): Promise<Blob> {
  try {
    const response = await fetch(
      `${PLATFORM_API}/api/partner/contracts/${encodeURIComponent(signatureId)}/pdf`,
      { credentials: "include" },
    );
    if (response.status === 401 || response.status === 403) {
      throw new PartnerContractPdfError("UNAUTHORIZED");
    }
    if (response.status === 404) {
      throw new PartnerContractPdfError("NOT_FOUND");
    }
    if (!response.ok) {
      throw new PartnerContractPdfError("LOAD_FAILED");
    }
    const blob = await response.blob();
    if (!blob.size) throw new PartnerContractPdfError("LOAD_FAILED");
    return blob.type === "application/pdf"
      ? blob
      : new Blob([blob], { type: "application/pdf" });
  } catch (error) {
    if (error instanceof PartnerContractPdfError) throw error;
    throw new PartnerContractPdfError("LOAD_FAILED");
  }
}

export function releaseContractPdfUrlLater(url: string) {
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function openContractPdf(signatureId: string) {
  const url = URL.createObjectURL(await fetchContractPdfBlob(signatureId));
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  releaseContractPdfUrlLater(url);
  return Boolean(opened);
}

export async function downloadContractPdf(signatureId: string, filename: string) {
  const url = URL.createObjectURL(await fetchContractPdfBlob(signatureId));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  releaseContractPdfUrlLater(url);
}
