const API = (import.meta.env.VITE_PLATFORM_API_URL || "https://chuang-baiye-ai.baiye-platform.workers.dev").replace(/\/$/, "");

export async function fetchMerchantContractPdfBlob(signatureId: string) {
  const response = await fetch(`${API}/api/merchant/contracts/${encodeURIComponent(signatureId)}/pdf`, { credentials: "include" });
  if (response.status === 401) throw new Error("登入已失效，請重新登入商家中心。");
  if (response.status === 404) throw new Error("找不到此已簽契約 PDF。");
  if (!response.ok) throw new Error("PDF 暫時無法下載，請稍後再試。");
  return response.blob();
}

export async function downloadMerchantContractPdf(signatureId: string, publicId: string) {
  const url = URL.createObjectURL(await fetchMerchantContractPdfBlob(signatureId));
  const link = document.createElement("a");
  link.href = url;
  link.download = `創百業智慧鏈_商家平台服務契約_${publicId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
